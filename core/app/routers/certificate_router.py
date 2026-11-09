from fastapi import APIRouter, HTTPException, Response

from app.core.dependencies import ActiveTenantUserDep, DatabaseDep
from app.models.enums import CertType
from app.schemas.certificate_schema import CertificateCreate, CertificateResponse
from app.services.certificate_service import certificate_service

router = APIRouter(prefix="/api/certificates", tags=["Certificates"])


@router.post("/", response_model=CertificateResponse)
async def create_certificate(
    cert_data: CertificateCreate,
    db: DatabaseDep,
    current_user: ActiveTenantUserDep,
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
            db,
            current_user.tenant_id,
            cert_data,
            issuer_cert=issuer_cert,
            user_id=current_user.id,
        )
        return cert
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/download-root-ca")
async def download_root_ca(db: DatabaseDep):
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
