import hashlib
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.dependencies import (
    get_active_tenant_user,
    get_current_user,
    get_db,
    get_optional_current_user,
    get_platform_super_admin,
    get_tenant_admin,
)
from app.core.security import create_access_token
from app.models.api_key import ApiKey
from app.models.audit_log import AuditLog
from app.models.enums import TenantStatus, UserRole
from app.models.tenant import Tenant
from app.models.user import User
from app.routers.api_key_router import get_api_key

pytestmark = [pytest.mark.asyncio, pytest.mark.unit]


async def test_tenant_operator_is_denied_admin_dependencies():
    operator = SimpleNamespace(role=UserRole.TENANT_OPERATOR)

    with pytest.raises(HTTPException) as tenant_admin_error:
        await get_tenant_admin(user=operator)
    with pytest.raises(HTTPException) as platform_admin_error:
        await get_platform_super_admin(user=operator)

    assert tenant_admin_error.value.status_code == 403
    assert platform_admin_error.value.status_code == 403


async def test_admin_dependencies_accept_their_respective_roles():
    tenant_admin = SimpleNamespace(role=UserRole.TENANT_ADMIN)
    platform_admin = SimpleNamespace(role=UserRole.PLATFORM_SUPER_ADMIN)

    assert await get_tenant_admin(user=tenant_admin) is tenant_admin
    assert await get_platform_super_admin(user=platform_admin) is platform_admin


@pytest.mark.parametrize(
    "token",
    [
        "not-a-jwt",
        create_access_token({"sub": "expired-user"}, expires_delta=timedelta(seconds=-1)),
    ],
)
async def test_get_current_user_rejects_invalid_or_expired_token(sqlite_db_session, token):
    with pytest.raises(HTTPException) as exc:
        await get_current_user(db=sqlite_db_session, access_token=token)

    assert exc.value.status_code == 401


async def test_get_current_user_rejects_inactive_user(sqlite_db_session):
    tenant = Tenant(
        tenant_code="inactive-user",
        name="Inactive User Tenant",
        email="inactive@example.test",
    )
    sqlite_db_session.add(tenant)
    await sqlite_db_session.flush()
    sqlite_db_session.add(
        User(
            tenant_id=tenant.id,
            username="inactive-user",
            password_hash="hash",
            role=UserRole.TENANT_OPERATOR,
            is_active=False,
        )
    )
    await sqlite_db_session.flush()
    token = create_access_token({"sub": "inactive-user"})

    with pytest.raises(HTTPException) as exc:
        await get_current_user(db=sqlite_db_session, access_token=token)

    assert exc.value.status_code == 401


async def test_get_current_user_accepts_active_user_with_valid_token(sqlite_db_session):
    tenant = Tenant(
        tenant_code="active-user",
        name="Active User Tenant",
        email="active@example.test",
    )
    sqlite_db_session.add(tenant)
    await sqlite_db_session.flush()
    expected_user = User(
        tenant_id=tenant.id,
        username="active-user",
        password_hash="hash",
        role=UserRole.TENANT_OPERATOR,
        is_active=True,
    )
    sqlite_db_session.add(expected_user)
    await sqlite_db_session.flush()

    user = await get_current_user(
        db=sqlite_db_session,
        access_token=create_access_token({"sub": "active-user"}),
    )

    assert user.id == expected_user.id


async def test_optional_current_user_handles_missing_and_invalid_tokens(sqlite_db_session):
    assert await get_optional_current_user(db=sqlite_db_session, access_token=None) is None
    assert (
        await get_optional_current_user(db=sqlite_db_session, access_token="invalid-token") is None
    )


async def test_optional_current_user_returns_active_user_but_ignores_inactive_user(
    sqlite_db_session,
):
    tenant = Tenant(
        tenant_code="optional-user",
        name="Optional User Tenant",
        email="optional@example.test",
    )
    sqlite_db_session.add(tenant)
    await sqlite_db_session.flush()
    active_user = User(
        tenant_id=tenant.id,
        username="optional-active",
        password_hash="hash",
        role=UserRole.TENANT_OPERATOR,
        is_active=True,
    )
    inactive_user = User(
        tenant_id=tenant.id,
        username="optional-inactive",
        password_hash="hash",
        role=UserRole.TENANT_OPERATOR,
        is_active=False,
    )
    sqlite_db_session.add_all([active_user, inactive_user])
    await sqlite_db_session.flush()

    active_result = await get_optional_current_user(
        db=sqlite_db_session,
        access_token=create_access_token({"sub": active_user.username}),
    )
    inactive_result = await get_optional_current_user(
        db=sqlite_db_session,
        access_token=create_access_token({"sub": inactive_user.username}),
    )

    assert active_result.id == active_user.id
    assert inactive_result is None


@pytest.mark.parametrize(
    ("tenant_status", "tenant_id"),
    [(TenantStatus.PENDING, 1), (TenantStatus.ACTIVE, None)],
)
async def test_active_tenant_dependency_denies_unapproved_or_unassigned_users(
    sqlite_db_session, tenant_status, tenant_id
):
    tenant = Tenant(
        tenant_code=f"blocked-tenant-{tenant_status.value.lower()}",
        name="Blocked Tenant",
        email=f"blocked-{tenant_status.value.lower()}@example.test",
        status=tenant_status,
    )
    sqlite_db_session.add(tenant)
    await sqlite_db_session.flush()
    user = SimpleNamespace(tenant_id=tenant.id if tenant_id is not None else None)

    with pytest.raises(HTTPException) as exc:
        await get_active_tenant_user(user=user, db=sqlite_db_session)

    assert exc.value.status_code == 403


async def test_get_api_key_accepts_valid_key_and_rejects_wrong_or_revoked_key(
    sqlite_db_session,
):
    tenant = Tenant(
        tenant_code="api-key-tenant",
        name="API Key Tenant",
        email="api-key@example.test",
        status=TenantStatus.ACTIVE,
    )
    sqlite_db_session.add(tenant)
    await sqlite_db_session.flush()
    secret = "ss_live_valid-test-key"
    api_key = ApiKey(
        tenant_id=tenant.id,
        name="Test integration",
        key_prefix=secret[:16],
        key_hash=hashlib.sha256(secret.encode("utf-8")).hexdigest(),
        is_active=True,
        rate_limit_per_min=10,
    )
    sqlite_db_session.add(api_key)
    await sqlite_db_session.flush()

    authenticated_key = await get_api_key(db=sqlite_db_session, x_api_key=secret)

    assert authenticated_key.id == api_key.id
    assert api_key.last_used_at is not None
    assert await sqlite_db_session.scalar(
        select(AuditLog.id).where(
            AuditLog.action == "API_KEY_REQUEST",
            AuditLog.target_id == str(api_key.id),
        )
    )

    with pytest.raises(HTTPException) as wrong_key_error:
        await get_api_key(db=sqlite_db_session, x_api_key="ss_live_wrong-key")
    assert wrong_key_error.value.status_code == 401

    api_key.is_active = False
    await sqlite_db_session.flush()
    with pytest.raises(HTTPException) as revoked_key_error:
        await get_api_key(db=sqlite_db_session, x_api_key=secret)
    assert revoked_key_error.value.status_code == 401


async def test_get_api_key_rejects_expired_key(sqlite_db_session):
    tenant = Tenant(
        tenant_code="expired-key-tenant",
        name="Expired Key Tenant",
        email="expired-key@example.test",
        status=TenantStatus.ACTIVE,
    )
    sqlite_db_session.add(tenant)
    await sqlite_db_session.flush()
    secret = "ss_live_expired-test-key"
    sqlite_db_session.add(
        ApiKey(
            tenant_id=tenant.id,
            name="Expired integration",
            key_prefix=secret[:16],
            key_hash=hashlib.sha256(secret.encode("utf-8")).hexdigest(),
            is_active=True,
            rate_limit_per_min=10,
            expires_at=datetime.now(UTC) - timedelta(seconds=1),
        )
    )
    await sqlite_db_session.flush()

    with pytest.raises(HTTPException) as exc:
        await get_api_key(db=sqlite_db_session, x_api_key=secret)

    assert exc.value.status_code == 401


async def test_get_api_key_rejects_missing_header_inactive_tenant_and_rate_limit(
    sqlite_db_session,
):
    with pytest.raises(HTTPException) as missing_header:
        await get_api_key(db=sqlite_db_session, x_api_key=None)
    assert missing_header.value.status_code == 401

    inactive_tenant = Tenant(
        tenant_code="inactive-api-tenant",
        name="Inactive API Tenant",
        email="inactive-api@example.test",
        status=TenantStatus.PENDING,
    )
    active_tenant = Tenant(
        tenant_code="limited-api-tenant",
        name="Limited API Tenant",
        email="limited-api@example.test",
        status=TenantStatus.ACTIVE,
    )
    sqlite_db_session.add_all([inactive_tenant, active_tenant])
    await sqlite_db_session.flush()
    inactive_secret = "ss_live_inactive-tenant"
    limited_secret = "ss_live_rate-limited"
    inactive_key = ApiKey(
        tenant_id=inactive_tenant.id,
        name="Inactive tenant key",
        key_prefix=inactive_secret[:16],
        key_hash=hashlib.sha256(inactive_secret.encode("utf-8")).hexdigest(),
        is_active=True,
        rate_limit_per_min=10,
    )
    limited_key = ApiKey(
        tenant_id=active_tenant.id,
        name="Rate-limited key",
        key_prefix=limited_secret[:16],
        key_hash=hashlib.sha256(limited_secret.encode("utf-8")).hexdigest(),
        is_active=True,
        rate_limit_per_min=1,
    )
    sqlite_db_session.add_all([inactive_key, limited_key])
    await sqlite_db_session.flush()
    sqlite_db_session.add(
        AuditLog(
            tenant_id=active_tenant.id,
            action="API_KEY_REQUEST",
            target_id=str(limited_key.id),
            created_at=datetime.now(UTC),
        )
    )
    await sqlite_db_session.flush()

    with pytest.raises(HTTPException) as inactive_error:
        await get_api_key(db=sqlite_db_session, x_api_key=inactive_secret)
    with pytest.raises(HTTPException) as limited_error:
        await get_api_key(db=sqlite_db_session, x_api_key=limited_secret)

    assert inactive_error.value.status_code == 403
    assert limited_error.value.status_code == 429
    assert limited_error.value.headers["Retry-After"] == "60"


async def test_get_db_commits_successful_session_and_rolls_back_errors(monkeypatch):
    session = SimpleNamespace(
        commit=AsyncMock(),
        rollback=AsyncMock(),
        close=AsyncMock(),
    )
    monkeypatch.setattr("app.core.dependencies.AsyncSessionLocal", lambda: session)

    successful_session = get_db()
    assert await anext(successful_session) is session
    with pytest.raises(StopAsyncIteration):
        await anext(successful_session)
    session.commit.assert_awaited_once()
    session.close.assert_awaited_once()

    session.commit.reset_mock()
    session.close.reset_mock()
    failed_session = get_db()
    assert await anext(failed_session) is session
    with pytest.raises(RuntimeError, match="transaction failed"):
        await failed_session.athrow(RuntimeError("transaction failed"))
    session.rollback.assert_awaited_once()
    session.close.assert_awaited_once()
