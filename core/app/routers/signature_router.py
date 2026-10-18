from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.core.dependencies import CurrentUserDep, DatabaseDep
from app.schemas.signature_schema import SignatureCreate
from app.services.sign_service import sign_service
from app.utils.logger import logger

router = APIRouter(prefix="/api/signatures", tags=["Signatures"])


@router.post("/sign-pdf")
async def sign_credential(
    db: DatabaseDep,
    current_user: CurrentUserDep,
    file: UploadFile = File(...),
    credential_id: int = Form(...),
    key_id: int = Form(...),
    signer_name: str = Form(...),
    signer_reason: str = Form("Xác nhận credential"),
    signer_location: str = Form("Việt Nam"),
    passphrase: str | None = Form(None),
    raw_private_key: str | None = Form(None),
):
    """Ký số lên tài liệu PDF bằng cách tương tác với hệ thống PKI nội bộ."""
    try:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Vui lòng tải lên file định dạng PDF.")

        pdf_bytes = await file.read()
        sign_data = SignatureCreate(
            credential_id=credential_id,
            key_id=key_id,
            signer_name=signer_name,
            signer_reason=signer_reason,
            signer_location=signer_location,
            passphrase=passphrase,
            raw_private_key=raw_private_key,
        )
        logger.info(f"User {current_user.username} đang ký credential ID {credential_id}")

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

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Lỗi ký tài liệu: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hệ thống khi ký tài liệu: {str(e)}",
        )
