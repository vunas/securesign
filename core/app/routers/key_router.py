from typing import List

from fastapi import APIRouter

from app.core.dependencies import CurrentUserDep, DatabaseDep
from app.repositories.key_repo import key_repo
from app.schemas.key_schema import KeyCreate, KeyResponse
from app.services.key_service import key_service

router = APIRouter(prefix="/api/keys", tags=["Keys"])


@router.post("/", response_model=KeyResponse)
async def generate_new_key(
    key_data: KeyCreate,
    db: DatabaseDep,
    current_user: CurrentUserDep,
):
    """Tạo một cặp khóa RSA mới và lưu trên Server."""
    return await key_service.create_key(db, current_user.tenant_id, key_data)


@router.get("/", response_model=List[KeyResponse])
async def get_my_keys(db: DatabaseDep, current_user: CurrentUserDep):
    """Lấy danh sách các khóa của tôi."""
    return await key_repo.get_all_by_tenant(db, current_user.tenant_id)
