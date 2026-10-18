from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.certificate_service import CertificateService

pytestmark = pytest.mark.asyncio


@pytest.fixture()
def cert_service():
    return CertificateService()


class TestCertificateServiceFlow:
    async def test_get_internal_tsa_not_found_returns_none_tuple(self, cert_service):
        # Arrange
        db = SimpleNamespace(
            execute=AsyncMock(
                return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(first=lambda: None))
            )
        )

        # Act
        tsa_cert, tsa_key = await cert_service.get_internal_tsa(db)

        # Assert
        assert tsa_cert is None
        assert tsa_key is None

    async def test_get_internal_tsa_found_returns_cert_and_key(self, cert_service, monkeypatch):
        # Arrange
        tsa_cert = SimpleNamespace(key_id=11, user_id=2)
        tsa_key = SimpleNamespace(id=11)

        db = SimpleNamespace(
            execute=AsyncMock(
                return_value=SimpleNamespace(
                    scalars=lambda: SimpleNamespace(first=lambda: tsa_cert)
                )
            )
        )
        monkeypatch.setattr(
            "app.services.certificate_service.key_repo.get_by_id",
            AsyncMock(return_value=tsa_key),
        )

        # Act
        out_cert, out_key = await cert_service.get_internal_tsa(db)

        # Assert
        assert out_cert == tsa_cert
        assert out_key == tsa_key

    async def test_create_root_ca_happy_path_calls_repository_create(
        self, cert_service, monkeypatch
    ):
        # Arrange
        key_record = SimpleNamespace(id=1, public_key=b"PUB")
        cert_data = SimpleNamespace(
            key_id=1,
            subject="CN Root",
            issuer="Org",
            cert_name="Root CA",
            cert_type="root",
            valid_days=365,
        )

        monkeypatch.setattr(
            "app.services.certificate_service.key_repo.get_by_id",
            AsyncMock(return_value=key_record),
        )
        monkeypatch.setattr(cert_service, "_get_private_key", lambda key_record: object())
        monkeypatch.setattr(
            "app.services.certificate_service.load_pem_public_key",
            lambda key_bytes: object(),
        )

        fake_cert = SimpleNamespace(
            serial_number=12345,
            not_valid_before_utc="from",
            not_valid_after_utc="to",
            public_bytes=lambda encoding: b"CERTDATA",
        )

        class DummyBuilder:
            def subject_name(self, *args, **kwargs):
                return self

            def issuer_name(self, *args, **kwargs):
                return self

            def public_key(self, *args, **kwargs):
                return self

            def serial_number(self, *args, **kwargs):
                return self

            def not_valid_before(self, *args, **kwargs):
                return self

            def not_valid_after(self, *args, **kwargs):
                return self

            def add_extension(self, *args, **kwargs):
                return self

            def sign(self, *args, **kwargs):
                return fake_cert

        monkeypatch.setattr(
            "app.services.certificate_service.x509.CertificateBuilder",
            lambda: DummyBuilder(),
        )

        created = {}
        monkeypatch.setattr(
            "app.services.certificate_service.certificate_repo.create",
            AsyncMock(side_effect=lambda **kwargs: created.update(kwargs) or SimpleNamespace(id=9)),
        )
        monkeypatch.setattr("app.services.certificate_service.log_service.log_action", AsyncMock())

        # Act
        out = await cert_service.create_root_ca(db=object(), tenant_id=3, cert_data=cert_data)

        # Assert
        assert out.id == 9
        assert created["tenant_id"] == 3
        assert created["key_id"] == 1
        assert created["cert_name"] == "Root CA"
