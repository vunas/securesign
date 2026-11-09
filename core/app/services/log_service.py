from datetime import UTC, datetime

from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.request_context import request_ip, request_user_agent
from app.models.audit_log import AuditLog
from app.models.enums import ActionStatus, LogLevel, TargetResourceType
from app.services.audit_integrity import create_audit_hash, verify_audit_hash


class LogService:
    async def log_action(
        self,
        db: AsyncSession,
        user_id: int | None,
        action: str,
        target_type: TargetResourceType,
        target_id: str,
        tenant_id: int | None = None,
        level: LogLevel = LogLevel.INFO,
        status: ActionStatus = ActionStatus.SUCCESS,
        payload: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditLog:
        ip_address = ip_address or request_ip.get()
        user_agent = user_agent or request_user_agent.get()
        get_bind = getattr(db, "get_bind", None)
        if get_bind and get_bind().dialect.name == "postgresql":
            await db.execute(text("SELECT pg_advisory_xact_lock(602819734)"))
        result = await db.execute(select(AuditLog).order_by(desc(AuditLog.id)).limit(1))
        last_log_record = result.scalars().first()
        previous_hash = (
            last_log_record.log_hash
            if last_log_record and last_log_record.log_hash
            else "GENESIS_HASH"
        )

        created_at = datetime.now(UTC)
        hash_data = {
            "previous_hash": previous_hash,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "action": action,
            "target_type": target_type,
            "target_id": str(target_id) if target_id else None,
            "level": level,
            "status": status,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "payload": payload,
            "created_at": created_at,
        }
        current_hash = create_audit_hash(settings.SECRET_KEY, **hash_data)

        new_log = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id else None,
            level=level,
            status=status,
            ip_address=ip_address,
            user_agent=user_agent,
            payload=payload,
            log_hash=current_hash,
            created_at=created_at,
        )
        db.add(new_log)
        await db.flush()
        return new_log

    async def verify_chain(self, db: AsyncSession) -> dict:
        result = await db.execute(select(AuditLog).order_by(AuditLog.id))
        entries = result.scalars().all()
        previous_hash = "GENESIS_HASH"
        legacy_count = 0
        for index, entry in enumerate(entries, start=1):
            if not (entry.log_hash or "").startswith("hmac-sha256:"):
                legacy_count += 1
            if not verify_audit_hash(settings.SECRET_KEY, entry, previous_hash):
                return {
                    "valid": False,
                    "checked_entries": index,
                    "legacy_entries": legacy_count,
                    "invalid_entry_id": entry.id,
                }
            previous_hash = entry.log_hash
        return {
            "valid": True,
            "checked_entries": len(entries),
            "legacy_entries": legacy_count,
            "invalid_entry_id": None,
        }


log_service = LogService()
