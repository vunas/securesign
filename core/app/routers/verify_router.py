from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.dependencies import DatabaseDep, get_optional_current_user
from app.models.user import User
from app.schemas.verify_schema import VerifyResponse
from app.services.verify_service import verify_service
from app.utils.logger import logger

router = APIRouter(prefix="/api/verify", tags=["Verification"])


@router.post("/pdf", response_model=VerifyResponse)
async def verify_uploaded_pdf(
    db: DatabaseDep,
    current_user: User | None = Depends(get_optional_current_user),
    file: UploadFile = File(...),
):
    """
    Xác thực một file PDF xem đã được ký chưa, có bị chỉnh sửa không.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Vui lòng tải lên file định dạng PDF.")

    try:
        username = current_user.username if current_user else "guest"
        logger.info(f"User {username} đang thực hiện xác thực tài liệu PDF: {file.filename}")
        return await verify_service.verify_pdf_signature(
            db,
            file,
            current_user.id if current_user else None,
            current_user.tenant_id if current_user else None,
        )

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Lỗi hệ thống khi verify PDF ({file.filename}): {str(e)}")
        raise HTTPException(status_code=500, detail="Đã xảy ra lỗi trong quá trình phân tích file.")
