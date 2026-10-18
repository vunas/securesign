from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import ActionStatus, LogLevel, TargetResourceType, enum_values

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.user import User


class AuditLog(Base):
    """Log chống chối bỏ, lưu vết mọi hành động của hệ thống kèm Chain Hashing"""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("idx_audit_logs_target", "target_type", "target_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("tenants.id", ondelete="SET NULL"), index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    target_type: Mapped[Optional[TargetResourceType]] = mapped_column(
        Enum(TargetResourceType, name="target_resource_type", values_callable=enum_values)
    )
    target_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)

    level: Mapped[LogLevel] = mapped_column(
        Enum(LogLevel, name="log_level", values_callable=enum_values),
        default=LogLevel.INFO,
        server_default=LogLevel.INFO.value,
    )
    status: Mapped[ActionStatus] = mapped_column(
        Enum(ActionStatus, name="action_status", values_callable=enum_values),
        default=ActionStatus.SUCCESS,
        server_default=ActionStatus.SUCCESS.value,
    )

    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)

    payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql")
    )
    log_hash: Mapped[Optional[str]] = mapped_column(String(255))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    tenant: Mapped[Optional["Tenant"]] = relationship(back_populates="audit_logs")
    user: Mapped[Optional["User"]] = relationship()
