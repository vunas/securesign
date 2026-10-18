from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)

# Centralized Enums
from app.models.enums import TargetResourceType
from app.repositories.user_repo import user_repo
from app.schemas.user_schema import UserCreate
from app.services.log_service import log_service

ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


class AuthService:
    async def register_user(self, db: AsyncSession, user_in: UserCreate):
        user = await user_repo.get_by_username(db, username=user_in.username)
        if user:
            raise ValueError("Tên đăng nhập đã tồn tại")

        created_user = await user_repo.create(db, obj_in=user_in)

        await log_service.log_action(
            db=db,
            tenant_id=created_user.tenant_id,
            user_id=created_user.id,
            action="REGISTER_USER",
            target_type=TargetResourceType.USER,
            target_id=str(created_user.id),
            payload={"username": created_user.username},
        )
        return created_user

    async def authenticate_and_generate_tokens(
        self, db: AsyncSession, username: str, password: str
    ):
        user = await user_repo.get_by_username(db, username=username)

        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Sai tên đăng nhập hoặc mật khẩu")

        if not user.is_active:
            raise ValueError("Tài khoản của bạn đã bị khóa.")

        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        refresh_token = create_refresh_token(
            data={"sub": user.username}, expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        )

        await log_service.log_action(
            db=db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            action="USER_LOGIN",
            target_type=TargetResourceType.USER,
            target_id=str(user.id),
            payload={"username": user.username},
        )
        return user, access_token, refresh_token

    async def refresh_access_token(self, db: AsyncSession, refresh_token_str: str):
        if not refresh_token_str:
            raise ValueError("Refresh token không tồn tại")

        try:
            payload = decode_token(refresh_token_str)
            username = payload.get("sub")
            if not username:
                raise ValueError("Token không hợp lệ")
        except Exception:
            raise ValueError("Refresh token đã hết hạn hoặc không hợp lệ")

        user = await user_repo.get_by_username(db, username=username)
        if not user or not user.is_active:
            raise ValueError("Tài khoản bị khóa hoặc không tồn tại")

        new_access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        return new_access_token


auth_service = AuthService()
