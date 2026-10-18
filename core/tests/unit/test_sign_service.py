from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.sign_service import SignService

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
async def test_sign_pdf_missing_records_raises_value_error(mock_sign_repos):
    """
    Validates: Actively raises an error (ValueError) when a record is not found in the database.
    """
    svc = SignService()

    mock_sign_repos.set_not_found()
    mock_sign_repos.apply()

    sign_data = SimpleNamespace(credential_id=1, key_id=1)

    with pytest.raises(ValueError, match="Không tìm thấy tài liệu"):
        await svc.sign_pdf(db=None, pdf_bytes=b"%PDF", tenant_id=1, user_id=1, sign_data=sign_data)


@pytest.mark.unit
async def test_sign_pdf_local_key_requires_raw_private_key(mock_sign_repos):
    """
    Validates: local storage refuses signing if raw_private_key not provided.
    """
    svc = SignService()

    mock_sign_repos.key.storage_type = "local"
    mock_sign_repos.key.private_key_encrypted = b""
    mock_sign_repos.apply()

    sign_data = SimpleNamespace(
        credential_id=mock_sign_repos.credential.id,
        key_id=mock_sign_repos.key.id,
        raw_private_key=None,
        passphrase=None,
        signer_name="n",
        signer_reason="r",
        signer_location="l",
    )

    with pytest.raises(ValueError, match="giải mã khóa"):
        await svc.sign_pdf(db=None, pdf_bytes=b"%PDF", tenant_id=1, user_id=1, sign_data=sign_data)


@pytest.mark.unit
async def test_sign_pdf_invalid_passphrase_maps_to_value_error(mock_sign_repos, monkeypatch):
    """
    Validates: invalid passphrase / key format raises friendly ValueError.
    """
    svc = SignService()

    # Dùng default setup (Server Storage)
    mock_sign_repos.apply()
    monkeypatch.setattr("app.services.sign_service.log_service.log_action", AsyncMock())

    sign_data = SimpleNamespace(
        credential_id=mock_sign_repos.credential.id,
        key_id=mock_sign_repos.key.id,
        raw_private_key=None,
        passphrase="wrong",
        signer_name="n",
        signer_reason="r",
        signer_location="l",
    )

    def fake_load_pem_private_key(*a, **k):
        raise Exception("bad decrypt")

    # Vẫn cần monkeypatch riêng cho thư viện cryptography (chỉ có trong test này)
    monkeypatch.setattr("app.services.sign_service.load_pem_private_key", fake_load_pem_private_key)

    with pytest.raises(ValueError, match="Mật khẩu giải mã khóa"):
        await svc.sign_pdf(db=None, pdf_bytes=b"%PDF", tenant_id=1, user_id=1, sign_data=sign_data)
