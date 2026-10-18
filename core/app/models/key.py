from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import KeyStorageType, SignatureAlgo, enum_values

if TYPE_CHECKING:
    from app.models.certificate import Certificate
    from app.models.tenant import Tenant


class Key(Base):
    __tablename__ = "keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    key_name: Mapped[Optional[str]] = mapped_column(String(100))
    public_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    private_key_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    key_size: Mapped[int] = mapped_column(default=2048)
    algorithm: Mapped[SignatureAlgo] = mapped_column(
        Enum(SignatureAlgo, name="signature_algo", values_callable=enum_values),
        default=SignatureAlgo.RSA,
        server_default=SignatureAlgo.RSA.value,
    )
    storage_type: Mapped[KeyStorageType] = mapped_column(
        Enum(KeyStorageType, name="key_storage_type", values_callable=enum_values),
        default=KeyStorageType.SERVER,
        server_default=KeyStorageType.SERVER.value,
    )
    storage_provider: Mapped[Optional[str]] = mapped_column(String(50))
    key_fingerprint: Mapped[Optional[str]] = mapped_column(Text)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    tenant: Mapped["Tenant"] = relationship(back_populates="keys")
    certificates: Mapped[List["Certificate"]] = relationship(back_populates="key")

    def revoke_key(self) -> None:
        """Đánh dấu khóa đã bị thu hồi/xóa bỏ, không cho phép ký văn bản mới"""
        self.is_revoked = True
