from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import HashAlgo, SignatureAlgo, enum_values

if TYPE_CHECKING:
    from app.models.certificate import Certificate
    from app.models.credential import Credential
    from app.models.key import Key
    from app.models.timestamp import Timestamp
    from app.models.user import User


class Signature(Base):
    __tablename__ = "signatures"

    id: Mapped[int] = mapped_column(primary_key=True)
    credential_id: Mapped[int] = mapped_column(
        ForeignKey("credentials.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    key_id: Mapped[int] = mapped_column(ForeignKey("keys.id", ondelete="RESTRICT"), nullable=False)
    certificate_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("certificates.id", ondelete="RESTRICT")
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    signature_value: Mapped[Optional[bytes]] = mapped_column(LargeBinary)

    hash_algorithm: Mapped[HashAlgo] = mapped_column(
        Enum(HashAlgo, name="hash_algo", values_callable=enum_values),
        default=HashAlgo.SHA_256,
        server_default=HashAlgo.SHA_256.value,
    )
    signature_algorithm: Mapped[SignatureAlgo] = mapped_column(
        Enum(SignatureAlgo, name="signature_algo", values_callable=enum_values),
        default=SignatureAlgo.RSA,
        server_default=SignatureAlgo.RSA.value,
    )

    visible_signature: Mapped[bool] = mapped_column(Boolean, default=True)
    signer_name: Mapped[Optional[str]] = mapped_column(String(100))
    signer_reason: Mapped[Optional[str]] = mapped_column(Text)
    signer_location: Mapped[Optional[str]] = mapped_column(String(100))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    credential: Mapped["Credential"] = relationship(back_populates="signatures")
    key: Mapped["Key"] = relationship()
    certificate: Mapped[Optional["Certificate"]] = relationship()
    user: Mapped[Optional["User"]] = relationship(back_populates="signatures")
    timestamps: Mapped[List["Timestamp"]] = relationship(
        back_populates="signature", cascade="all, delete-orphan"
    )
