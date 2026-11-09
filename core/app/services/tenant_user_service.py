from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.enums import TargetResourceType, UserRole
from app.models.user import User
from app.schemas.user_schema import TenantUserCreate
from app.services.log_service import log_service


class TenantUserService:
    async def list_users(self, db: AsyncSession, tenant_id: int) -> list[User]:
        result = await db.execute(
            select(User).where(User.tenant_id == tenant_id).order_by(User.created_at.desc())
        )
        return list(result.scalars().all())

    async def create_operator(
        self, db: AsyncSession, tenant_id: int, payload: TenantUserCreate, actor: User
    ) -> User:
        username = payload.username.strip()
        email = payload.email.strip().lower()
        if not username or not email or not payload.full_name.strip():
            raise ValueError("Tên đăng nhập, email và họ tên không được để trống.")
        if len(payload.password.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu không được vượt quá 72 byte UTF-8.")

        duplicate = await db.scalar(
            select(User).where(or_(User.username == username, User.email == email))
        )
        if duplicate:
            raise ValueError("Tên đăng nhập hoặc email đã được sử dụng.")

        user = User(
            tenant_id=tenant_id,
            username=username,
            email=email,
            full_name=payload.full_name.strip(),
            password_hash=get_password_hash(payload.password),
            role=UserRole.TENANT_OPERATOR,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=actor.id,
            action="CREATE_TENANT_OPERATOR",
            target_type=TargetResourceType.USER,
            target_id=str(user.id),
            payload={"username": username, "email": email},
        )
        return user

    async def set_operator_active(
        self, db: AsyncSession, tenant_id: int, user_id: int, is_active: bool, actor: User
    ) -> User | None:
        user = await db.scalar(
            select(User).where(
                User.id == user_id,
                User.tenant_id == tenant_id,
                User.role == UserRole.TENANT_OPERATOR,
            )
        )
        if user is None:
            return None
        user.is_active = is_active
        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=actor.id,
            action="ACTIVATE_TENANT_OPERATOR" if is_active else "DEACTIVATE_TENANT_OPERATOR",
            target_type=TargetResourceType.USER,
            target_id=str(user.id),
            payload={"username": user.username},
        )
        await db.flush()
        return user


tenant_user_service = TenantUserService()
