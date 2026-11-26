from calendar import monthrange
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.tenant import Tenant
from app.models.tenant_quota import TenantQuota
from app.services.quota_service import QuotaExceededError, QuotaService

pytestmark = [pytest.mark.asyncio, pytest.mark.unit]


async def _create_tenant(db, tenant_code: str = "quota-test") -> Tenant:
    tenant = Tenant(
        tenant_code=tenant_code,
        name="Quota Test",
        email=f"{tenant_code}@example.test",
    )
    db.add(tenant)
    await db.flush()
    return tenant


async def test_get_current_quota_returns_tenant_quota_for_current_month(sqlite_db_session):
    today = date.today()
    tenant = await _create_tenant(sqlite_db_session)
    expected = TenantQuota(
        tenant_id=tenant.id,
        monthly_limit=12,
        used_count=4,
        period_start=today.replace(day=1),
        period_end=today.replace(day=monthrange(today.year, today.month)[1]),
    )
    sqlite_db_session.add(expected)
    await sqlite_db_session.flush()

    quota = await QuotaService().get_current_quota(sqlite_db_session, tenant.id)

    assert quota.id == expected.id
    assert quota.used_count == 4
    assert quota.monthly_limit == 12


async def test_get_current_quota_creates_current_month_period_when_missing(sqlite_db_session):
    today = date.today()
    tenant = await _create_tenant(sqlite_db_session)
    previous_end = today.replace(day=1) - timedelta(days=1)
    sqlite_db_session.add(
        TenantQuota(
            tenant_id=tenant.id,
            monthly_limit=12,
            used_count=12,
            period_start=previous_end.replace(day=1),
            period_end=previous_end,
        )
    )
    await sqlite_db_session.flush()

    quota = await QuotaService().get_current_quota(sqlite_db_session, tenant.id)

    assert quota.id is not None
    assert quota.period_start == today.replace(day=1)
    assert quota.period_end == today.replace(day=monthrange(today.year, today.month)[1])
    assert quota.monthly_limit == settings.DEFAULT_MONTHLY_SIGNING_LIMIT
    assert quota.used_count == 0


async def test_reserve_signing_increments_exactly_once(sqlite_db_session):
    tenant = await _create_tenant(sqlite_db_session)
    quota = TenantQuota(
        tenant_id=tenant.id,
        monthly_limit=3,
        used_count=1,
        period_start=date.today().replace(day=1),
        period_end=date.today().replace(day=monthrange(date.today().year, date.today().month)[1]),
    )
    sqlite_db_session.add(quota)
    await sqlite_db_session.flush()

    reserved = await QuotaService().reserve_signing(sqlite_db_session, tenant.id)

    assert reserved.used_count == 2
    await sqlite_db_session.refresh(quota)
    assert quota.used_count == 2


async def test_reserve_signing_does_not_increment_when_quota_is_exhausted(sqlite_db_session):
    tenant = await _create_tenant(sqlite_db_session)
    quota = TenantQuota(
        tenant_id=tenant.id,
        monthly_limit=1,
        used_count=1,
        period_start=date.today().replace(day=1),
        period_end=date.today().replace(day=monthrange(date.today().year, date.today().month)[1]),
    )
    sqlite_db_session.add(quota)
    await sqlite_db_session.flush()

    with pytest.raises(QuotaExceededError):
        await QuotaService().reserve_signing(sqlite_db_session, tenant.id)

    await sqlite_db_session.refresh(quota)
    assert quota.used_count == 1


async def test_signing_reservation_rolls_back_with_failed_transaction(sqlite_db_session):
    tenant = await _create_tenant(sqlite_db_session)
    quota = TenantQuota(
        tenant_id=tenant.id,
        monthly_limit=3,
        used_count=0,
        period_start=date.today().replace(day=1),
        period_end=date.today().replace(day=monthrange(date.today().year, date.today().month)[1]),
    )
    sqlite_db_session.add(quota)
    await sqlite_db_session.flush()
    quota_id = quota.id
    await sqlite_db_session.commit()

    with pytest.raises(RuntimeError, match="issuance failed"):
        async with sqlite_db_session.begin():
            await QuotaService().reserve_signing(sqlite_db_session, tenant.id)
            raise RuntimeError("issuance failed")

    persisted_count = await sqlite_db_session.scalar(
        select(TenantQuota.used_count).where(TenantQuota.id == quota_id)
    )
    assert persisted_count == 0
