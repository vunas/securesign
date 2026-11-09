from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    rate_limit_per_min: int = Field(default=60, ge=1, le=6000)
    expires_at: datetime | None = None

    @field_validator("expires_at")
    @classmethod
    def require_future_timezone_aware_expiry(cls, value: datetime | None):
        if value is not None and value.utcoffset() is None:
            raise ValueError("Thời điểm hết hạn phải có múi giờ.")
        return value


class ApiKeyResponse(BaseModel):
    id: int
    name: str
    key_prefix: str
    rate_limit_per_min: int
    is_active: bool
    last_used_at: datetime | None
    expires_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreated(ApiKeyResponse):
    secret: str


class BatchCredentialMetadata(BaseModel):
    recipient_name: str = Field(min_length=1, max_length=150)
    recipient_id: str | None = Field(default=None, max_length=50)
    credential_number: str | None = Field(default=None, max_length=100)
    issue_date: date | None = None
    signer_name: str = Field(min_length=1, max_length=100)
    signer_reason: str = Field(default="Cấp phát văn bằng", max_length=500)
    signer_location: str = Field(default="Việt Nam", max_length=100)
    metadata: dict[str, Any] | None = None
