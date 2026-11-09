import hashlib
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.schemas.api_key_schema import ApiKeyCreate
from app.services.api_key_service import ApiKeyService


@pytest.mark.asyncio
async def test_api_key_create_only_persists_hash_and_returns_secret(monkeypatch):
    service = ApiKeyService()
    db = SimpleNamespace(add=Mock(), flush=AsyncMock())
    monkeypatch.setattr("app.services.api_key_service.log_service.log_action", AsyncMock())

    api_key, secret = await service.create(
        db,
        tenant_id=12,
        request=ApiKeyCreate(name="Integration", rate_limit_per_min=30),
        user_id=7,
    )

    assert api_key.key_hash == hashlib.sha256(secret.encode()).hexdigest()
    assert api_key.key_prefix == secret[:16]
    assert secret not in api_key.key_hash
    assert api_key.tenant_id == 12


@pytest.mark.asyncio
async def test_api_key_create_rejects_expired_secret():
    service = ApiKeyService()

    with pytest.raises(ValueError, match="tương lai"):
        await service.create(
            SimpleNamespace(),
            tenant_id=12,
            request=ApiKeyCreate(
                name="Expired",
                expires_at="2020-01-01T00:00:00Z",
            ),
            user_id=7,
        )
