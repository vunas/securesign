from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import TenantStatus


class TenantRegistration(BaseModel):
    tenant_code: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=2, max_length=255)
    domain: str | None = Field(default=None, max_length=100)
    email: str = Field(min_length=3, max_length=100)
    admin_username: str = Field(min_length=3, max_length=50)
    admin_full_name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=12, max_length=72)


class TenantRegistrationResponse(BaseModel):
    tenant_code: str
    status: TenantStatus
    message: str


class TenantResponse(BaseModel):
    id: int
    tenant_code: str
    name: str
    domain: str | None
    email: str
    status: TenantStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TenantProvisionedResponse(TenantResponse):
    pass


class TenantAdminResponse(TenantResponse):
    monthly_limit: int | None = None
    used_count: int | None = None


class TenantStatusUpdate(BaseModel):
    status: Literal[TenantStatus.ACTIVE, TenantStatus.REJECTED]
    reason: str | None = Field(default=None, max_length=1000)


class TenantStatusChange(BaseModel):
    status: Literal[TenantStatus.ACTIVE, TenantStatus.SUSPENDED]


class TenantQuotaUpdate(BaseModel):
    monthly_limit: int = Field(ge=0, le=10_000_000)
