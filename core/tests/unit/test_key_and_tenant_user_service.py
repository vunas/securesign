import pytest

from app.core.security import verify_password
from app.models.certificate import Certificate
from app.models.enums import CertType, UserRole
from app.models.key import Key, KeyStorageType, SignatureAlgo
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.key_schema import KeyCreate
from app.schemas.user_schema import TenantUserCreate
from app.services.key_service import KeyService
from app.services.tenant_user_service import TenantUserService

pytestmark = [pytest.mark.asyncio, pytest.mark.unit]


async def _create_tenant_and_admin(db, tenant_code: str = "service-test"):
    tenant = Tenant(
        tenant_code=tenant_code,
        name="Service Test",
        email=f"{tenant_code}@example.test",
    )
    db.add(tenant)
    await db.flush()
    admin = User(
        tenant_id=tenant.id,
        username=f"{tenant_code}-admin",
        email=f"{tenant_code}-admin@example.test",
        full_name="Tenant Admin",
        password_hash="admin-hash",
        role=UserRole.TENANT_ADMIN,
        is_active=True,
    )
    db.add(admin)
    await db.flush()
    return tenant, admin


async def test_key_service_encrypts_private_key_before_persisting(sqlite_db_session, monkeypatch):
    tenant, admin = await _create_tenant_and_admin(sqlite_db_session)
    captured = {}

    def fake_encrypt_key_envelope(private_key_pem):
        captured["plaintext"] = private_key_pem
        return b"encrypted-private-key", b"encrypted-dek", b"nonce-bytes12", 1

    monkeypatch.setattr(
        "app.services.key_service.aes_service.encrypt_key_envelope",
        fake_encrypt_key_envelope,
    )
    key_data = KeyCreate(
        key_name="tenant-signing-key",
        key_size=2048,
        algorithm=SignatureAlgo.RSA,
        storage_type=KeyStorageType.SERVER,
    )

    key = await KeyService().create_key(
        db=sqlite_db_session,
        tenant_id=tenant.id,
        key_data=key_data,
        user_id=admin.id,
    )

    assert captured["plaintext"].startswith(b"-----BEGIN PRIVATE KEY-----")
    assert key.tenant_id == tenant.id
    assert key.private_key_encrypted == b"encrypted-private-key"
    assert key.private_key_encrypted != captured["plaintext"]
    assert key.encrypted_dek == b"encrypted-dek"
    assert key.private_key_nonce == b"nonce-bytes12"
    assert key.encryption_version == 1


async def test_key_service_revokes_key_and_linked_certificate(sqlite_db_session):
    tenant, admin = await _create_tenant_and_admin(sqlite_db_session, "revoke-key")
    key = Key(
        tenant_id=tenant.id,
        key_name="key-to-revoke",
        public_key=b"public-key",
        private_key_encrypted=b"encrypted-private-key",
        key_fingerprint="fingerprint",
        algorithm=SignatureAlgo.RSA,
        storage_type=KeyStorageType.SERVER,
        is_revoked=False,
    )
    sqlite_db_session.add(key)
    await sqlite_db_session.flush()
    certificate = Certificate(
        tenant_id=tenant.id,
        key_id=key.id,
        cert_name="Signing certificate",
        cert_type=CertType.END_ENTITY,
        purpose="document_signing",
        certificate_data=b"certificate",
        is_revoked=False,
    )
    sqlite_db_session.add(certificate)
    await sqlite_db_session.flush()

    revoked_key = await KeyService().revoke_key(sqlite_db_session, key.id, tenant.id, admin.id)

    assert revoked_key is key
    assert key.is_revoked is True
    assert certificate.is_revoked is True
    assert certificate.revoked_at is not None


async def test_key_service_rotates_legacy_private_key_to_current_envelope(
    sqlite_db_session, monkeypatch
):
    tenant, admin = await _create_tenant_and_admin(sqlite_db_session, "rotate-legacy")
    key = Key(
        tenant_id=tenant.id,
        key_name="legacy-key",
        public_key=b"public-key",
        private_key_encrypted=b"legacy-encrypted-private-key",
        encrypted_dek=None,
        private_key_nonce=None,
        encryption_version=None,
        key_fingerprint="legacy-fingerprint",
        algorithm=SignatureAlgo.RSA,
        storage_type=KeyStorageType.SERVER,
        is_revoked=False,
    )
    sqlite_db_session.add(key)
    await sqlite_db_session.flush()
    encrypted_values = (
        b"rotated-private-key",
        b"rotated-dek",
        b"rotated-nonce",
        2,
    )
    decrypted_inputs = []
    encrypted_inputs = []

    def decrypt_legacy(ciphertext):
        decrypted_inputs.append(ciphertext)
        return b"decrypted-private-key"

    def encrypt_envelope(plaintext):
        encrypted_inputs.append(plaintext)
        return encrypted_values

    monkeypatch.setattr("app.services.key_service.aes_service.decrypt_key", decrypt_legacy)
    monkeypatch.setattr(
        "app.services.key_service.aes_service.encrypt_key_envelope", encrypt_envelope
    )

    rotated = await KeyService().rotate_encryption(sqlite_db_session, key.id, tenant.id, admin.id)

    assert rotated is key
    assert decrypted_inputs == [b"legacy-encrypted-private-key"]
    assert encrypted_inputs == [b"decrypted-private-key"]
    assert key.private_key_encrypted == b"rotated-private-key"
    assert key.encrypted_dek == b"rotated-dek"
    assert key.private_key_nonce == b"rotated-nonce"
    assert key.encryption_version == 2


async def test_key_service_handles_missing_and_revoked_keys(sqlite_db_session):
    tenant, admin = await _create_tenant_and_admin(sqlite_db_session, "key-edge-cases")
    service = KeyService()
    assert await service.rotate_encryption(sqlite_db_session, 999, tenant.id, admin.id) is None
    assert await service.revoke_key(sqlite_db_session, 999, tenant.id, admin.id) is None

    revoked_key = Key(
        tenant_id=tenant.id,
        key_name="already-revoked",
        public_key=b"public-key",
        private_key_encrypted=b"encrypted-private-key",
        key_fingerprint="revoked-fingerprint",
        algorithm=SignatureAlgo.RSA,
        storage_type=KeyStorageType.SERVER,
        is_revoked=True,
    )
    sqlite_db_session.add(revoked_key)
    await sqlite_db_session.flush()

    with pytest.raises(ValueError, match="đã bị thu hồi"):
        await service.rotate_encryption(sqlite_db_session, revoked_key.id, tenant.id, admin.id)
    with pytest.raises(ValueError, match="đã được thu hồi trước đó"):
        await service.revoke_key(sqlite_db_session, revoked_key.id, tenant.id, admin.id)


async def test_key_service_requires_tenant_id(sqlite_db_session):
    with pytest.raises(ValueError, match="Tenant ID là bắt buộc"):
        await KeyService().create_key(
            db=sqlite_db_session,
            tenant_id=None,
            key_data=KeyCreate(key_name="missing-tenant", key_size=2048),
        )


async def test_tenant_user_service_creates_operator_in_requested_tenant(sqlite_db_session):
    tenant, admin = await _create_tenant_and_admin(sqlite_db_session, "create-operator")
    payload = TenantUserCreate(
        username="new-operator",
        full_name="New Operator",
        email="operator@example.test",
        password="a-strong-password",
    )

    operator = await TenantUserService().create_operator(
        sqlite_db_session, tenant.id, payload, admin
    )

    assert operator.tenant_id == tenant.id
    assert operator.role == UserRole.TENANT_OPERATOR
    assert operator.is_active is True
    assert operator.username == "new-operator"
    assert verify_password(payload.password, operator.password_hash)


@pytest.mark.parametrize(
    ("username", "email"),
    [
        ("existing-operator", "new@example.test"),
        ("new-operator", "existing@example.test"),
    ],
)
async def test_tenant_user_service_rejects_duplicate_username_or_email(
    sqlite_db_session, username, email
):
    tenant, admin = await _create_tenant_and_admin(sqlite_db_session, "duplicate-operator")
    sqlite_db_session.add(
        User(
            tenant_id=tenant.id,
            username="existing-operator",
            email="existing@example.test",
            full_name="Existing Operator",
            password_hash="hash",
            role=UserRole.TENANT_OPERATOR,
            is_active=True,
        )
    )
    await sqlite_db_session.flush()
    payload = TenantUserCreate(
        username=username,
        full_name="New Operator",
        email=email,
        password="a-strong-password",
    )

    with pytest.raises(ValueError, match="đã được sử dụng"):
        await TenantUserService().create_operator(sqlite_db_session, tenant.id, payload, admin)


async def test_tenant_user_service_can_deactivate_and_reactivate_operator(sqlite_db_session):
    tenant, admin = await _create_tenant_and_admin(sqlite_db_session, "toggle-operator")
    operator = User(
        tenant_id=tenant.id,
        username="toggle-operator",
        email="toggle-operator@example.test",
        full_name="Toggle Operator",
        password_hash="hash",
        role=UserRole.TENANT_OPERATOR,
        is_active=True,
    )
    sqlite_db_session.add(operator)
    await sqlite_db_session.flush()
    service = TenantUserService()

    deactivated = await service.set_operator_active(
        sqlite_db_session, tenant.id, operator.id, False, admin
    )
    activated = await service.set_operator_active(
        sqlite_db_session, tenant.id, operator.id, True, admin
    )

    assert deactivated is operator
    assert operator.is_active is True
    assert activated is operator


async def test_tenant_user_service_does_not_change_operator_outside_tenant(sqlite_db_session):
    tenant, admin = await _create_tenant_and_admin(sqlite_db_session, "operator-owner")
    other_tenant, _ = await _create_tenant_and_admin(sqlite_db_session, "operator-other")
    operator = User(
        tenant_id=tenant.id,
        username="isolated-operator",
        password_hash="hash",
        role=UserRole.TENANT_OPERATOR,
        is_active=True,
    )
    sqlite_db_session.add(operator)
    await sqlite_db_session.flush()

    result = await TenantUserService().set_operator_active(
        sqlite_db_session, other_tenant.id, operator.id, False, admin
    )

    assert result is None
    assert operator.is_active is True
