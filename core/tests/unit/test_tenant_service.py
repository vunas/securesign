from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.models.enums import TenantStatus, UserRole
from app.schemas.tenant_schema import TenantRegistration, TenantStatusUpdate
from app.services.tenant_service import TenantService


@pytest.mark.asyncio
async def test_register_creates_pending_tenant_and_tenant_admin(monkeypatch):
    service = TenantService()
    db = SimpleNamespace(
        scalar=AsyncMock(side_effect=[None, None]),
        add=Mock(),
        flush=AsyncMock(),
    )
    monkeypatch.setattr("app.services.tenant_service.log_service.log_action", AsyncMock())
    payload = TenantRegistration(
        tenant_code="uni",
        name="University",
        email="admin@example.test",
        admin_username="admin",
        admin_full_name="Organization Admin",
        password="a-strong-password",
    )

    tenant = await service.register(db, payload)

    assert tenant.tenant_code == "UNI"
    assert tenant.status == TenantStatus.PENDING
    created_user = db.add.call_args_list[1].args[0]
    assert created_user.role == UserRole.TENANT_ADMIN
    assert created_user.tenant_id == tenant.id
    assert created_user.password_hash != payload.password


@pytest.mark.asyncio
async def test_review_approval_creates_initial_quota(monkeypatch):
    service = TenantService()
    tenant = SimpleNamespace(
        id=9, tenant_code="UNI", name="University", status=TenantStatus.PENDING
    )
    reviewer = SimpleNamespace(id=4)
    db = SimpleNamespace(get=AsyncMock(return_value=tenant), add=Mock(), flush=AsyncMock())
    monkeypatch.setattr("app.services.tenant_service.log_service.log_action", AsyncMock())
    monkeypatch.setattr(
        "app.services.tenant_service.certificate_service.get_root_ca",
        AsyncMock(return_value=SimpleNamespace(subject="Platform Root", id=1)),
    )
    key_counter = iter([SimpleNamespace(id=11), SimpleNamespace(id=12)])
    monkeypatch.setattr(
        "app.services.tenant_service.key_service.create_key",
        AsyncMock(side_effect=lambda *args, **kwargs: next(key_counter)),
    )
    intermediate = SimpleNamespace(subject="Tenant Intermediate")
    monkeypatch.setattr(
        "app.services.tenant_service.certificate_service.create_signed_cert",
        AsyncMock(return_value=intermediate),
    )
    monkeypatch.setattr(
        "app.services.tenant_service.api_key_service.create",
        AsyncMock(return_value=(SimpleNamespace(id=4), "one-time-secret")),
    )

    result, api_key_secret = await service.review(
        db,
        tenant_id=9,
        request=TenantStatusUpdate(status=TenantStatus.ACTIVE),
        reviewer=reviewer,
    )

    quota = db.add.call_args.args[0]
    assert result is tenant
    assert api_key_secret == "one-time-secret"
    assert tenant.status == TenantStatus.ACTIVE
    assert quota.tenant_id == tenant.id
    assert quota.used_count == 0


@pytest.mark.asyncio
async def test_reject_review_requires_reason(monkeypatch):
    service = TenantService()
    tenant = SimpleNamespace(id=9, status=TenantStatus.PENDING)
    db = SimpleNamespace(get=AsyncMock(return_value=tenant))

    with pytest.raises(ValueError, match="lý do"):
        await service.review(
            db,
            tenant_id=9,
            request=TenantStatusUpdate(status=TenantStatus.REJECTED),
            reviewer=SimpleNamespace(id=4),
        )
