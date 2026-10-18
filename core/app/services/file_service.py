import hashlib
import uuid
from datetime import date

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import CredentialStatus, TargetResourceType
from app.repositories.credential_repo import credential_repo
from app.schemas.signature_schema import SignatureCreate
from app.services.log_service import log_service
from app.services.sign_service import sign_service


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
        pdf_bytes = await file.read()
        if not pdf_bytes:
            raise ValueError("Tệp PDF không được rỗng.")
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
    ) -> tuple[bytes, str]:
        """Tiếp nhận PDF và recipient metadata, rồi ký trực tiếp trên RAM."""
        if tenant_id is None:
            raise ValueError("Tenant ID là bắt buộc.")

        # 1. Đọc nội dung file vào RAM
        pdf_bytes = await file.read()
        if not pdf_bytes:
            raise ValueError("Tệp PDF không được rỗng.")
        if not pdf_bytes.startswith(b"%PDF-"):
            raise ValueError("Tệp tải lên không đúng định dạng PDF.")

        original_hash = hashlib.sha256(pdf_bytes).hexdigest()
        tracking_id = uuid.uuid4().hex

        # 2. Tạo bản ghi Credential ban đầu với thông tin thực tế từ người dùng
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
            file_download_url=None,  # Chuẩn Stateless: Không lưu path đĩa
            original_hash=original_hash,
            signed_hash=None,
            status=CredentialStatus.DRAFT,
        )

        # Gán credential_id vào sign_data để liên kết bản ghi chữ ký
        sign_data.credential_id = credential.id

        # 3. Ký số PAdES trực tiếp trên RAM qua sign_service
        signed_pdf_bytes, signed_hash = await sign_service.sign_pdf(
            db=db,
            pdf_bytes=pdf_bytes,
            tenant_id=tenant_id,
            sign_data=sign_data,
            user_id=user_id,
        )

        # 4. Ghi Audit Log hoàn tất cấp phát
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

        return signed_pdf_bytes, signed_hash


file_service = FileService()
