from datetime import date, datetime

from pydantic import BaseModel

from app.models.enums import CredentialStatus


class PublicCredentialStatus(BaseModel):
    tracking_id: str
    credential_number: str | None
    recipient_name: str
    recipient_id: str | None
    issue_date: date
    status: CredentialStatus
    revocation_reason: str | None
    revoked_at: datetime | None
    organization_name: str
    organization_logo_url: str | None
    organization_website_url: str | None


class CredentialRevokeRequest(BaseModel):
    reason: str
    password: str
