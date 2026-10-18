from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import TenantStatus, enum_values

if TYPE_CHECKING:
    from app.models.api_key import ApiKey
    from app.models.audit_log import AuditLog
    from app.models.certificate import Certificate
    from app.models.credential import Credential
    from app.models.key import Key
    from app.models.tenant_quota import TenantQuota
    from app.models.user import User
    from app.models.verify_log import VerifyLog


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    email: Mapped[str] = mapped_column(String(100), nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(Text)
    website_url: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[TenantStatus] = mapped_column(
        Enum(TenantStatus, name="tenant_status", values_callable=enum_values),
        default=TenantStatus.PENDING,
        server_default=TenantStatus.PENDING.value,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    users: Mapped[List["User"]] = relationship(back_populates="tenant", passive_deletes=True)
    quotas: Mapped[List["TenantQuota"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan", passive_deletes=True
    )
    api_keys: Mapped[List["ApiKey"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan", passive_deletes=True
    )
    keys: Mapped[List["Key"]] = relationship(back_populates="tenant", passive_deletes=True)
    certificates: Mapped[List["Certificate"]] = relationship(
        back_populates="tenant", passive_deletes=True
    )
    credentials: Mapped[List["Credential"]] = relationship(back_populates="tenant")
    verify_logs: Mapped[List["VerifyLog"]] = relationship(back_populates="tenant")
    audit_logs: Mapped[List["AuditLog"]] = relationship(back_populates="tenant")
