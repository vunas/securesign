from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.enums import CertType
from app.models.user import User
from app.schemas.certificate_schema import CertificateCreate, CertificateResponse
from app.services.certificate_service import certificate_service

router = APIRouter(prefix="/api/certificates", tags=["Certificates"])


@router.post("/", response_model=CertificateResponse)
async def create_certificate(
    cert_data: CertificateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tạo một chứng chỉ End-User mới. Do Intermediate CA cấp phát.
    """
    if cert_data.cert_type != CertType.END_ENTITY:
        raise HTTPException(
            status_code=400,
            detail="Tổ chức chỉ được phép tạo chứng thư số loại END_ENTITY.",
        )

    try:
        issuer_cert = await certificate_service.get_intermediate_ca(db)
        if not issuer_cert:
            raise ValueError("Hệ thống chưa thiết lập Intermediate CA. Vui lòng chạy Seed Data.")

        cert = await certificate_service.create_signed_cert(
            db, current_user.tenant_id, cert_data, issuer_cert=issuer_cert
        )
        return cert
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/download-root-ca")
async def download_root_ca(db: AsyncSession = Depends(get_db)):
    """Tải xuống Root CA (định dạng .cer) để cài đặt vào hệ điều hành/Acrobat."""
    root_ca = await certificate_service.get_root_ca(db)

    if not root_ca:
        raise HTTPException(
            status_code=404,
            detail="Chưa có Root CA trong hệ thống. Vui lòng chạy Seed Data trước.",
        )

    return Response(
        content=root_ca.certificate_data,
        media_type="application/x-x509-ca-cert",
        headers={"Content-Disposition": 'attachment; filename="SecureSign_Root_CA.cer"'},
    )
