from datetime import UTC, date, datetime

import pytest

from app.models.credential import Credential
from app.models.enums import CredentialStatus, UserRole
from app.models.tenant import Tenant
from app.models.user import User
from app.services.credential_service import CredentialService

pytestmark = [pytest.mark.asyncio, pytest.mark.unit]


async def _create_credential_context(db):
    tenant = Tenant(
        tenant_code="credential-test",
        name="Credential Test",
        email="credential@example.test",
    )
    db.add(tenant)
    await db.flush()
    user = User(
        tenant_id=tenant.id,
        username="credential-admin",
        email="credential-admin@example.test",
        full_name="Credential Admin",
        password_hash="password-hash",
        role=UserRole.TENANT_ADMIN,
        is_active=True,
    )
    credential = Credential(
        tenant_id=tenant.id,
        created_by_user_id=None,
        tracking_id="credential-tracking-id",
        recipient_name="Recipient",
        issue_date=date.today(),
        original_hash="original-document-hash",
        status=CredentialStatus.ISSUED,
    )
    db.add_all([user, credential])
    await db.flush()
    return tenant, user, credential


async def test_revoke_issued_credential_records_reason_time_and_actor(
    sqlite_db_session, monkeypatch
):
    tenant, user, credential = await _create_credential_context(sqlite_db_session)
    monkeypatch.setattr("app.services.credential_service.verify_password", lambda *_: True)
    before_revoke = datetime.now(UTC)

    revoked = await CredentialService().revoke(
        db=sqlite_db_session,
        credential_id=credential.id,
        tenant_id=tenant.id,
        user=user,
        reason="Issued with incorrect information",
        password="confirmed-password",
    )

    assert revoked is credential
    assert credential.status == CredentialStatus.REVOKED
    assert credential.revocation_reason == "Issued with incorrect information"
    assert credential.revoked_at is not None
    assert before_revoke <= credential.revoked_at <= datetime.now(UTC)
    assert credential.revoked_by_user_id == user.id


async def test_revoke_rejects_incorrect_password_without_changing_credential(
    sqlite_db_session, monkeypatch
):
    tenant, user, credential = await _create_credential_context(sqlite_db_session)
    monkeypatch.setattr("app.services.credential_service.verify_password", lambda *_: False)

    with pytest.raises(PermissionError, match="Mật khẩu xác nhận không chính xác"):
        await CredentialService().revoke(
            db=sqlite_db_session,
            credential_id=credential.id,
            tenant_id=tenant.id,
            user=user,
            reason="Requested revocation",
            password="wrong-password",
        )

    assert credential.status == CredentialStatus.ISSUED
    assert credential.revocation_reason is None
    assert credential.revoked_at is None
    assert credential.revoked_by_user_id is None


async def test_revoke_rejects_already_revoked_credential(sqlite_db_session, monkeypatch):
    tenant, user, credential = await _create_credential_context(sqlite_db_session)
    credential.status = CredentialStatus.REVOKED
    await sqlite_db_session.flush()
    monkeypatch.setattr(
        "app.services.credential_service.verify_password",
        lambda *_: pytest.fail("Password must not be checked for an already-revoked credential"),
    )

    with pytest.raises(ValueError, match="đã được thu hồi trước đó"):
        await CredentialService().revoke(
            db=sqlite_db_session,
            credential_id=credential.id,
            tenant_id=tenant.id,
            user=user,
            reason="Duplicate request",
            password="password",
        )


async def test_revoke_rejects_credential_that_is_not_issued(sqlite_db_session, monkeypatch):
    tenant, user, credential = await _create_credential_context(sqlite_db_session)
    credential.status = CredentialStatus.DRAFT
    await sqlite_db_session.flush()
    monkeypatch.setattr(
        "app.services.credential_service.verify_password",
        lambda *_: pytest.fail("Password must not be checked for a draft credential"),
    )

    with pytest.raises(ValueError, match="Chỉ có thể thu hồi văn bằng đã phát hành"):
        await CredentialService().revoke(
            db=sqlite_db_session,
            credential_id=credential.id,
            tenant_id=tenant.id,
            user=user,
            reason="Draft",
            password="password",
        )


async def test_revoke_returns_none_for_credential_from_another_tenant(sqlite_db_session):
    tenant, user, credential = await _create_credential_context(sqlite_db_session)
    other_tenant = Tenant(
        tenant_code="other-tenant",
        name="Other Tenant",
        email="other@example.test",
    )
    sqlite_db_session.add(other_tenant)
    await sqlite_db_session.flush()

    result = await CredentialService().revoke(
        db=sqlite_db_session,
        credential_id=credential.id,
        tenant_id=other_tenant.id,
        user=user,
        reason="Cross-tenant attempt",
        password="password",
    )

    assert result is None
    assert credential.tenant_id == tenant.id
    assert credential.status == CredentialStatus.ISSUED


async def test_public_status_hides_missing_or_draft_credentials(sqlite_db_session, monkeypatch):
    _, _, credential = await _create_credential_context(sqlite_db_session)
    credential.status = CredentialStatus.DRAFT
    await sqlite_db_session.flush()
    monkeypatch.setattr(
        "app.services.credential_service.verify_log_service.create_verify_log",
        lambda **_: pytest.fail("Draft credentials must not create public verification logs"),
    )

    service = CredentialService()
    assert await service.get_public_status(sqlite_db_session, "not-found") is None
    assert await service.get_public_status(sqlite_db_session, credential.tracking_id) is None


@pytest.mark.parametrize(
    ("status", "recipient_id", "expected_recipient_id", "is_valid"),
    [
        (CredentialStatus.ISSUED, "123456789", "12*****89", True),
        (CredentialStatus.REVOKED, "1234", "****", False),
    ],
)
async def test_public_status_returns_masked_identity_and_verification_outcome(
    sqlite_db_session,
    monkeypatch,
    status,
    recipient_id,
    expected_recipient_id,
    is_valid,
):
    tenant, _, credential = await _create_credential_context(sqlite_db_session)
    credential.status = status
    credential.recipient_id = recipient_id
    await sqlite_db_session.flush()
    verify_log = {}

    async def record_verify_log(**kwargs):
        verify_log.update(kwargs)

    monkeypatch.setattr(
        "app.services.credential_service.verify_log_service.create_verify_log",
        record_verify_log,
    )

    result = await CredentialService().get_public_status(sqlite_db_session, credential.tracking_id)

    assert result["status"] == status
    assert result["recipient_id"] == expected_recipient_id
    assert result["organization_name"] == tenant.name
    assert verify_log["is_valid"] is is_valid
    assert verify_log["is_not_revoked"] is is_valid
