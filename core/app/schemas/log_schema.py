from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import ActionStatus, LogLevel, TargetResourceType


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    target_type: Optional[TargetResourceType]
    target_id: Optional[str]
    level: LogLevel
    status: ActionStatus
    ip_address: Optional[str]
    user_agent: Optional[str]
    payload: Optional[Dict[str, Any]]
    log_hash: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VerifyLogResponse(BaseModel):
    id: int
    tenant_id: Optional[int]
    credential_id: Optional[int]
    tracking_id: Optional[str]
    signature_id: Optional[int]
    verified_by_user_id: Optional[int]
    is_valid: bool
    is_integrity_valid: Optional[bool]
    is_cert_valid: Optional[bool]
    is_not_revoked: Optional[bool]
    message: Optional[str]
    signer_snapshot: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
