from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_active_tenant_user, get_db
from app.routers import key_router


@pytest.mark.asyncio
async def test_key_collection_accepts_both_slash_forms(monkeypatch):
    app = FastAPI()
    app.include_router(key_router.router)

    async def override_get_db():
        yield object()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_active_tenant_user] = lambda: SimpleNamespace(tenant_id=1)
    monkeypatch.setattr(key_router.key_repo, "get_signing_keys", AsyncMock(return_value=[]))

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        for path in ("/api/keys", "/api/keys/"):
            response = await client.get(path)
            assert response.status_code == 200
            assert response.json() == []
