from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user_schema import UserCreate


class UserRepository:
    async def get_by_username(self, db: AsyncSession, username: str):
        stmt = select(User).where(User.username == username)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, db: AsyncSession, user_id: int):
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self,
        db: AsyncSession,
        obj_in: UserCreate,
        tenant_id: int | None = None,
        role: UserRole = UserRole.TENANT_OPERATOR,
    ):
        resolved_tenant_id = tenant_id or getattr(obj_in, "tenant_id", None)
        if resolved_tenant_id is None:
            raise ValueError("Tenant ID là bắt buộc khi tạo tài khoản người dùng.")

        hashed_password = get_password_hash(obj_in.password)
        db_obj = User(
            username=obj_in.username,
            password_hash=hashed_password,
            tenant_id=resolved_tenant_id,
            role=getattr(obj_in, "role", role),
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj


user_repo = UserRepository()
