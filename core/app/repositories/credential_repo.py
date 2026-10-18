from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credential import Credential
from app.models.enums import CredentialStatus


class CredentialRepository:
    async def get_by_id(self, db: AsyncSession, credential_id: int, tenant_id: int):
        stmt = select(Credential).where(
            Credential.id == credential_id, Credential.tenant_id == tenant_id
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_by_tenant(self, db: AsyncSession, tenant_id: int):
        stmt = (
            select(Credential)
            .where(Credential.tenant_id == tenant_id)
            .order_by(Credential.created_at.desc())
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    async def create(self, db: AsyncSession, **kwargs):
        db_obj = Credential(**kwargs)
        db.add(db_obj)
        await db.flush()
        return db_obj

    async def update_status(
        self,
        db: AsyncSession,
        db_obj: Credential,
        status: CredentialStatus,
        signed_hash: str | None = None,
    ):
        db_obj.status = status
        if signed_hash:
            db_obj.signed_hash = signed_hash
        await db.flush()
        return db_obj


credential_repo = CredentialRepository()
