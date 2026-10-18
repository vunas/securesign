from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.repositories.credential_repo import credential_repo
from app.schemas.credential_schema import CredentialResponse
from app.services.file_service import file_service

# Keep the established public URL while using credential terminology internally.
router = APIRouter(prefix="/api/documents", tags=["Credentials"])


@router.post("/upload", response_model=CredentialResponse)
async def upload_credential(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload tệp PDF gốc lên hệ thống trước khi ký"""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Hệ thống chỉ chấp nhận định dạng PDF.")

    try:
        credential = await file_service.upload_credential(
            db, current_user.id, file, tenant_id=current_user.tenant_id
        )
        return credential
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi upload: {str(e)}")


@router.get("/", response_model=list[CredentialResponse])
async def get_my_credentials(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Lấy danh sách các tài liệu của user"""
    return await credential_repo.get_all_by_tenant(db, current_user.tenant_id)


@router.get("/{credential_id}/download")
async def download_credential(
    credential_id: int,
    is_signed: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tải file PDF (local hoặc Supabase – tự động xử lý)"""
    credential = await credential_repo.get_by_id(db, credential_id, current_user.tenant_id)
    if not credential:
        raise HTTPException(status_code=404, detail="Không tìm thấy credential.")

    raise HTTPException(
        status_code=410,
        detail=(
            "PDF không được lưu trữ theo chính sách Stateless & Zero-Knowledge. "
            "Hãy tải lại file để xác thực hoặc ký."
        ),
    )
