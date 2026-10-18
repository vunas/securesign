from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.signature import Signature


class SignatureRepository:
    async def get_by_credential(self, db: AsyncSession, credential_id: int):
        stmt = select(Signature).where(Signature.credential_id == credential_id)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def create(self, db: AsyncSession, **kwargs):
        db_obj = Signature(**kwargs)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj


signature_repo = SignatureRepository()
