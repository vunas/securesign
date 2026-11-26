import pytest

from app.core.encryption import (
    decrypt_private_key_envelope,
    encrypt_private_key_envelope,
)


def test_envelope_encryption_round_trips_private_key():
    private_key = b"private-key-pem"
    encrypted, encrypted_dek, nonce, version = encrypt_private_key_envelope(private_key)

    assert decrypt_private_key_envelope(encrypted, encrypted_dek, nonce, version) == private_key
    assert encrypted != private_key
    assert encrypted_dek != private_key


def test_envelope_encryption_rejects_corrupted_ciphertext():
    encrypted, encrypted_dek, nonce, version = encrypt_private_key_envelope(b"private-key-pem")
    corrupted = bytearray(encrypted)
    corrupted[-1] ^= 1

    with pytest.raises(ValueError, match="Không thể giải mã"):
        decrypt_private_key_envelope(bytes(corrupted), encrypted_dek, nonce, version)


def test_envelope_encryption_rejects_unsupported_version():
    encrypted, encrypted_dek, nonce, _version = encrypt_private_key_envelope(b"private-key-pem")

    with pytest.raises(ValueError, match="không được hỗ trợ"):
        decrypt_private_key_envelope(encrypted, encrypted_dek, nonce, 99)
