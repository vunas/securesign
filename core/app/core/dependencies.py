from typing import Annotated, AsyncGenerator

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.enums import TenantStatus, UserRole
from app.models.tenant import Tenant
from app.models.user import User


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DatabaseDep = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DatabaseDep,
    access_token: Annotated[str | None, Cookie()] = None,
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin (Token không hợp lệ hoặc đã hết hạn)",
    )

    if not access_token:
        raise credentials_exception

    token = access_token.removeprefix("Bearer ")

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def get_optional_current_user(
    db: DatabaseDep,
    access_token: Annotated[str | None, Cookie()] = None,
) -> User | None:
    if not access_token:
        return None

    try:
        token = access_token.removeprefix("Bearer ")
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        if not username:
            return None
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        return user if user and user.is_active else None
    except jwt.PyJWTError:
        return None


CurrentUserDep = Annotated[User, Depends(get_current_user)]


async def get_active_tenant_user(user: CurrentUserDep, db: DatabaseDep) -> User:
    if user.tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant role required.")
    tenant = await db.get(Tenant, user.tenant_id)
    if tenant is None or tenant.status != TenantStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản tổ chức chưa được kích hoạt.",
        )
    return user


ActiveTenantUserDep = Annotated[User, Depends(get_active_tenant_user)]


async def get_tenant_admin(user: ActiveTenantUserDep) -> User:
    if user.role != UserRole.TENANT_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ quản trị viên tổ chức được phép thực hiện thao tác này.",
        )
    return user


TenantAdminDep = Annotated[User, Depends(get_tenant_admin)]


async def get_platform_super_admin(user: CurrentUserDep) -> User:
    if user.role != UserRole.PLATFORM_SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ quản trị viên nền tảng được phép thực hiện thao tác này.",
        )
    return user


PlatformAdminDep = Annotated[User, Depends(get_platform_super_admin)]
