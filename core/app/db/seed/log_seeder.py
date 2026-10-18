import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import CredentialStatus
from app.models.signature import Signature
from app.models.verify_log import VerifyLog


async def seed_logs(db: AsyncSession, docs: list, users: dict):
    print("📊 Đang tạo Logs...")

    result = await db.execute(select(Signature))
    signatures = result.scalars().all()
    if not signatures:
        print("⚠️ Không có signature nào")
        return

    verified_credentials = [
        credential for credential in docs if credential.status == CredentialStatus.ISSUED
    ]
    for credential in verified_credentials:
        db.add(
            VerifyLog(
                credential_id=credential.id,
                tracking_id=credential.tracking_id,
                tenant_id=users["tenant"].id,
                signature_id=random.choice(signatures).id,
                is_valid=True,
                message="Chữ ký hợp lệ",
                created_at=datetime.now(UTC) - timedelta(hours=random.randint(1, 48)),
            )
        )

    await db.commit()
    print("  -> Đã tạo Verify Logs")
