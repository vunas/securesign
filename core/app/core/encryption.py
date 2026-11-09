import base64
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import settings

_LEGACY_CIPHER = Fernet(settings.ENCRYPTION_KEY.encode())
_ENCRYPTION_PREFIX = b"AESGCM1"


def _master_key() -> bytes:
    try:
        key = base64.urlsafe_b64decode(settings.ENCRYPTION_KEY.encode("ascii"))
    except (ValueError, UnicodeEncodeError) as exc:
        raise ValueError("ENCRYPTION_KEY phải là khóa AES-256 dạng URL-safe Base64.") from exc
    if len(key) != 32:
        raise ValueError("ENCRYPTION_KEY phải giải mã thành đúng 32 byte.")
    return key


def encrypt_private_key(private_key_bytes: bytes) -> bytes:
    nonce = os.urandom(12)
    ciphertext = AESGCM(_master_key()).encrypt(nonce, private_key_bytes, None)
    return _ENCRYPTION_PREFIX + nonce + ciphertext


def decrypt_private_key(encrypted_private_key: bytes) -> bytes:
    if isinstance(encrypted_private_key, memoryview):
        encrypted_private_key = encrypted_private_key.tobytes()
    elif isinstance(encrypted_private_key, str):
        encrypted_private_key = encrypted_private_key.strip().encode("utf-8")

    if encrypted_private_key.startswith(_ENCRYPTION_PREFIX):
        nonce_start = len(_ENCRYPTION_PREFIX)
        nonce = encrypted_private_key[nonce_start : nonce_start + 12]
        ciphertext = encrypted_private_key[nonce_start + 12 :]
        if len(nonce) != 12 or not ciphertext:
            raise ValueError("Dữ liệu khóa mã hóa không hợp lệ.")
        return AESGCM(_master_key()).decrypt(nonce, ciphertext, None)

    try:
        return _LEGACY_CIPHER.decrypt(encrypted_private_key)
    except InvalidToken as exc:
        raise ValueError("Không thể giải mã khóa riêng tư.") from exc
