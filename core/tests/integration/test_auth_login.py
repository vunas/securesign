import pytest

from app.core.security import get_password_hash
from app.models.enums import TenantStatus, UserRole
from app.models.tenant import Tenant
from app.models.user import User

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
async def test_login_sets_http_only_cookies(client_full, db_session):
    # Validates: /auth/login authenticates and sets access/refresh cookies.
    tenant = Tenant(
        tenant_code="AUTH1",
        name="Auth Tenant",
        email="auth1@example.com",
        status=TenantStatus.ACTIVE,
    )
    db_session.add(tenant)
    await db_session.flush()
    u = User(
        username="alice",
        password_hash=get_password_hash("secret"),
        tenant_id=tenant.id,
        role=UserRole.TENANT_OPERATOR,
        is_active=True,
    )
    db_session.add(u)
    await db_session.commit()

    res = await client_full.post(
        "/auth/login",
        data={"username": "alice", "password": "secret"},
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 200, res.text

    # FastAPI/Starlette exposes cookies via Set-Cookie headers.
    set_cookie = "\n".join(res.headers.get_list("set-cookie"))
    assert "access_token=" in set_cookie
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie


@pytest.mark.integration
async def test_login_wrong_password_returns_401(client_full, db_session):
    # Validates: wrong password is rejected deterministically.
    tenant = Tenant(
        tenant_code="AUTH2",
        name="Auth Tenant 2",
        email="auth2@example.com",
        status=TenantStatus.ACTIVE,
    )
    db_session.add(tenant)
    await db_session.flush()
    u = User(
        username="bob",
        password_hash=get_password_hash("secret"),
        tenant_id=tenant.id,
        role=UserRole.TENANT_OPERATOR,
        is_active=True,
    )
    db_session.add(u)
    await db_session.commit()

    res = await client_full.post(
        "/auth/login",
        data={"username": "bob", "password": "wrong"},
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 401
