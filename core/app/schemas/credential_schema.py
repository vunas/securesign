from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import CredentialStatus


class CredentialResponse(BaseModel):
    id: int
    tenant_id: int
    tracking_id: str
    credential_number: Optional[str] = None
    file_name: Optional[str] = None
    original_hash: str
    recipient_name: str
    recipient_id: Optional[str] = None
    signed_hash: Optional[str] = None
    status: CredentialStatus
    issue_date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
