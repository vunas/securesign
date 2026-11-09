from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.core.dependencies import DatabaseDep, PlatformAdminDep
from app.models.enums import TenantStatus
from app.models.tenant_quota import TenantQuota
from app.schemas.tenant_schema import (
    TenantAdminResponse,
    TenantProvisionedResponse,
    TenantQuotaUpdate,
    TenantRegistration,
    TenantRegistrationResponse,
    TenantResponse,
    TenantStatusChange,
    TenantStatusUpdate,
)
from app.services.tenant_service import tenant_service

router = APIRouter(tags=["Tenants"])


@router.post(
    "/auth/register",
    response_model=TenantRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/api/tenants/register",
    response_model=TenantRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_tenant(payload: TenantRegistration, db: DatabaseDep):
    try:
        tenant = await tenant_service.register(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return {
        "tenant_code": tenant.tenant_code,
        "status": tenant.status,
        "message": "Đăng ký đã được tiếp nhận và đang chờ xét duyệt.",
    }


@router.get(
    "/api/admin/tenants",
    response_model=list[TenantAdminResponse],
)
async def list_tenants(
    db: DatabaseDep,
    _: PlatformAdminDep,
    tenant_status: TenantStatus | None = Query(default=None, alias="status"),
):
    tenants = await tenant_service.list_tenants(db, tenant_status)
    responses = []
    today = date.today()
    for tenant in tenants:
        quota = await db.scalar(
            select(TenantQuota).where(
                TenantQuota.tenant_id == tenant.id,
                TenantQuota.period_start <= today,
                TenantQuota.period_end >= today,
            )
        )
        response = TenantAdminResponse.model_validate(tenant, from_attributes=True)
        response.monthly_limit = quota.monthly_limit if quota else None
        response.used_count = quota.used_count if quota else None
        responses.append(response)
    return responses


@router.post(
    "/api/admin/tenants/{tenant_id}/review",
    response_model=TenantProvisionedResponse,
)
async def review_tenant(
    tenant_id: int,
    payload: TenantStatusUpdate,
    db: DatabaseDep,
    reviewer: PlatformAdminDep,
):
    try:
        result = await tenant_service.review(db, tenant_id, payload, reviewer)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tổ chức.")
    tenant, api_key_secret = result
    response = TenantProvisionedResponse.model_validate(tenant, from_attributes=True)
    response.api_key_secret = api_key_secret
    return response


@router.patch("/api/admin/tenants/{tenant_id}/status", response_model=TenantResponse)
async def change_tenant_status(
    tenant_id: int,
    payload: TenantStatusChange,
    db: DatabaseDep,
    reviewer: PlatformAdminDep,
):
    try:
        tenant = await tenant_service.set_status(db, tenant_id, payload.status, reviewer)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if tenant is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tổ chức.")
    return tenant


@router.put("/api/admin/tenants/{tenant_id}/quota")
async def update_tenant_quota(
    tenant_id: int,
    payload: TenantQuotaUpdate,
    db: DatabaseDep,
    reviewer: PlatformAdminDep,
):
    try:
        quota = await tenant_service.update_quota(
            db, tenant_id, payload.monthly_limit, reviewer
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if quota is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tổ chức.")
    return {"monthly_limit": quota.monthly_limit, "used_count": quota.used_count}
