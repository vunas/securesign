from sqlalchemy.ext.asyncio import AsyncSession

from app.models.certificate import CertificateChain, CertType
from app.schemas.certificate_schema import CertificateCreate
from app.schemas.key_schema import KeyCreate
from app.services.certificate_service import certificate_service
from app.services.key_service import key_service


async def seed_pki(db: AsyncSession, users: dict):
    print("🔑 Đang tạo Hệ thống PKI...")

    tenant_id = users["tenant"].id

    root_key = await key_service.create_key(
        db, tenant_id, KeyCreate(key_name="Root CA Key", key_size=2048)
    )
    root_cert = await certificate_service.create_root_ca(
        db,
        tenant_id,
        CertificateCreate(
            cert_name="SecureSign Root CA",
            key_id=root_key.id,
            issuer="SecureSign Root CA",
            subject="SecureSign Root CA",
            valid_days=3650,
            cert_type=CertType.ROOT,
        ),
    )
    db.add(
        CertificateChain(
            certificate_id=root_cert.id,
            ca_certificate_data=root_cert.certificate_data,
            level=0,
        )
    )
    print("  -> Đã tạo Root CA")

    inter_key = await key_service.create_key(
        db, tenant_id, KeyCreate(key_name="Intermediate CA Key", key_size=2048)
    )
    inter_cert = await certificate_service.create_signed_cert(
        db,
        tenant_id,
        CertificateCreate(
            cert_name="SecureSign Intermediate CA",
            key_id=inter_key.id,
            issuer="SecureSign Root CA",
            subject="SecureSign Intermediate CA",
            valid_days=1825,
            cert_type=CertType.INTERMEDIATE,
        ),
        issuer_cert=root_cert,
    )
    db.add(
        CertificateChain(
            certificate_id=inter_cert.id,
            ca_certificate_data=inter_cert.certificate_data,
            level=1,
        )
    )
    print("  -> Đã tạo Intermediate CA")

    tsa_key = await key_service.create_key(
        db, tenant_id, KeyCreate(key_name="Internal TSA Key", key_size=2048)
    )
    tsa_cert = await certificate_service.create_signed_cert(
        db,
        tenant_id,
        CertificateCreate(
            cert_name="SecureSign Internal TSA",
            key_id=tsa_key.id,
            issuer="SecureSign Intermediate CA",
            subject="SecureSign TimeStamping Authority",
            valid_days=1825,
            cert_type=CertType.END_ENTITY,
        ),
        issuer_cert=inter_cert,
    )
    tsa_cert.purpose = "timestamping"
    db.add(
        CertificateChain(
            certificate_id=tsa_cert.id,
            ca_certificate_data=tsa_cert.certificate_data,
            level=2,
        )
    )
    await db.commit()
    print("  -> Đã tạo TSA Certificate")

    user_key = await key_service.create_key(
        db, tenant_id, KeyCreate(key_name="Khóa Ký Hợp Đồng", key_size=2048)
    )
    user_cert = await certificate_service.create_signed_cert(
        db,
        tenant_id,
        CertificateCreate(
            cert_name="Chứng chỉ Giám Đốc Nguyễn",
            key_id=user_key.id,
            issuer="SecureSign Intermediate CA",
            subject="Giám Đốc Nguyễn Văn A",
            valid_days=365,
            cert_type=CertType.END_ENTITY,
        ),
        issuer_cert=inter_cert,
    )
    user_cert.purpose = "document_signing"
    db.add(
        CertificateChain(
            certificate_id=user_cert.id,
            ca_certificate_data=user_cert.certificate_data,
            level=2,
        )
    )
    await db.commit()
    print("  -> Đã tạo chứng chỉ người dùng")

    return {"user_key": user_key, "user_cert": user_cert}
