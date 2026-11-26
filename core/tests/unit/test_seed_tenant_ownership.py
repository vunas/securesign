from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.db.seed.credential_seeder import seed_credentials
from app.db.seed.pki_seeder import seed_pki
from app.db.seed.user_seeder import seed_users


@pytest.mark.asyncio
async def test_seed_demo_operator_belongs_to_group_tenant():
    next_id = 1

    async def assign_id():
        nonlocal next_id
        db.add.call_args.args[0].id = next_id
        next_id += 1

    db = SimpleNamespace(add=Mock(), flush=AsyncMock(side_effect=assign_id))

    users = await seed_users(db)

    assert users["group"].tenant_id == users["tenant"].id
    assert users["demo"].tenant_id == users["tenant"].id
    assert users["admin"].tenant_id is None


@pytest.mark.asyncio
async def test_seed_credentials_use_group_admin_and_demo_operator():
    tenant = SimpleNamespace(id=5, name="Demo Organization")
    group = SimpleNamespace(id=7)
    demo = SimpleNamespace(id=8)
    db = SimpleNamespace(add=Mock(), commit=AsyncMock(), refresh=AsyncMock())

    credentials = await seed_credentials(db, {"tenant": tenant, "group": group, "demo": demo})

    assert [credential.created_by_user_id for credential in credentials] == [7, 8, 7]
    assert all(credential.tenant_id == tenant.id for credential in credentials)


@pytest.mark.asyncio
async def test_seed_pki_keys_belong_to_tenant_and_are_created_by_group_admin(monkeypatch):
    tenant = SimpleNamespace(id=5, name="Demo Organization")
    tenant_admin = SimpleNamespace(id=7)
    keys = [SimpleNamespace(id=key_id) for key_id in range(1, 5)]
    root = SimpleNamespace(id=11, certificate_data=b"root", subject="Root", key_id=1)
    intermediate = SimpleNamespace(
        id=12, certificate_data=b"intermediate", subject="Intermediate", key_id=2
    )
    tsa = SimpleNamespace(id=13, certificate_data=b"tsa", subject="TSA", key_id=3)
    signing = SimpleNamespace(id=14, certificate_data=b"signing", subject="Signing", key_id=4)
    create_key = AsyncMock(side_effect=keys)
    create_root = AsyncMock(return_value=root)
    create_signed = AsyncMock(side_effect=[intermediate, tsa, signing])
    monkeypatch.setattr("app.db.seed.pki_seeder.key_service.create_key", create_key)
    monkeypatch.setattr("app.db.seed.pki_seeder.certificate_service.create_root_ca", create_root)
    monkeypatch.setattr(
        "app.db.seed.pki_seeder.certificate_service.create_signed_cert", create_signed
    )
    db = SimpleNamespace(add=Mock(), commit=AsyncMock())

    result = await seed_pki(db, {"tenant": tenant, "group": tenant_admin})

    assert result["user_key"] is keys[3]
    assert all(call.args[1] == tenant.id for call in create_key.call_args_list)
    assert all(call.kwargs["user_id"] == tenant_admin.id for call in create_key.call_args_list)
    assert create_root.await_args.kwargs["user_id"] == tenant_admin.id
    assert all(call.kwargs["user_id"] == tenant_admin.id for call in create_signed.call_args_list)
