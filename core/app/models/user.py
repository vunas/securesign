from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import UserRole, enum_values

if TYPE_CHECKING:
    from app.models.credential import Credential
    from app.models.signature import Signature
    from app.models.tenant import Tenant


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "(role = 'PLATFORM_SUPER_ADMIN' AND tenant_id IS NULL) "
            "OR (role != 'PLATFORM_SUPER_ADMIN' AND tenant_id IS NOT NULL)",
            name="chk_user_tenant_role",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=enum_values),
        default=UserRole.TENANT_OPERATOR,
        server_default=UserRole.TENANT_OPERATOR.value,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped[Optional["Tenant"]] = relationship(back_populates="users")
    created_credentials: Mapped[List["Credential"]] = relationship(
        foreign_keys="Credential.created_by_user_id", back_populates="created_by"
    )
    revoked_credentials: Mapped[List["Credential"]] = relationship(
        foreign_keys="Credential.revoked_by_user_id", back_populates="revoked_by"
    )
    signatures: Mapped[List["Signature"]] = relationship(back_populates="user")

    def deactivate(self) -> None:
        """Khóa tài khoản người dùng"""
        self.is_active = False

    def activate(self) -> None:
        """Kích hoạt lại tài khoản"""
        self.is_active = True
