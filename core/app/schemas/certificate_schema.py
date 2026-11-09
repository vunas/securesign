from datetime import datetime

from pydantic import BaseModel

from app.models.certificate import CertType


class CertificateCreate(BaseModel):
    cert_name: str
    key_id: int
    issuer: str
    subject: str
    valid_days: int = 365
    cert_type: CertType = CertType.END_ENTITY


class CertificateResponse(BaseModel):
    id: int
    cert_name: str
    issuer: str
    subject: str
    valid_from: datetime
    valid_to: datetime

    class Config:
        from_attributes = True
