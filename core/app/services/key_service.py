import hashlib

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from sqlalchemy.ext.asyncio import AsyncSession

# Centralized Enums
from app.models.enums import TargetResourceType
from app.repositories.certificate_repo import certificate_repo
from app.repositories.key_repo import key_repo
from app.schemas.key_schema import KeyCreate
from app.services.crypto.aes_service import aes_service
from app.services.log_service import log_service


class KeyService:
    async def create_key(
        self,
        db: AsyncSession,
        tenant_id: int | None = None,
        key_data: KeyCreate | None = None,
        user_id: int | None = None,
    ):
        if tenant_id is None:
            raise ValueError("Tenant ID là bắt buộc đối với dịch vụ mật mã PKI.")
        if key_data.algorithm.value == "RSA":
            private_key = rsa.generate_private_key(
                public_exponent=65537, key_size=key_data.key_size
            )
        else:
            private_key = ec.generate_private_key(ec.SECP256R1())

        unencrypted_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        encrypted_priv_pem = aes_service.encrypt_key(unencrypted_pem)

        pub_key_pem = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        fingerprint = hashlib.sha256(pub_key_pem).hexdigest()[:16].upper()

        db_key = await key_repo.create(
            db=db,
            tenant_id=tenant_id,
            key_name=key_data.key_name,
            public_key=pub_key_pem,
            private_key_encrypted=encrypted_priv_pem,
            key_size=key_data.key_size if key_data.algorithm.value == "RSA" else 256,
            algorithm=key_data.algorithm,
            storage_type=key_data.storage_type,
            key_fingerprint=fingerprint,
        )

        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            action="GENERATE_KEY",
            target_type=TargetResourceType.KEY,
            target_id=str(db_key.id),
            payload={
                "key_name": key_data.key_name,
                "storage_type": key_data.storage_type.value,
                "fingerprint": fingerprint,
            },
        )

        return db_key

    async def revoke_key(self, db: AsyncSession, key_id: int, tenant_id: int, user_id: int):
        key_record = await key_repo.get_by_id(db, key_id, tenant_id)
        if key_record is None:
            return None
        if key_record.is_revoked:
            raise ValueError("Khóa đã được thu hồi trước đó.")

        key_record.is_revoked = True
        certificate = await certificate_repo.get_by_key_id(db, key_id, tenant_id)
        if certificate is not None and not certificate.is_revoked:
            certificate.revoke()
        await db.flush()
        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            action="REVOKE_KEY",
            target_type=TargetResourceType.KEY,
            target_id=str(key_id),
            payload={"key_fingerprint": key_record.key_fingerprint},
        )
        return key_record


key_service = KeyService()
