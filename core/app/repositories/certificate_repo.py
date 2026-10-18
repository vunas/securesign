from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.certificate import Certificate


class CertificateRepository:
    async def get_by_id(self, db: AsyncSession, cert_id: int, tenant_id: int | None = None):
        stmt = select(Certificate).where(Certificate.id == cert_id)
        if tenant_id is not None:
            stmt = stmt.where(Certificate.tenant_id == tenant_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_key_id(self, db: AsyncSession, key_id: int, tenant_id: int | None = None):
        stmt = select(Certificate).where(Certificate.key_id == key_id)
        if tenant_id is not None:
            stmt = stmt.where(Certificate.tenant_id == tenant_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_name(self, db: AsyncSession, name: str, tenant_id: int | None = None):
        stmt = select(Certificate).where(Certificate.cert_name == name)
        if tenant_id is not None:
            stmt = stmt.where(Certificate.tenant_id == tenant_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, **kwargs):
        kwargs.pop("user_id", None)
        db_obj = Certificate(**kwargs)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj


certificate_repo = CertificateRepository()
