from datetime import date, datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import JSON, Date, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import CredentialStatus, enum_values

if TYPE_CHECKING:
    from app.models.signature import Signature
    from app.models.tenant import Tenant
    from app.models.user import User


class Credential(Base):
    __tablename__ = "credentials"
    __table_args__ = (
        Index("idx_credentials_signed_hash", "signed_hash"),
        Index("idx_credentials_original_hash", "original_hash"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_by_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    tracking_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    credential_number: Mapped[Optional[str]] = mapped_column(String(100))
    recipient_name: Mapped[str] = mapped_column(String(150), nullable=False)
    recipient_id: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        "metadata", JSON().with_variant(JSONB(), "postgresql")
    )
    file_name: Mapped[Optional[str]] = mapped_column(String(255))
    original_hash: Mapped[str] = mapped_column(Text, nullable=False)
    signed_hash: Mapped[Optional[str]] = mapped_column(Text)
    file_download_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[CredentialStatus] = mapped_column(
        Enum(CredentialStatus, name="credential_status", values_callable=enum_values),
        default=CredentialStatus.ISSUED,
        server_default=CredentialStatus.ISSUED.value,
        index=True,
    )
    revocation_reason: Mapped[Optional[str]] = mapped_column(Text)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    revoked_by_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="credentials")
    created_by: Mapped[Optional["User"]] = relationship(
        foreign_keys=[created_by_user_id], back_populates="created_credentials"
    )
    revoked_by: Mapped[Optional["User"]] = relationship(
        foreign_keys=[revoked_by_user_id], back_populates="revoked_credentials"
    )
    signatures: Mapped[List["Signature"]] = relationship(back_populates="credential")

    def mark_as_signed(self, new_signed_hash: str) -> None:
        self.signed_hash = new_signed_hash
        self.status = CredentialStatus.ISSUED

    def revoke(self, reason: str | None = None) -> None:
        self.status = CredentialStatus.REVOKED
        self.revocation_reason = reason
        self.revoked_at = datetime.now()
