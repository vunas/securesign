import hashlib
import io
import json
import secrets
import zipfile
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import func, select

from app.core.dependencies import DatabaseDep, TenantAdminDep
from app.models.api_key import ApiKey
from app.models.audit_log import AuditLog
from app.models.enums import TargetResourceType, TenantStatus
from app.models.tenant import Tenant
from app.repositories.api_key_repo import api_key_repo
from app.repositories.key_repo import key_repo
from app.schemas.api_key_schema import (
    ApiKeyCreate,
    ApiKeyCreated,
    ApiKeyResponse,
    BatchCredentialMetadata,
)
from app.schemas.signature_schema import SignatureCreate
from app.services.api_key_service import api_key_service
from app.services.file_service import file_service
from app.services.log_service import log_service
from app.services.quota_service import QuotaExceededError
from app.utils.file_utils import MAX_FILE_SIZE

router = APIRouter(tags=["API Keys"])


@router.get("/api/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(db: DatabaseDep, current_user: TenantAdminDep):
    if current_user.tenant_id is None:
        raise HTTPException(status_code=403, detail="Tenant role required.")
    return await api_key_repo.get_all_by_tenant(db, current_user.tenant_id)


@router.post("/api/api-keys", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    payload: ApiKeyCreate,
    db: DatabaseDep,
    current_user: TenantAdminDep,
):
    if current_user.tenant_id is None:
        raise HTTPException(status_code=403, detail="Tenant role required.")
    try:
        api_key, secret = await api_key_service.create(
            db, current_user.tenant_id, payload, current_user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    key_response = ApiKeyResponse.model_validate(api_key, from_attributes=True)
    return ApiKeyCreated(**key_response.model_dump(), secret=secret)


@router.delete("/api/api-keys/{api_key_id}", response_model=ApiKeyResponse)
async def revoke_api_key(
    api_key_id: int,
    db: DatabaseDep,
    current_user: TenantAdminDep,
):
    if current_user.tenant_id is None:
        raise HTTPException(status_code=403, detail="Tenant role required.")
    api_key = await api_key_service.revoke(db, api_key_id, current_user.tenant_id, current_user.id)
    if api_key is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy API key.")
    return api_key


async def get_api_key(
    db: DatabaseDep,
    x_api_key: Annotated[str | None, Header()] = None,
) -> ApiKey:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Thiếu X-API-Key.")

    key_hash = hashlib.sha256(x_api_key.encode("utf-8")).hexdigest()
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
        .with_for_update()
    )
    api_key = result.scalar_one_or_none()
    now = datetime.now(UTC)
    expires_at = api_key.expires_at if api_key is not None else None
    if expires_at is not None and expires_at.utcoffset() is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if api_key is None or (expires_at is not None and expires_at <= now):
        raise HTTPException(status_code=401, detail="API key không hợp lệ hoặc đã hết hạn.")
    tenant = await db.get(Tenant, api_key.tenant_id)
    if tenant is None or tenant.status != TenantStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Tổ chức chưa được kích hoạt.")

    request_count = await db.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.action == "API_KEY_REQUEST",
            AuditLog.target_id == str(api_key.id),
            AuditLog.created_at >= now - timedelta(minutes=1),
        )
    )
    if (request_count or 0) >= api_key.rate_limit_per_min:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Đã vượt giới hạn yêu cầu của API key.",
            headers={"Retry-After": "60"},
        )

    api_key.last_used_at = now
    await log_service.log_action(
        db=db,
        tenant_id=api_key.tenant_id,
        user_id=None,
        action="API_KEY_REQUEST",
        target_type=TargetResourceType.SYSTEM,
        target_id=str(api_key.id),
        payload={"key_prefix": api_key.key_prefix},
    )
    return api_key


ApiKeyDep = Annotated[ApiKey, Depends(get_api_key)]


@router.post(
    "/api/batch/sign",
    summary="Ký số hàng loạt qua API",
    description=(
        "Nhận tối đa 10 PDF và một mảng metadata tương ứng, xác thực bằng X-API-Key, "
        "tự chọn khóa ký mặc định hợp lệ của tenant nếu không truyền key_id, ký PAdES "
        "và trả về một ZIP chứa các PDF đã ký cùng tracking-ids.json."
    ),
    response_class=StreamingResponse,
    responses={
        status.HTTP_200_OK: {
            "description": "ZIP chứa PDF đã ký và tracking-ids.json.",
            "content": {"application/zip": {}},
        }
    },
)
async def batch_sign(
    db: DatabaseDep,
    api_key: ApiKeyDep,
    files: list[UploadFile] = File(...),
    key_id: int | None = Form(default=None),
    batch_metadata: str = Form(...),
):
    if not files or len(files) > 10:
        raise HTTPException(status_code=422, detail="Mỗi lô phải có từ 1 đến 10 tệp PDF.")
    try:
        metadata_items = TypeAdapter(list[BatchCredentialMetadata]).validate_python(
            json.loads(batch_metadata)
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="batch_metadata phải là JSON hợp lệ.") from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    if len(metadata_items) != len(files):
        raise HTTPException(
            status_code=422,
            detail="Cần một đối tượng metadata tương ứng cho mỗi tệp PDF.",
        )
    if key_id is None:
        signing_keys = await key_repo.get_signing_keys(db, api_key.tenant_id)
        if not signing_keys:
            raise HTTPException(
                status_code=422,
                detail="Tenant chưa có khóa ký mặc định hợp lệ.",
            )
        key_id = signing_keys[0].id

    archive_buffer = io.BytesIO()
    total_upload_size = 0
    tracking_ids = []
    try:
        with zipfile.ZipFile(archive_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for index, (file, metadata) in enumerate(
                zip(files, metadata_items, strict=True), start=1
            ):
                if file.content_type != "application/pdf":
                    raise HTTPException(status_code=415, detail="Chỉ chấp nhận tệp PDF.")
                content = await file.read(MAX_FILE_SIZE + 1)
                total_upload_size += len(content)
                if len(content) > MAX_FILE_SIZE or total_upload_size > 50 * 1024 * 1024:
                    raise HTTPException(
                        status_code=413, detail="Tổng dung lượng lô tối đa là 50 MB."
                    )

                if not metadata.recipient_name.strip() or not metadata.signer_name.strip():
                    raise HTTPException(
                        status_code=422,
                        detail=f"Metadata phần tử {index} chứa tên trống.",
                    )
                sign_data = SignatureCreate(
                    credential_id=0,
                    key_id=key_id,
                    signer_name=metadata.signer_name.strip(),
                    signer_reason=metadata.signer_reason,
                    signer_location=metadata.signer_location,
                )

                upload = UploadFile(
                    filename=file.filename,
                    file=io.BytesIO(content),
                    headers=file.headers,
                )
                try:
                    signed_pdf, _, tracking_id = await file_service.issue_and_sign_credential(
                        db=db,
                        file=upload,
                        tenant_id=api_key.tenant_id,
                        user_id=None,
                        recipient_name=metadata.recipient_name.strip(),
                        recipient_id=metadata.recipient_id,
                        credential_number=metadata.credential_number,
                        issue_date=metadata.issue_date,
                        metadata_payload=metadata.metadata,
                        sign_data=sign_data,
                    )
                finally:
                    await upload.close()
                archive.writestr(f"{index:02d}-{secrets.token_hex(4)}.pdf", signed_pdf)
                tracking_ids.append(tracking_id)
            archive.writestr("tracking-ids.json", json.dumps(tracking_ids))
    except QuotaExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "QUOTA_EXCEEDED", "message": str(exc)},
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        for file in files:
            await file.close()

    archive_buffer.seek(0)
    return StreamingResponse(
        archive_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="signed-credentials.zip"',
            "X-Tracking-IDs": json.dumps(tracking_ids),
        },
    )
