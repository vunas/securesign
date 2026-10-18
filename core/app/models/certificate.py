from datetime import UTC, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import CertType, enum_values

if TYPE_CHECKING:
    from app.models.key import Key
    from app.models.tenant import Tenant


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[int] = mapped_column(primary_key=True)

    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    key_id: Mapped[int] = mapped_column(
        ForeignKey("keys.id", ondelete="CASCADE"), index=True, nullable=False
    )

    cert_name: Mapped[Optional[str]] = mapped_column(String(100))
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True)

    issuer: Mapped[Optional[str]] = mapped_column(String(255))
    subject: Mapped[Optional[str]] = mapped_column(String(255))

    cert_type: Mapped[CertType] = mapped_column(
        Enum(CertType, name="cert_type", values_callable=enum_values),
        default=CertType.END_ENTITY,
        server_default=CertType.END_ENTITY.value,
    )
    purpose: Mapped[str] = mapped_column(
        String(50), default="document_signing", server_default="document_signing"
    )

    certificate_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    certificate_pem: Mapped[Optional[str]] = mapped_column(Text)

    valid_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    tenant: Mapped["Tenant"] = relationship(back_populates="certificates")
    key: Mapped["Key"] = relationship(back_populates="certificates")
    chains: Mapped[List["CertificateChain"]] = relationship(
        back_populates="certificate", cascade="all, delete-orphan", lazy="selectin"
    )

    def is_valid_now(self) -> bool:
        """Kiểm tra chứng chỉ còn hiệu lực không (Chưa bị thu hồi và còn hạn)"""
        if self.is_revoked:
            return False
        now = datetime.now(UTC)
        if self.valid_from and self.valid_to:
            return self.valid_from <= now <= self.valid_to
        return True

    def revoke(self) -> None:
        """Thu hồi chứng chỉ"""
        self.is_revoked = True
        self.revoked_at = datetime.now(UTC)


class CertificateChain(Base):
    __tablename__ = "certificate_chains"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    certificate_id: Mapped[int] = mapped_column(
        ForeignKey("certificates.id", ondelete="CASCADE"), index=True
    )
    ca_certificate_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    level: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    certificate: Mapped["Certificate"] = relationship(back_populates="chains")
