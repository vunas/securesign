from datetime import datetime

from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.enums import ActionStatus


class AuditLogRepository:
    async def get_all(
        self,
        db: AsyncSession,
        limit: int = 50,
        action: str | None = None,
        status: ActionStatus | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> list[AuditLog]:
        statement = select(AuditLog)
        if action:
            statement = statement.where(AuditLog.action == action)
        if status:
            statement = statement.where(AuditLog.status == status)
        if since:
            statement = statement.where(AuditLog.created_at >= since)
        if until:
            statement = statement.where(AuditLog.created_at <= until)
        result = await db.execute(statement.order_by(desc(AuditLog.created_at)).limit(limit))
        return list(result.scalars().all())

    async def get_by_user(self, db: AsyncSession, user_id: int, limit: int = 50) -> list[AuditLog]:
        result = await db.execute(
            select(AuditLog)
            .filter(AuditLog.user_id == user_id)
            .order_by(desc(AuditLog.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_tenant(
        self,
        db: AsyncSession,
        tenant_id: int,
        limit: int = 50,
        action: str | None = None,
        status: ActionStatus | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
        user_id: int | None = None,
    ) -> list[AuditLog]:
        tenant_scope = AuditLog.tenant_id == tenant_id
        if user_id is not None:
            tenant_scope = or_(
                tenant_scope,
                and_(AuditLog.tenant_id.is_(None), AuditLog.user_id == user_id),
            )
        statement = select(AuditLog).where(tenant_scope)
        if action:
            statement = statement.where(AuditLog.action == action)
        if status:
            statement = statement.where(AuditLog.status == status)
        if since:
            statement = statement.where(AuditLog.created_at >= since)
        if until:
            statement = statement.where(AuditLog.created_at <= until)
        result = await db.execute(statement.order_by(desc(AuditLog.created_at)).limit(limit))
        return list(result.scalars().all())


audit_log_repo = AuditLogRepository()
