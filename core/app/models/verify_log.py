from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.credential import Credential
    from app.models.signature import Signature
    from app.models.tenant import Tenant
    from app.models.user import User


class VerifyLog(Base):
    """Lưu vết các lượt Verify (Xác thực) văn bản từ người dùng/hệ thống"""

    __tablename__ = "verify_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("tenants.id", ondelete="SET NULL"), index=True
    )
    credential_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("credentials.id", ondelete="SET NULL"), index=True
    )
    tracking_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    signature_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("signatures.id", ondelete="SET NULL")
    )
    verified_by_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_integrity_valid: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_cert_valid: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_not_revoked: Mapped[Optional[bool]] = mapped_column(Boolean)

    message: Mapped[Optional[str]] = mapped_column(Text)
    signer_snapshot: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql")
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    tenant: Mapped[Optional["Tenant"]] = relationship(back_populates="verify_logs")
    credential: Mapped[Optional["Credential"]] = relationship()
    signature: Mapped[Optional["Signature"]] = relationship()
    verified_by: Mapped[Optional["User"]] = relationship()
