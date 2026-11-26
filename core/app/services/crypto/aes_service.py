from app.core.encryption import (
    decrypt_private_key,
    decrypt_private_key_envelope,
    encrypt_private_key,
    encrypt_private_key_envelope,
)


class AESService:
    """
    Wrapper Service cho phần mã hóa Private Key bằng AES.
    Giúp tầng Business Logic không bị phụ thuộc trực tiếp vào tầng Core.
    """

    @staticmethod
    def encrypt_key(plain_private_key: bytes) -> bytes:
        return encrypt_private_key(plain_private_key)

    @staticmethod
    def decrypt_key(encrypted_private_key: bytes) -> bytes:
        return decrypt_private_key(encrypted_private_key)

    @staticmethod
    def encrypt_key_envelope(plain_private_key: bytes):
        return encrypt_private_key_envelope(plain_private_key)

    @staticmethod
    def decrypt_key_envelope(
        encrypted_private_key: bytes,
        encrypted_dek: bytes,
        private_key_nonce: bytes,
        encryption_version: int,
    ) -> bytes:
        return decrypt_private_key_envelope(
            encrypted_private_key,
            encrypted_dek,
            private_key_nonce,
            encryption_version,
        )


# Khởi tạo instance aes_service
aes_service = AESService()
