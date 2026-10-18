from typing import Annotated, AsyncGenerator

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
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
