from typing import List

from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import ActiveTenantUserDep, DatabaseDep, TenantAdminDep
from app.repositories.key_repo import key_repo
from app.schemas.key_schema import KeyCreate, KeyResponse
from app.services.key_service import key_service

router = APIRouter(prefix="/api/keys", tags=["Keys"])


@router.post("/", response_model=KeyResponse)
async def generate_new_key(
    key_data: KeyCreate,
    db: DatabaseDep,
    current_user: ActiveTenantUserDep,
):
    """Tạo một cặp khóa ký và lưu trên Server."""
    return await key_service.create_key(
        db, current_user.tenant_id, key_data, user_id=current_user.id
    )


@router.get("/", response_model=List[KeyResponse])
async def get_my_keys(db: DatabaseDep, current_user: ActiveTenantUserDep):
    """Lấy danh sách khóa có chứng thư ký văn bằng còn hiệu lực."""
    if current_user.tenant_id is None:
        raise HTTPException(status_code=403, detail="Tenant role required.")
    return await key_repo.get_signing_keys(db, current_user.tenant_id)


@router.post("/{key_id}/revoke", response_model=KeyResponse)
async def revoke_key(
    key_id: int,
    db: DatabaseDep,
    current_user: TenantAdminDep,
):
    if current_user.tenant_id is None:
        raise HTTPException(status_code=403, detail="Tenant role required.")
    try:
        key_record = await key_service.revoke_key(
            db, key_id, current_user.tenant_id, current_user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if key_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa.")
    return key_record
