from datetime import datetime

from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.verify_log import VerifyLog


class VerifyLogRepository:
    async def get_all(
        self,
        db: AsyncSession,
        limit: int = 50,
        valid: bool | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> list[VerifyLog]:
        statement = select(VerifyLog)
        if valid is not None:
            statement = statement.where(VerifyLog.is_valid.is_(valid))
        if since:
            statement = statement.where(VerifyLog.created_at >= since)
        if until:
            statement = statement.where(VerifyLog.created_at <= until)
        result = await db.execute(statement.order_by(desc(VerifyLog.created_at)).limit(limit))
        return list(result.scalars().all())

    async def get_by_user(self, db: AsyncSession, user_id: int, limit: int = 50) -> list[VerifyLog]:
        result = await db.execute(
            select(VerifyLog)
            .filter(VerifyLog.verified_by_user_id == user_id)
            .order_by(desc(VerifyLog.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_tenant(
        self,
        db: AsyncSession,
        tenant_id: int,
        limit: int = 50,
        valid: bool | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
        user_id: int | None = None,
    ) -> list[VerifyLog]:
        tenant_scope = VerifyLog.tenant_id == tenant_id
        if user_id is not None:
            tenant_scope = or_(
                tenant_scope,
                and_(
                    VerifyLog.tenant_id.is_(None),
                    VerifyLog.verified_by_user_id == user_id,
                ),
            )
        statement = select(VerifyLog).where(tenant_scope)
        if valid is not None:
            statement = statement.where(VerifyLog.is_valid.is_(valid))
        if since:
            statement = statement.where(VerifyLog.created_at >= since)
        if until:
            statement = statement.where(VerifyLog.created_at <= until)
        result = await db.execute(statement.order_by(desc(VerifyLog.created_at)).limit(limit))
        return list(result.scalars().all())


verify_log_repo = VerifyLogRepository()
