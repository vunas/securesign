from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.core.dependencies import get_current_user

pytestmark = pytest.mark.asyncio


class TestRouterSecurityAndValidation:
    async def test_sign_route_without_auth_returns_401(self, client_full, monkeypatch):
        # Arrange
        monkeypatch.setattr(
            "app.routers.signature_router.sign_service.sign_pdf",
            AsyncMock(
                return_value=SimpleNamespace(
                    id=1,
                    credential_id=1,
                    user_id=1,
                    hash_algorithm="SHA-256",
                    signature_algorithm="RSA",
                    signer_name="n",
                    signer_reason="r",
                    signer_location="l",
                    created_at="2026-01-01T00:00:00Z",
                )
            ),
        )
        payload = {"credential_id": 1, "key_id": 2, "signer_name": "Alice"}

        # Act
        res = await client_full.post("/api/signatures/sign-pdf", json=payload)

        # Assert
        assert res.status_code == 401

    async def test_sign_route_forbidden_user_returns_403(self, client_full, fastapi_app_full):
        # Arrange
        def _forbidden():
            raise HTTPException(status_code=403, detail="Forbidden")

        fastapi_app_full.dependency_overrides[get_current_user] = _forbidden
        payload = {"credential_id": 1, "key_id": 2, "signer_name": "Alice"}

        # Act
        res = await client_full.post("/api/signatures/sign-pdf", json=payload)

        # Assert
        assert res.status_code == 403

    async def test_sign_route_invalid_payload_returns_422(
        self, client_full, override_current_user_full
    ):
        # Arrange
        invalid_payload = {"credential_id": 1}  # thiếu key_id và signer_name

        # Act
        res = await client_full.post("/api/signatures/sign-pdf", json=invalid_payload)

        # Assert
        assert res.status_code == 422
