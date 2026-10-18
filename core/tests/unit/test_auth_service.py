from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.auth_service import AuthService

pytestmark = pytest.mark.asyncio


@pytest.fixture()
def auth_service():
    return AuthService()


class TestAuthService:
    async def test_register_user_new_username_creates_user(self, auth_service, monkeypatch):
        # Arrange
        user_in = SimpleNamespace(username="alice")
        created_user = SimpleNamespace(id=1, username="alice", tenant_id=None)
        monkeypatch.setattr(
            "app.services.auth_service.user_repo.get_by_username",
            AsyncMock(return_value=None),
        )
        monkeypatch.setattr(
            "app.services.auth_service.user_repo.create",
            AsyncMock(return_value=created_user),
        )
        monkeypatch.setattr("app.services.auth_service.log_service.log_action", AsyncMock())

        # Act
        result = await auth_service.register_user(db=object(), user_in=user_in)

        # Assert
        assert result == created_user

    async def test_register_user_existing_username_raises_value_error(
        self, auth_service, monkeypatch
    ):
        # Arrange
        user_in = SimpleNamespace(username="alice")
        monkeypatch.setattr(
            "app.services.auth_service.user_repo.get_by_username",
            AsyncMock(return_value=SimpleNamespace(id=1, username="alice")),
        )

        # Act / Assert
        with pytest.raises(ValueError, match="đã tồn tại"):
            await auth_service.register_user(db=object(), user_in=user_in)

    async def test_authenticate_and_generate_tokens_valid_credentials_returns_tokens(
        self, auth_service, monkeypatch
    ):
        # Arrange
        user = SimpleNamespace(
            id=1, username="alice", password_hash="hashed", is_active=True, tenant_id=None
        )
        monkeypatch.setattr(
            "app.services.auth_service.user_repo.get_by_username",
            AsyncMock(return_value=user),
        )
        monkeypatch.setattr(
            "app.services.auth_service.verify_password",
            lambda plain, hashed: True,
        )
        monkeypatch.setattr(
            "app.services.auth_service.create_access_token",
            lambda data, expires_delta: "access-token",
        )
        monkeypatch.setattr(
            "app.services.auth_service.create_refresh_token",
            lambda data, expires_delta: "refresh-token",
        )
        monkeypatch.setattr("app.services.auth_service.log_service.log_action", AsyncMock())

        # Act
        out_user, access, refresh = await auth_service.authenticate_and_generate_tokens(
            db=object(), username="alice", password="secret"
        )

        # Assert
        assert out_user == user
        assert access == "access-token"
        assert refresh == "refresh-token"

    async def test_authenticate_and_generate_tokens_wrong_password_raises_value_error(
        self, auth_service, monkeypatch
    ):
        # Arrange
        user = SimpleNamespace(id=1, username="alice", password_hash="hashed", is_active=True)
        monkeypatch.setattr(
            "app.services.auth_service.user_repo.get_by_username",
            AsyncMock(return_value=user),
        )
        monkeypatch.setattr(
            "app.services.auth_service.verify_password",
            lambda plain, hashed: False,
        )

        # Act / Assert
        with pytest.raises(ValueError, match="Sai tên đăng nhập hoặc mật khẩu"):
            await auth_service.authenticate_and_generate_tokens(
                db=object(), username="alice", password="wrong"
            )

    async def test_refresh_access_token_empty_token_raises_value_error(self, auth_service):
        # Arrange / Act / Assert
        with pytest.raises(ValueError, match="không tồn tại"):
            await auth_service.refresh_access_token(db=object(), refresh_token_str="")

    async def test_refresh_access_token_invalid_token_raises_value_error(
        self, auth_service, monkeypatch
    ):
        # Arrange
        monkeypatch.setattr(
            "app.services.auth_service.decode_token",
            lambda token: (_ for _ in ()).throw(Exception("invalid")),
        )

        # Act / Assert
        with pytest.raises(ValueError, match="hết hạn hoặc không hợp lệ"):
            await auth_service.refresh_access_token(db=object(), refresh_token_str="bad")

    async def test_refresh_access_token_inactive_user_raises_value_error(
        self, auth_service, monkeypatch
    ):
        # Arrange
        monkeypatch.setattr(
            "app.services.auth_service.decode_token",
            lambda token: {"sub": "alice"},
        )
        monkeypatch.setattr(
            "app.services.auth_service.user_repo.get_by_username",
            AsyncMock(return_value=SimpleNamespace(username="alice", is_active=False)),
        )

        # Act / Assert
        with pytest.raises(ValueError, match="Tài khoản bị khóa"):
            await auth_service.refresh_access_token(db=object(), refresh_token_str="ok")
