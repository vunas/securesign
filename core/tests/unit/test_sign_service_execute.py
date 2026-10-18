import io

import pytest

from app.services.sign_service import SignService

pytestmark = pytest.mark.unit


def test_execute_pdf_signing_uses_memory_buffers_and_falls_back_without_tsa(monkeypatch):
    service = SignService()
    calls = {"sign": 0}

    monkeypatch.setattr("app.services.sign_service.signers.SimpleSigner", lambda **kwargs: object())
    monkeypatch.setattr(
        "app.services.sign_service.IncrementalPdfFileWriter",
        lambda buffer, **kwargs: ("writer", buffer),
    )
    monkeypatch.setattr(
        "app.services.sign_service.signers.PdfSignatureMetadata",
        lambda **kwargs: object(),
    )

    def fake_sign_pdf(writer, metadata, **kwargs):
        calls["sign"] += 1
        if calls["sign"] == 1:
            raise ValueError("tsa failed")
        kwargs["output"].write(b"signed")

    monkeypatch.setattr("app.services.sign_service.signers.sign_pdf", fake_sign_pdf)
    signed, signed_hash = service._execute_pdf_signing(
        pdf_bytes=b"%PDF-test",
        private_key=object(),
        end_entity_cert=object(),
        cert_registry=object(),
        timestamper=object(),
        sign_data=type(
            "SignData",
            (),
            {"signer_location": "VN", "signer_reason": "Reason", "signer_name": "Alice"},
        )(),
    )

    assert calls["sign"] == 2
    assert signed == b"signed"
    assert len(signed_hash) == 64
    assert isinstance(io.BytesIO(signed), io.BytesIO)
