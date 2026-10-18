from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.signature import Signature


class Timestamp(Base):
    """Lưu trữ lịch sử Time Stamping Authority (TSA) nhúng trong chữ ký"""

    __tablename__ = "timestamps"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    signature_id: Mapped[int] = mapped_column(
        ForeignKey("signatures.id", ondelete="CASCADE"), index=True
    )

    timestamp_token: Mapped[Optional[bytes]] = mapped_column(LargeBinary)
    hashed_data: Mapped[Optional[str]] = mapped_column(Text)
    tsa_name: Mapped[Optional[str]] = mapped_column(String(100))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    signature: Mapped["Signature"] = relationship(back_populates="timestamps")
