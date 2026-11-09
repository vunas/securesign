from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKey


class ApiKeyRepository:
    async def get_all_by_tenant(self, db: AsyncSession, tenant_id: int) -> list[ApiKey]:
        result = await db.execute(
            select(ApiKey).where(ApiKey.tenant_id == tenant_id).order_by(ApiKey.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, db: AsyncSession, api_key_id: int, tenant_id: int) -> ApiKey | None:
        return await db.scalar(
            select(ApiKey).where(
                ApiKey.id == api_key_id,
                ApiKey.tenant_id == tenant_id,
            )
        )


api_key_repo = ApiKeyRepository()
