import hashlib
import json

from fastapi.encoders import jsonable_encoder
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.enums import ActionStatus, LogLevel, TargetResourceType
from app.utils.logger import logger


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
        payload: dict = None,
        ip_address: str = None,
        user_agent: str = None,
    ):
        try:
            result = await db.execute(select(AuditLog).order_by(desc(AuditLog.id)).limit(1))
            last_log_record = result.scalars().first()
            previous_hash = (
                last_log_record.log_hash
                if last_log_record and last_log_record.log_hash
                else "GENESIS_HASH"
            )

            safe_payload = json.dumps(jsonable_encoder(payload or {}), sort_keys=True)
            data_to_hash = f"{previous_hash}|{tenant_id}|{user_id}|{action}|{target_type}|{target_id}|{status}|{safe_payload}"
            current_hash = hashlib.sha256(data_to_hash.encode("utf-8")).hexdigest()

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
            )

            db.add(new_log)
            await db.flush()
            return new_log

        except Exception as e:
            logger.error(f"Lỗi ghi Audit Log: {str(e)}")
            pass


log_service = LogService()
