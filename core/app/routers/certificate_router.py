from fastapi import APIRouter, HTTPException, Response

from app.core.dependencies import DatabaseDep, TenantAdminDep
from app.models.enums import CertType
from app.models.tenant import Tenant
from app.schemas.certificate_schema import CertificateCreate, CertificateResponse
from app.services.certificate_service import certificate_service

router = APIRouter(prefix="/api/certificates", tags=["Certificates"])


@router.post("/", response_model=CertificateResponse, include_in_schema=False)
@router.post("", response_model=CertificateResponse)
async def create_certificate(
    cert_data: CertificateCreate,
    db: DatabaseDep,
    current_user: TenantAdminDep,
):
    """
    Tạo một chứng chỉ End-User mới gắn với Tổ chức (Tenant-level). Do Intermediate CA cấp phát.
    Chỉ dành cho Quản trị viên tổ chức (Tenant Admin).
    """
    if cert_data.cert_type != CertType.END_ENTITY:
        raise HTTPException(
            status_code=400,
            detail="Tổ chức chỉ được phép tạo chứng thư số loại END_ENTITY.",
        )

    try:
        tenant = await db.get(Tenant, current_user.tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Không tìm thấy thông tin tổ chức.")

        # Chứng thư số X.509 thuộc về tổ chức: trường subject lấy theo tên tổ chức hiện tại
        cert_data = cert_data.model_copy(update={"subject": tenant.name})

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
