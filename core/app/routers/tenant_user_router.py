from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import DatabaseDep, TenantAdminDep
from app.schemas.user_schema import (
    TenantUserCreate,
    TenantUserResponse,
    TenantUserStatusUpdate,
)
from app.services.tenant_user_service import tenant_user_service

router = APIRouter(prefix="/api/tenant/users", tags=["Tenant Users"])


@router.get("/", response_model=list[TenantUserResponse])
async def list_tenant_users(db: DatabaseDep, admin: TenantAdminDep):
    if admin.tenant_id is None:
        raise HTTPException(status_code=403, detail="Tenant role required.")
    return await tenant_user_service.list_users(db, admin.tenant_id)


@router.post("/", response_model=TenantUserResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant_operator(
    payload: TenantUserCreate, db: DatabaseDep, admin: TenantAdminDep
):
    if admin.tenant_id is None:
        raise HTTPException(status_code=403, detail="Tenant role required.")
    try:
        return await tenant_user_service.create_operator(
            db, admin.tenant_id, payload, admin
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/{user_id}", response_model=TenantUserResponse)
async def update_tenant_operator(
    user_id: int,
    payload: TenantUserStatusUpdate,
    db: DatabaseDep,
    admin: TenantAdminDep,
):
    if admin.tenant_id is None:
        raise HTTPException(status_code=403, detail="Tenant role required.")
    user = await tenant_user_service.set_operator_active(
        db, admin.tenant_id, user_id, payload.is_active, admin
    )
    if user is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên.")
    return user
