import argparse
import asyncio

from sqlalchemy import delete, select

from app.db.base import Base
from app.db.seed.credential_seeder import seed_credentials
from app.db.seed.log_seeder import seed_logs
from app.db.seed.pki_seeder import seed_pki
from app.db.seed.signature_seeder import seed_signatures
from app.db.seed.user_seeder import seed_users
from app.db.session import AsyncSessionLocal, engine
from app.models.api_key import ApiKey
from app.models.audit_log import AuditLog
from app.models.certificate import Certificate, CertificateChain
from app.models.credential import Credential
from app.models.key import Key
from app.models.signature import Signature
from app.models.tenant import Tenant
from app.models.tenant_quota import TenantQuota
from app.models.timestamp import Timestamp
from app.models.user import User
from app.models.verify_log import VerifyLog


async def run_seed(force=False):
    print("🌱 BẮT ĐẦU SEED DATA...")

    async with AsyncSessionLocal() as db:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

            result = await db.execute(select(User).where(User.username == "admin"))
            admin = result.scalar_one_or_none()
            if admin and not force:
                print("⚠️ Seed đã tồn tại. Dùng --force để ghi đè.")
                return

            if force:
                print("♻️ Xóa dữ liệu cũ...")
                for model in (
                    AuditLog,
                    VerifyLog,
                    Timestamp,
                    Signature,
                    Credential,
                    CertificateChain,
                    Certificate,
                    Key,
                    User,
                    ApiKey,
                    TenantQuota,
                    Tenant,
                ):
                    await db.execute(delete(model))
                await db.commit()

            created_users = await seed_users(db)
            pki_data = await seed_pki(db, created_users)
            created_credentials = await seed_credentials(db, created_users)
            await seed_signatures(db, created_credentials, pki_data, created_users)
            await seed_logs(db, created_credentials, created_users)

            db.add(
                AuditLog(
                    tenant_id=created_users["tenant"].id,
                    user_id=created_users["giamdoc"].id,
                    action="SEED_DATA",
                    target_type="SYSTEM",
                    target_id="seed",
                    payload={"credentials": len(created_credentials)},
                )
            )
            await db.commit()

            print("-" * 50)
            print("✅ HOÀN TẤT SEED DATA")
            print("🚀 Admin: admin / 123456")
            print("🚀 Giám đốc: giamdoc / 123456")
            print("-" * 50)
        except Exception as error:
            await db.rollback()
            print(f"❌ Lỗi seed: {error}")
        finally:
            await db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Xóa dữ liệu cũ và seed lại")
    args = parser.parse_args()
    asyncio.run(run_seed(force=args.force))
