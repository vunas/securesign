import pytest
from sqlalchemy import select

from app.models.enums import TenantStatus
from app.models.tenant import Tenant
from app.models.user import User

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
async def test_generate_key_endpoint_uses_dependency_overrides(
    client_full, db_session, override_current_user_full
):
    # Ensure the overridden current user exists in DB if any code queries it later
    result = await db_session.execute(
        select(User).where(User.username == override_current_user_full.username)
    )
    db_user = result.scalar_one_or_none()

    if not db_user:
        tenant = Tenant(
            id=1,
            tenant_code="KEYS",
            name="Keys Tenant",
            email="keys@example.com",
            status=TenantStatus.ACTIVE,
        )
        db_session.add(tenant)
        await db_session.flush()
        db_user = User(
            id=override_current_user_full.id,
            username=override_current_user_full.username,
            password_hash=override_current_user_full.password_hash,
            tenant_id=tenant.id,
            is_active=True,
        )
        db_session.add(db_user)
        await db_session.commit()

    payload = {
        "key_name": "My Test Key",
        "storage_type": "server",
        "key_size": 2048,
        "algorithm": "RSA",
        "passphrase": None,
    }

    res = await client_full.post("/api/keys/", json=payload)

    assert res.status_code == 200, res.text
    data = res.json()

    assert data["tenant_id"] == override_current_user_full.tenant_id
    assert data["key_name"] == payload["key_name"]
    assert data["storage_type"] == "server"
    assert data["algorithm"] == "RSA"

    assert isinstance(data["key_fingerprint"], str)
    assert len(data["key_fingerprint"]) == 16
    assert data["key_fingerprint"].upper() == data["key_fingerprint"]
