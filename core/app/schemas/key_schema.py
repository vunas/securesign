from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.key import KeyStorageType, SignatureAlgo


class KeyCreate(BaseModel):
    key_name: str
    storage_type: KeyStorageType = KeyStorageType.SERVER
    key_size: int = 2048
    algorithm: SignatureAlgo = SignatureAlgo.RSA
    passphrase: Optional[str] = None


class KeyResponse(BaseModel):
    id: int
    tenant_id: int
    key_name: str
    key_size: int
    algorithm: SignatureAlgo
    storage_type: KeyStorageType
    key_fingerprint: str
    created_at: datetime

    # Bổ sung trường này để Backend có thể trả Raw Key về cho Frontend khi chọn Local
    raw_private_key: Optional[str] = None

    class Config:
        from_attributes = True
