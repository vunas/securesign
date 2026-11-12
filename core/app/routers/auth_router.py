from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.dependencies import DatabaseDep
from app.services.auth_service import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    auth_service,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
async def login(
    response: Response,
    db: DatabaseDep,
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """Đăng nhập và Set HttpOnly Cookie"""
    try:
        user, access_token, refresh_token = await auth_service.authenticate_and_generate_tokens(
            db=db, username=form_data.username, password=form_data.password
        )
        initial_api_credentials = await auth_service.consume_initial_api_credentials(db, user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
    )

    return {
        "message": "Đăng nhập thành công",
        "username": user.username,
        "role": user.role.value,
        "initial_api_credentials": initial_api_credentials,
    }


@router.post("/refresh")
async def refresh_token(request: Request, response: Response, db: DatabaseDep):
    """Cấp lại Access Token mới dựa vào Refresh Cookie"""
    refresh_cookie = request.cookies.get("refresh_token")

    if not refresh_cookie:
        raise HTTPException(status_code=401, detail="Refresh token không tồn tại")

    try:
        new_access_token = await auth_service.refresh_access_token(
            db, refresh_token_str=refresh_cookie
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    response.set_cookie(
        key="access_token",
        value=f"Bearer {new_access_token}",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"message": "Token refreshed"}


@router.post("/logout")
async def logout(response: Response):
    """Xóa toàn bộ Cookie khi đăng xuất"""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Đăng xuất thành công"}
