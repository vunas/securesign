from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.key import KeyStorageType, SignatureAlgo


class KeyCreate(BaseModel):
    key_name: str = Field(min_length=1, max_length=100)
    storage_type: KeyStorageType = KeyStorageType.SERVER
    key_size: int | None = None
    algorithm: SignatureAlgo = SignatureAlgo.RSA

    @field_validator("key_name", mode="before")
    @classmethod
    def normalize_key_name(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_key_size(self):
        if self.key_size is None:
            self.key_size = 2048 if self.algorithm == SignatureAlgo.RSA else 256
        allowed_sizes = {2048, 4096} if self.algorithm == SignatureAlgo.RSA else {256}
        if self.key_size not in allowed_sizes:
            raise ValueError(f"Độ dài khóa không hợp lệ cho {self.algorithm.value}.")
        if self.storage_type.value != "server":
            raise ValueError("Chỉ hỗ trợ lưu trữ khóa trên máy chủ.")
        return self


class KeyResponse(BaseModel):
    id: int
    tenant_id: int
    key_name: str
    key_size: int
    algorithm: SignatureAlgo
    storage_type: KeyStorageType
    key_fingerprint: str
    is_revoked: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
