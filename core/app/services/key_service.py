import hashlib

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy.ext.asyncio import AsyncSession

# Centralized Enums
from app.models.enums import TargetResourceType
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
    ):
        if tenant_id is None:
            raise ValueError("Tenant ID là bắt buộc đối với dịch vụ mật mã PKI.")
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=key_data.key_size)

        unencrypted_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        encrypted_priv_pem = b""
        raw_private_key_to_return = None

        if key_data.passphrase:
            encrypted_priv_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.BestAvailableEncryption(
                    key_data.passphrase.encode("utf-8")
                ),
            )
        else:
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
            key_size=key_data.key_size,
            algorithm=key_data.algorithm,
            storage_type=key_data.storage_type,
            key_fingerprint=fingerprint,
        )

        setattr(db_key, "raw_private_key", raw_private_key_to_return)

        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=None,
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


key_service = KeyService()
