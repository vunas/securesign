import hashlib
import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credential import Credential
from app.models.enums import CredentialStatus


async def seed_credentials(db: AsyncSession, users: dict):
    print("🎓 Đang tạo Credentials...")

    tenant = users["tenant"]
    minimal_pdf = b"%PDF-1.4 fake"
    credentials_info = [
        ("hop_dong_thue_nha_2026.pdf", users["giamdoc"], CredentialStatus.ISSUED),
        ("don_xin_nghi_phep_T4.pdf", users["nhanvien"], CredentialStatus.DRAFT),
        ("bao_cao_tai_chinh_Q1.pdf", users["giamdoc"], CredentialStatus.ISSUED),
    ]
    created_credentials = []

    for filename, owner, status in credentials_info:
        file_hash = hashlib.sha256(minimal_pdf + filename.encode()).hexdigest()
        credential = Credential(
            tenant_id=tenant.id,
            created_by_user_id=owner.id,
            tracking_id=uuid.uuid4().hex,
            credential_number=f"DEMO-{uuid.uuid4().hex[:8].upper()}",
            recipient_name="Nguyễn Văn A",
            recipient_id=f"SV-{uuid.uuid4().hex[:8].upper()}",
            issue_date=date.today(),
            file_name=filename,
            original_hash=file_hash,
            signed_hash=file_hash if status == CredentialStatus.ISSUED else None,
            file_download_url=None,
            status=status,
        )
        db.add(credential)
        created_credentials.append(credential)

    await db.commit()
    for credential in created_credentials:
        await db.refresh(credential)

    print(f"  -> Đã tạo {len(created_credentials)} credentials")
    return created_credentials
