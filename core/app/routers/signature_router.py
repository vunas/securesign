from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.dependencies import ActiveTenantUserDep, DatabaseDep
from app.repositories.credential_repo import credential_repo
from app.schemas.signature_schema import SignatureCreate
from app.services.sign_service import sign_service
from app.utils.file_utils import MAX_FILE_SIZE

router = APIRouter(prefix="/api/signatures", tags=["Signatures"])


@router.post("/sign-pdf")
async def sign_credential(
    db: DatabaseDep,
    current_user: ActiveTenantUserDep,
    file: UploadFile = File(...),
    credential_id: int = Form(...),
    key_id: int = Form(...),
    signer_name: str = Form(...),
    signer_reason: str = Form("Xác nhận credential"),
    signer_location: str = Form("Việt Nam"),
):
    """Ký số lên tài liệu PDF bằng cách tương tác với hệ thống PKI nội bộ."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Vui lòng tải lên file định dạng PDF.")

    try:
        pdf_bytes = await file.read(MAX_FILE_SIZE + 1)
        if len(pdf_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Dung lượng tệp vượt quá giới hạn cho phép (tối đa 20MB).",
            )
        credential = await credential_repo.get_by_id(db, credential_id, current_user.tenant_id)
        if credential is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy văn bằng.")
        sign_data = SignatureCreate(
            credential_id=credential_id,
            key_id=key_id,
            signer_name=signer_name,
            signer_reason=signer_reason,
            signer_location=signer_location,
            verification_url=(
                f"{settings.PUBLIC_APP_URL.rstrip('/')}/verify/{credential.tracking_id}"
            ),
        )

        signed_pdf, signed_hash = await sign_service.sign_pdf(
            db=db,
            pdf_bytes=pdf_bytes,
            tenant_id=current_user.tenant_id,
            sign_data=sign_data,
            user_id=current_user.id,
        )

        return StreamingResponse(
            iter([signed_pdf]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'attachment; filename="credential-signed.pdf"',
                "X-Signed-Hash": signed_hash,
            },
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
