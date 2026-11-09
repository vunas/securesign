import hashlib
import secrets
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKey
from app.models.enums import TargetResourceType
from app.repositories.api_key_repo import api_key_repo
from app.schemas.api_key_schema import ApiKeyCreate
from app.services.log_service import log_service


class ApiKeyService:
    async def create(
        self,
        db: AsyncSession,
        tenant_id: int,
        request: ApiKeyCreate,
        user_id: int,
    ) -> tuple[ApiKey, str]:
        if request.expires_at is not None and request.expires_at <= datetime.now(UTC):
            raise ValueError("Thời điểm hết hạn phải nằm trong tương lai.")
        secret = f"ss_live_{secrets.token_urlsafe(32)}"
        api_key = ApiKey(
            tenant_id=tenant_id,
            name=request.name.strip(),
            key_prefix=secret[:16],
            key_hash=hashlib.sha256(secret.encode("utf-8")).hexdigest(),
            rate_limit_per_min=request.rate_limit_per_min,
            expires_at=request.expires_at,
            is_active=True,
        )
        db.add(api_key)
        await db.flush()
        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            action="CREATE_API_KEY",
            target_type=TargetResourceType.SYSTEM,
            target_id=str(api_key.id),
            payload={"name": api_key.name, "key_prefix": api_key.key_prefix},
        )
        return api_key, secret

    async def revoke(
        self, db: AsyncSession, api_key_id: int, tenant_id: int, user_id: int
    ) -> ApiKey | None:
        api_key = await api_key_repo.get_by_id(db, api_key_id, tenant_id)
        if api_key is None:
            return None
        api_key.is_active = False
        await db.flush()
        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            action="REVOKE_API_KEY",
            target_type=TargetResourceType.SYSTEM,
            target_id=str(api_key.id),
            payload={"key_prefix": api_key.key_prefix},
        )
        return api_key


api_key_service = ApiKeyService()
