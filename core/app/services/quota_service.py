from calendar import monthrange
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tenant import Tenant
from app.models.tenant_quota import TenantQuota


class QuotaExceededError(ValueError):
    pass


class QuotaService:
    async def get_current_quota(
        self, db: AsyncSession, tenant_id: int, lock: bool = False
    ) -> TenantQuota:
        today = date.today()
        statement = select(TenantQuota).where(
            TenantQuota.tenant_id == tenant_id,
            TenantQuota.period_start <= today,
            TenantQuota.period_end >= today,
        )
        if lock:
            statement = statement.with_for_update()
        result = await db.execute(statement)
        quota = result.scalar_one_or_none()

        if quota is None:
            period_start = today.replace(day=1)
            period_end = today.replace(day=monthrange(today.year, today.month)[1])
            quota = TenantQuota(
                tenant_id=tenant_id,
                monthly_limit=settings.DEFAULT_MONTHLY_SIGNING_LIMIT,
                used_count=0,
                period_start=period_start,
                period_end=period_end,
            )
            db.add(quota)
            await db.flush()
        return quota

    async def reserve_signing(self, db: AsyncSession, tenant_id: int) -> TenantQuota:
        await db.execute(select(Tenant.id).where(Tenant.id == tenant_id).with_for_update())
        quota = await self.get_current_quota(db, tenant_id, lock=True)
        if quota.used_count >= quota.monthly_limit:
            raise QuotaExceededError(
                "Đã hết hạn ngạch ký trong tháng. Vui lòng liên hệ quản trị viên."
            )
        quota.used_count += 1
        await db.flush()
        return quota


quota_service = QuotaService()
