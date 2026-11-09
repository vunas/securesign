from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.certificate import Certificate
from app.models.enums import CertType
from app.models.key import Key


class KeyRepository:
    async def get_by_id(self, db: AsyncSession, key_id: int, tenant_id: int):
        stmt = select(Key).where(Key.id == key_id, Key.tenant_id == tenant_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_by_tenant(self, db: AsyncSession, tenant_id: int):
        stmt = select(Key).where(Key.tenant_id == tenant_id)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_signing_keys(self, db: AsyncSession, tenant_id: int):
        result = await db.execute(
            select(Key)
            .join(Certificate, Certificate.key_id == Key.id)
            .where(
                Key.tenant_id == tenant_id,
                Key.is_revoked.is_(False),
                Certificate.tenant_id == tenant_id,
                Certificate.cert_type == CertType.END_ENTITY,
                Certificate.purpose == "document_signing",
                Certificate.is_revoked.is_(False),
            )
            .order_by(Key.created_at.desc())
        )
        return list(result.scalars().all())

    get_all_by_user = get_all_by_tenant

    async def create(self, db: AsyncSession, **kwargs):
        db_obj = Key(**kwargs)
        db.add(db_obj)
        await db.flush()  # Thay commit() bằng flush()
        await db.refresh(db_obj)
        return db_obj


key_repo = KeyRepository()
