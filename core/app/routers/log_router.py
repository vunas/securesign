import csv
import io
from datetime import datetime
from typing import List

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.dependencies import CurrentUserDep, DatabaseDep
from app.models.enums import ActionStatus, UserRole
from app.repositories.audit_log_repo import audit_log_repo
from app.repositories.verify_log_repo import verify_log_repo
from app.schemas.log_schema import AuditLogResponse, VerifyLogResponse

router = APIRouter(prefix="/api/logs", tags=["Logs"])


@router.get("/audit", response_model=List[AuditLogResponse])
async def get_audit_logs(
    db: DatabaseDep,
    current_user: CurrentUserDep,
    limit: int = Query(default=50, ge=1, le=500),
    action: str | None = None,
    status: ActionStatus | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
):
    """Lấy danh sách Audit Logs (vết hệ thống)."""
    if current_user.role == UserRole.PLATFORM_SUPER_ADMIN:
        return await audit_log_repo.get_all(db, limit, action, status, since, until)
    if current_user.tenant_id is None:
        raise HTTPException(status_code=403, detail="Tenant role required.")
    if current_user.role != UserRole.TENANT_ADMIN:
        return await audit_log_repo.get_by_user(db, current_user.id, limit)
    return await audit_log_repo.get_by_tenant(
        db, current_user.tenant_id, limit, action, status, since, until, current_user.id
    )


@router.get("/verify", response_model=List[VerifyLogResponse])
async def get_verify_logs(
    db: DatabaseDep,
    current_user: CurrentUserDep,
    limit: int = Query(default=50, ge=1, le=500),
    valid: bool | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
):
    """Lấy lịch sử xác thực văn bản của User hiện tại."""
    if current_user.role == UserRole.PLATFORM_SUPER_ADMIN:
        return await verify_log_repo.get_all(db, limit, valid, since, until)
    if current_user.tenant_id is None:
        raise HTTPException(status_code=403, detail="Tenant role required.")
    if current_user.role != UserRole.TENANT_ADMIN:
        return await verify_log_repo.get_by_user(db, current_user.id, limit)
    return await verify_log_repo.get_by_tenant(
        db, current_user.tenant_id, limit, valid, since, until, current_user.id
    )


@router.get("/audit/export")
async def export_audit_logs(
    db: DatabaseDep,
    current_user: CurrentUserDep,
    action: str | None = None,
    status: ActionStatus | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
):
    if current_user.role == UserRole.PLATFORM_SUPER_ADMIN:
        rows = await audit_log_repo.get_all(
            db, limit=5000, action=action, status=status, since=since, until=until
        )
    elif current_user.tenant_id is not None and current_user.role == UserRole.TENANT_ADMIN:
        rows = await audit_log_repo.get_by_tenant(
            db,
            current_user.tenant_id,
            limit=5000,
            action=action,
            status=status,
            since=since,
            until=until,
            user_id=current_user.id,
        )
    else:
        raise HTTPException(status_code=403, detail="Không có quyền xuất nhật ký.")
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(
        ["created_at", "user_id", "action", "target_type", "target_id", "status", "log_hash"]
    )
    for row in rows:
        values = [
            row.created_at.isoformat() if row.created_at else "",
            row.user_id,
            row.action,
            row.target_type.value if row.target_type else "",
            row.target_id or "",
            row.status.value,
            row.log_hash or "",
        ]
        writer.writerow(
            [
                f"'{value}"
                if isinstance(value, str) and value.startswith(("=", "+", "-", "@"))
                else value
                for value in values
            ]
        )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit-logs.csv"'},
    )


@router.get("/audit/verify-chain")
async def verify_audit_chain(db: DatabaseDep, current_user: CurrentUserDep):
    if current_user.role != UserRole.PLATFORM_SUPER_ADMIN and (
        current_user.role != UserRole.TENANT_ADMIN or current_user.tenant_id is None
    ):
        raise HTTPException(status_code=403, detail="Không có quyền kiểm tra chuỗi audit.")
    from app.services.log_service import log_service

    return await log_service.verify_chain(db)
