from types import SimpleNamespace

import pytest

from app.repositories.credential_repo import CredentialRepository

pytestmark = pytest.mark.asyncio


@pytest.fixture()
def credential_repo_instance():
    return CredentialRepository()


class TestCredentialRepository:
    async def test_create_valid_payload_persists_and_returns_entity(
        self, credential_repo_instance, monkeypatch
    ):
        # Arrange
        added = {}

        class DummyDB:
            def add(self, obj):
                added["obj"] = obj

            async def flush(self):
                added["flush"] = True

        monkeypatch.setattr(
            "app.repositories.credential_repo.Credential",
            lambda **kwargs: SimpleNamespace(**kwargs),
        )
        db = DummyDB()

        # Act
        credential = await credential_repo_instance.create(
            db,
            tenant_id=1,
            created_by_user_id=1,
            tracking_id="track-1",
            recipient_name="Alice",
            recipient_id="STU-1",
            issue_date="2026-01-01",
            file_name="a.pdf",
            original_hash="h",
            signed_hash="h",
        )

        # Assert
        assert credential.file_name == "a.pdf"
        assert added["obj"] == credential
        assert added["flush"] is True

    async def test_get_by_id_not_found_returns_none(self, credential_repo_instance):
        # Arrange
        db = SimpleNamespace(
            execute=lambda stmt: None,
        )

        async def _execute(stmt):
            return SimpleNamespace(scalar_one_or_none=lambda: None)

        db.execute = _execute

        # Act
        result = await credential_repo_instance.get_by_id(db, credential_id=999, tenant_id=1)

        # Assert
        assert result is None

    async def test_update_status_with_signed_path_updates_fields_and_commits(
        self, credential_repo_instance
    ):
        # Arrange
        db_obj = SimpleNamespace(status=None, signed_hash=None)
        calls = {"flush": 0}

        class DummyDB:
            async def flush(self):
                calls["flush"] += 1

        db = DummyDB()

        # Act
        out = await credential_repo_instance.update_status(
            db=db,
            db_obj=db_obj,
            status="SIGNED",
            signed_hash="abc",
        )

        # Assert
        assert out is db_obj
        assert db_obj.status == "SIGNED"
        assert db_obj.signed_hash == "abc"
        assert calls["flush"] == 1
