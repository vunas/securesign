import hashlib
import uuid
from datetime import date

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import CredentialStatus, TargetResourceType
from app.repositories.credential_repo import credential_repo
from app.schemas.signature_schema import SignatureCreate
from app.services.log_service import log_service
from app.services.quota_service import quota_service
from app.services.sign_service import sign_service
from app.utils.file_utils import MAX_FILE_SIZE


class FileService:
    async def upload_credential(
        self,
        db: AsyncSession,
        user_id: int,
        file: UploadFile,
        tenant_id: int | None = None,
    ):
        """Create hash-only credential metadata without persisting PDF bytes."""
        if tenant_id is None:
            raise ValueError("Tenant ID là bắt buộc để tạo credential.")

        # Đọc có giới hạn để bảo vệ RAM
        pdf_bytes = await file.read(MAX_FILE_SIZE + 1)
        if len(pdf_bytes) > MAX_FILE_SIZE:
            raise ValueError("Dung lượng tệp vượt quá giới hạn cho phép (tối đa 20MB).")
        if not pdf_bytes:
            raise ValueError("Tệp PDF không được rỗng.")
        if not pdf_bytes.startswith(b"%PDF-"):
            raise ValueError("Tệp tải lên không đúng định dạng PDF.")

        original_hash = hashlib.sha256(pdf_bytes).hexdigest()
        credential = await credential_repo.create(
            db=db,
            tenant_id=tenant_id,
            created_by_user_id=user_id,
            tracking_id=uuid.uuid4().hex,
            recipient_name="Chưa cập nhật",
            recipient_id=None,
            issue_date=date.today(),
            file_name=file.filename,
            file_download_url=None,
            original_hash=original_hash,
            signed_hash=None,
            status=CredentialStatus.DRAFT,
        )
        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            action="UPLOAD_CREDENTIAL",
            target_type=TargetResourceType.CREDENTIAL,
            target_id=str(credential.id),
            payload={"file_name": file.filename, "original_hash": original_hash},
        )
        return credential

    async def issue_and_sign_credential(
        self,
        db: AsyncSession,
        file: UploadFile,
        tenant_id: int,
        user_id: int,
        recipient_name: str,
        recipient_id: str | None,
        sign_data: SignatureCreate,
        credential_number: str | None = None,
        issue_date: date | None = None,
        metadata_payload: dict | None = None,
    ) -> tuple[bytes, str, str]:
        """Create a credential record and sign the PDF in memory."""
        if tenant_id is None:
            raise ValueError("Tenant ID là bắt buộc.")

        # File bytes are retained only for this request and never written to disk.
        pdf_bytes = await file.read(MAX_FILE_SIZE + 1)
        if len(pdf_bytes) > MAX_FILE_SIZE:
            raise ValueError("Dung lượng tệp vượt quá giới hạn cho phép (tối đa 20MB).")
        if not pdf_bytes:
            raise ValueError("Tệp PDF không được rỗng.")
        if not pdf_bytes.startswith(b"%PDF-"):
            raise ValueError("Tệp tải lên không đúng định dạng PDF.")

        original_hash = hashlib.sha256(pdf_bytes).hexdigest()
        tracking_id = uuid.uuid4().hex

        await quota_service.reserve_signing(db, tenant_id)
        credential = await credential_repo.create(
            db=db,
            tenant_id=tenant_id,
            created_by_user_id=user_id,
            tracking_id=tracking_id,
            credential_number=credential_number,
            recipient_name=recipient_name,
            recipient_id=recipient_id,
            issue_date=issue_date or date.today(),
            metadata_=metadata_payload,
            file_name=file.filename,
            file_download_url=None,
            original_hash=original_hash,
            signed_hash=None,
            status=CredentialStatus.DRAFT,
        )

        sign_data = sign_data.model_copy(
            update={
                "credential_id": credential.id,
                "verification_url": f"{settings.PUBLIC_APP_URL.rstrip('/')}/verify/{tracking_id}",
            }
        )

        signed_pdf_bytes, signed_hash = await sign_service.sign_pdf(
            db=db,
            pdf_bytes=pdf_bytes,
            tenant_id=tenant_id,
            sign_data=sign_data,
            user_id=user_id,
        )

        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            action="ISSUE_AND_SIGN_CREDENTIAL",
            target_type=TargetResourceType.CREDENTIAL,
            target_id=str(credential.id),
            payload={
                "tracking_id": tracking_id,
                "recipient_id": recipient_id,
                "file_name": file.filename,
                "original_hash": original_hash,
                "signed_hash": signed_hash,
            },
        )

        return signed_pdf_bytes, signed_hash, tracking_id


file_service = FileService()
