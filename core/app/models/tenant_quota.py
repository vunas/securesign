from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant


class TenantQuota(Base):
    __tablename__ = "tenant_quotas"
    __table_args__ = (
        UniqueConstraint("tenant_id", "period_start", "period_end", name="uq_tenant_period"),
        CheckConstraint("used_count >= 0 AND used_count <= monthly_limit", name="chk_quota_limits"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    monthly_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="quotas")
