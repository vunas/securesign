from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.certificate_service import CertificateService

pytestmark = pytest.mark.asyncio


class TestCertificateServiceSignedCert:
    async def test_create_signed_cert_intermediate_success_calls_repo_create(self, monkeypatch):
        # Arrange
        service = CertificateService()
        cert_data = SimpleNamespace(
            key_id=2,
            subject="Intermediate",
            cert_name="Inter CA",
            cert_type="intermediate",
            valid_days=365,
        )
        issuer_cert = SimpleNamespace(
            key_id=1,
            user_id=1,
            certificate_data=b"DER",
        )

        user_key_record = SimpleNamespace(id=2, public_key=b"PUB2")
        issuer_key_record = SimpleNamespace(id=1)

        monkeypatch.setattr(
            "app.services.certificate_service.key_repo.get_by_id",
            AsyncMock(
                side_effect=lambda db, key_id, user_id: (
                    user_key_record if key_id == 2 else issuer_key_record
                )
            ),
        )
        monkeypatch.setattr(
            "app.services.certificate_service.load_pem_public_key",
            lambda pub: object(),
        )
        monkeypatch.setattr(service, "_get_private_key", lambda rec: object())
        issuer_x509 = SimpleNamespace(
            subject=SimpleNamespace(
                get_attributes_for_oid=lambda oid: [SimpleNamespace(value="Root CA")]
            )
        )
        monkeypatch.setattr(
            "app.services.certificate_service.x509.load_der_x509_certificate",
            lambda data: issuer_x509,
        )

        fake_cert = SimpleNamespace(
            serial_number=999,
            not_valid_before_utc="from",
            not_valid_after_utc="to",
            public_bytes=lambda encoding: b"CERT",
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
            AsyncMock(
                side_effect=lambda **kwargs: created.update(kwargs) or SimpleNamespace(id=55)
            ),
        )
        monkeypatch.setattr("app.services.certificate_service.log_service.log_action", AsyncMock())

        # Act
        out = await service.create_signed_cert(
            db=object(),
            tenant_id=2,
            cert_data=cert_data,
            issuer_cert=issuer_cert,
        )

        # Assert
        assert out.id == 55
        assert created["key_id"] == 2
        assert created["issuer"] == "Root CA"
        assert created["subject"] == "Intermediate"
