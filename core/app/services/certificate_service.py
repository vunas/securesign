from datetime import UTC, datetime, timedelta

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    load_pem_private_key,
    load_pem_public_key,
)
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.certificate import Certificate

# Centralized Enums
from app.models.enums import CertType, TargetResourceType
from app.repositories.certificate_repo import certificate_repo
from app.repositories.key_repo import key_repo
from app.schemas.certificate_schema import CertificateCreate
from app.services.crypto.aes_service import aes_service
from app.services.log_service import log_service


class CertificateService:
    def _get_private_key(self, key_record, passphrase: str = None, raw_key: str = None):
        if key_record.storage_type == "local" or (
            hasattr(key_record.storage_type, "value") and key_record.storage_type.value == "local"
        ):
            if not raw_key:
                raise ValueError("Bắt buộc phải có Private Key thô để ký chứng chỉ Local.")
            return load_pem_private_key(raw_key.encode("utf-8"), password=None)
        else:
            if passphrase:
                try:
                    return load_pem_private_key(
                        key_record.private_key_encrypted, password=passphrase.encode("utf-8")
                    )
                except Exception:
                    raise ValueError("Passphrase giải mã khóa không chính xác!")
            else:
                priv_key_bytes = aes_service.decrypt_key(key_record.private_key_encrypted)
                return load_pem_private_key(priv_key_bytes, password=None)

    async def create_root_ca(
        self,
        db: AsyncSession,
        tenant_id: int | None = None,
        cert_data: CertificateCreate | None = None,
        user_id: int | None = None,
    ):
        if tenant_id is None:
            raise ValueError("Tenant ID là bắt buộc đối với dịch vụ mật mã PKI.")
        key_record = await key_repo.get_by_id(db, cert_data.key_id, tenant_id)
        private_key = self._get_private_key(key_record)
        public_key = load_pem_public_key(key_record.public_key)

        subject = issuer = x509.Name(
            [
                x509.NameAttribute(NameOID.COMMON_NAME, cert_data.subject),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, cert_data.issuer),
                x509.NameAttribute(NameOID.COUNTRY_NAME, "VN"),
            ]
        )

        cert_builder = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(public_key)
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.now(UTC))
            .not_valid_after(datetime.now(UTC) + timedelta(days=cert_data.valid_days))
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=True,
                    key_encipherment=False,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=True,
                    crl_sign=True,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
        )

        certificate = cert_builder.sign(private_key, hashes.SHA256())

        created_cert = await certificate_repo.create(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            key_id=key_record.id,
            cert_name=cert_data.cert_name,
            certificate_data=certificate.public_bytes(Encoding.DER),
            certificate_pem=certificate.public_bytes(Encoding.PEM).decode(),
            issuer=cert_data.issuer,
            subject=cert_data.subject,
            cert_type=cert_data.cert_type,
            serial_number=str(certificate.serial_number),
            valid_from=certificate.not_valid_before_utc,
            valid_to=certificate.not_valid_after_utc,
        )

        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            action="CREATE_ROOT_CA",
            target_type=TargetResourceType.CERTIFICATE,
            target_id=str(created_cert.id),
            payload={
                "serial": str(certificate.serial_number),
                "subject": cert_data.subject,
            },
        )
        return created_cert

    async def create_signed_cert(
        self,
        db: AsyncSession,
        tenant_id: int | None = None,
        cert_data: CertificateCreate | None = None,
        issuer_cert=None,
        user_id: int | None = None,
    ):
        if tenant_id is None:
            raise ValueError("Tenant ID là bắt buộc đối với dịch vụ mật mã PKI.")
        user_key_record = await key_repo.get_by_id(db, cert_data.key_id, tenant_id)
        user_public_key = load_pem_public_key(user_key_record.public_key)

        issuer_tenant_id = getattr(issuer_cert, "tenant_id", None) or tenant_id
        issuer_key_record = await key_repo.get_by_id(db, issuer_cert.key_id, issuer_tenant_id)
        issuer_private_key = self._get_private_key(issuer_key_record)
        issuer_x509 = x509.load_der_x509_certificate(issuer_cert.certificate_data)

        subject = x509.Name(
            [
                x509.NameAttribute(NameOID.COMMON_NAME, cert_data.subject),
                x509.NameAttribute(NameOID.COUNTRY_NAME, "VN"),
            ]
        )

        is_ca = cert_data.cert_type == CertType.INTERMEDIATE
        is_tsa = (
            cert_data.cert_type == CertType.END_ENTITY
            and getattr(cert_data, "purpose", "") == "timestamping"
        )

        cert_builder = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer_x509.subject)
            .public_key(user_public_key)
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.now(UTC))
            .not_valid_after(datetime.now(UTC) + timedelta(days=cert_data.valid_days))
            .add_extension(
                x509.BasicConstraints(ca=is_ca, path_length=0 if is_ca else None), critical=True
            )
        )

        if not is_ca and not is_tsa:
            cert_builder = cert_builder.add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=True,
                    key_encipherment=True,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=False,
                    crl_sign=False,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )

        if is_tsa:
            cert_builder = cert_builder.add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=True,
                    key_encipherment=False,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=False,
                    crl_sign=False,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
            cert_builder = cert_builder.add_extension(
                x509.ExtendedKeyUsage([ExtendedKeyUsageOID.TIME_STAMPING]), critical=True
            )

        certificate = cert_builder.sign(issuer_private_key, hashes.SHA256())

        created_cert = await certificate_repo.create(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            key_id=user_key_record.id,
            cert_name=cert_data.cert_name,
            certificate_data=certificate.public_bytes(Encoding.DER),
            certificate_pem=certificate.public_bytes(Encoding.PEM).decode(),
            issuer=issuer_x509.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value,
            subject=cert_data.subject,
            cert_type=cert_data.cert_type,
            serial_number=str(certificate.serial_number),
            valid_from=certificate.not_valid_before_utc,
            valid_to=certificate.not_valid_after_utc,
        )

        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            action="CREATE_SIGNED_CERT",
            target_type=TargetResourceType.CERTIFICATE,
            target_id=str(created_cert.id),
            payload={
                "serial": str(certificate.serial_number),
                "type": cert_data.cert_type,
            },
        )
        return created_cert

    async def get_root_ca(self, db: AsyncSession):
        result = await db.execute(
            select(Certificate).filter(Certificate.cert_type == CertType.ROOT)
        )
        return result.scalars().first()

    async def get_intermediate_ca(self, db: AsyncSession):
        result = await db.execute(
            select(Certificate).filter(Certificate.cert_type == CertType.INTERMEDIATE)
        )
        return result.scalars().first()

    async def get_internal_tsa(self, db: AsyncSession):
        result = await db.execute(
            select(Certificate).filter(
                Certificate.cert_type == CertType.END_ENTITY, Certificate.purpose == "timestamping"
            )
        )
        tsa_cert = result.scalars().first()
        if not tsa_cert:
            return None, None
        tsa_key = await key_repo.get_by_id(
            db, tsa_cert.key_id, getattr(tsa_cert, "tenant_id", None)
        )
        return tsa_cert, tsa_key


certificate_service = CertificateService()
