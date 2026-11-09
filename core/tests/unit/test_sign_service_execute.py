from types import SimpleNamespace

import pytest

from app.services.sign_service import SignService

pytestmark = pytest.mark.unit


def test_execute_pdf_signing_uses_memory_buffers_and_requires_timestamp(monkeypatch):
    service = SignService()
    calls = {"sign": 0}

    monkeypatch.setattr("app.services.sign_service.signers.SimpleSigner", lambda **kwargs: object())
    monkeypatch.setattr(
        "app.services.sign_service.IncrementalPdfFileWriter",
        lambda buffer, **kwargs: ("writer", buffer),
    )
    monkeypatch.setattr(
        "app.services.sign_service.signers.PdfSignatureMetadata",
        lambda **kwargs: SimpleNamespace(field_name=kwargs["field_name"]),
    )

    class FakePdfSigner:
        def __init__(self, *args, **kwargs):
            self.timestamper = kwargs["timestamper"]

        def sign_pdf(self, writer, output, appearance_text_params=None):
            calls["sign"] += 1
            assert appearance_text_params == {
                "url": "https://example.test/verify/id"
            }
            output.write(b"signed")

    monkeypatch.setattr("app.services.sign_service.signers.PdfSigner", FakePdfSigner)

    signed, signed_hash = service._execute_pdf_signing(
        pdf_bytes=b"%PDF-test",
        private_key=object(),
        end_entity_cert=object(),
        cert_registry=object(),
        timestamper=object(),
        sign_data=type(
            "SignData",
            (),
            {
                "signer_location": "VN",
                "signer_reason": "Reason",
                "signer_name": "Alice",
                "verification_url": "https://example.test/verify/id",
            },
        )(),
    )

    assert calls["sign"] == 1
    assert signed == b"signed"
    assert len(signed_hash) == 64
