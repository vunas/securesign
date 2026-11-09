from unittest.mock import AsyncMock

import pytest

from app.models.enums import UserRole

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
async def test_platform_admin_can_read_global_audit_logs(
    client_full, override_current_user_full, monkeypatch
):
    override_current_user_full.role = UserRole.PLATFORM_SUPER_ADMIN
    override_current_user_full.tenant_id = None
    monkeypatch.setattr(
        "app.routers.log_router.audit_log_repo.get_all",
        AsyncMock(return_value=[]),
    )

    response = await client_full.get("/api/logs/audit")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.integration
async def test_platform_admin_can_read_global_verification_logs(
    client_full, override_current_user_full, monkeypatch
):
    override_current_user_full.role = UserRole.PLATFORM_SUPER_ADMIN
    override_current_user_full.tenant_id = None
    monkeypatch.setattr(
        "app.routers.log_router.verify_log_repo.get_all",
        AsyncMock(return_value=[]),
    )

    response = await client_full.get("/api/logs/verify")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.integration
async def test_tenant_admin_reads_tenant_audit_and_own_legacy_logs(
    client_full, override_current_user_full, monkeypatch
):
    override_current_user_full.role = UserRole.TENANT_ADMIN
    get_by_tenant = AsyncMock(return_value=[])
    monkeypatch.setattr(
        "app.routers.log_router.audit_log_repo.get_by_tenant",
        get_by_tenant,
    )

    response = await client_full.get("/api/logs/audit")

    assert response.status_code == 200
    assert response.json() == []
    assert get_by_tenant.await_args.args[1:] == (1, 50, None, None, None, None, 999)


@pytest.mark.integration
async def test_tenant_admin_reads_tenant_verification_and_own_legacy_logs(
    client_full, override_current_user_full, monkeypatch
):
    override_current_user_full.role = UserRole.TENANT_ADMIN
    get_by_tenant = AsyncMock(return_value=[])
    monkeypatch.setattr(
        "app.routers.log_router.verify_log_repo.get_by_tenant",
        get_by_tenant,
    )

    response = await client_full.get("/api/logs/verify")

    assert response.status_code == 200
    assert response.json() == []
    assert get_by_tenant.await_args.args[1:] == (1, 50, None, None, None, 999)
