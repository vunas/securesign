from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator

from app.models.certificate import CertType


class CertificateCreate(BaseModel):
    cert_name: str
    key_id: int
    issuer: str
    subject: str
    valid_days: int = 365
    cert_type: CertType = CertType.END_ENTITY

    @field_validator("cert_type", mode="before")
    @classmethod
    def normalize_cert_type(cls, value: Any) -> Any:
        if isinstance(value, str):
            val_lower = value.strip().lower()
            for member in CertType:
                if member.value == val_lower or member.name.lower() == val_lower:
                    return member
        return value


class CertificateResponse(BaseModel):
    id: int
    cert_name: str
    issuer: str
    subject: str
    valid_from: datetime
    valid_to: datetime

    class Config:
        from_attributes = True
