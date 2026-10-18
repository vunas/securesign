import hashlib
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.models.key import KeyStorageType, SignatureAlgo
from app.services.key_service import KeyService

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
async def test_key_service_create_key_fingerprint_sha256_first_16_upper_hex(monkeypatch):
    """
    Unit test: avoid DB + side effects by mocking repository + AES.
    Validates the SHA-256 fingerprint format produced by KeyService.
    """

    captured = {}

    def fake_encrypt_key(data: bytes) -> bytes:
        return b"ENCRYPTED(" + data[:8] + b")"

    monkeypatch.setattr("app.services.key_service.aes_service.encrypt_key", fake_encrypt_key)
    monkeypatch.setattr(
        "app.services.key_service.key_repo.create",
        AsyncMock(
            side_effect=lambda db, **kwargs: (
                captured.update(kwargs) or SimpleNamespace(**kwargs, id=123, created_at=None)
            )
        ),
    )
    monkeypatch.setattr("app.services.key_service.log_service.log_action", AsyncMock())

    service = KeyService()

    key_data = SimpleNamespace(
        key_name="k1",
        storage_type=KeyStorageType.SERVER,
        key_size=2048,
        algorithm=SignatureAlgo.RSA,
        passphrase=None,
    )

    result = await service.create_key(db=object(), tenant_id=7, key_data=key_data)
    assert result is not None

    pub_pem = captured["public_key"]
    expected = hashlib.sha256(pub_pem).hexdigest()[:16].upper()
    assert captured["key_fingerprint"] == expected
    assert len(captured["key_fingerprint"]) == 16
    int(captured["key_fingerprint"], 16)
