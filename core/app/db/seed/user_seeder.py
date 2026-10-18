import hashlib
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.api_key import ApiKey
from app.models.enums import TenantStatus, UserRole
from app.models.tenant import Tenant
from app.models.tenant_quota import TenantQuota
from app.models.user import User


async def seed_users(db: AsyncSession):
    print("👤 Đang tạo Users...")

    tenant = Tenant(
        tenant_code="DEMO",
        name="SecureSign Demo Organization",
        email="admin@securesign.local",
        status=TenantStatus.ACTIVE,
    )
    db.add(tenant)
    await db.flush()

    today = date.today()
    db.add(
        TenantQuota(
            tenant_id=tenant.id,
            monthly_limit=1000,
            used_count=0,
            period_start=today.replace(day=1),
            period_end=today.replace(day=28),
        )
    )
    db.add(
        ApiKey(
            tenant_id=tenant.id,
            name="Demo Integration Key",
            key_prefix="vck_live_demo",
            key_hash=hashlib.sha256(b"demo-api-secret").hexdigest(),
        )
    )
    await db.flush()

    users_data = [
        {"username": "admin", "pass": "123456", "role": UserRole.PLATFORM_SUPER_ADMIN},
        {"username": "giamdoc", "pass": "123456", "role": UserRole.TENANT_ADMIN},
        {"username": "nhanvien", "pass": "123456", "role": UserRole.TENANT_OPERATOR},
        {"username": "demo", "pass": "123456", "role": UserRole.TENANT_OPERATOR},
    ]

    created_users = {}

    for user_data in users_data:
        user = User(
            username=user_data["username"],
            password_hash=get_password_hash(user_data["pass"]),
            tenant_id=None if user_data["role"] == UserRole.PLATFORM_SUPER_ADMIN else tenant.id,
            role=user_data["role"],
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        created_users[user.username] = user
        print(f"  -> Đã tạo user: {user.username}")

    created_users["tenant"] = tenant
    return created_users
