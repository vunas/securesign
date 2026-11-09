import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from asn1crypto import keys, x509
from cryptography import x509 as crypto_x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from pyhanko_certvalidator import ValidationContext
from pyhanko_certvalidator.errors import PathBuildingError
from pyhanko_certvalidator.registry import SimpleCertificateStore

from app.models.enums import CredentialStatus
from app.services.sign_service import SignService
from app.services.verify_service import VerifyService


def _minimal_pdf() -> bytes:
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>",
    ]
    pdf = bytearray(b"%PDF-1.7\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n".encode()
    )
    return bytes(pdf)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_qr_stamp_pdf_signs_and_verifies_without_external_tsa(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = crypto_x509.Name([crypto_x509.NameAttribute(NameOID.COMMON_NAME, "QR Smoke Test")])
    certificate = (
        crypto_x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(private_key.public_key())
        .serial_number(crypto_x509.random_serial_number())
        .not_valid_before(datetime.now(UTC) - timedelta(days=1))
        .not_valid_after(datetime.now(UTC) + timedelta(days=365))
        .add_extension(crypto_x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(private_key, hashes.SHA256())
    )
    private_key_info = keys.PrivateKeyInfo.load(
        private_key.private_bytes(
            serialization.Encoding.DER,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    signer_certificate = x509.Certificate.load(
        certificate.public_bytes(serialization.Encoding.DER)
    )

    signed_pdf, _ = await asyncio.to_thread(
        SignService()._execute_pdf_signing,
        pdf_bytes=_minimal_pdf(),
        private_key=private_key_info,
        end_entity_cert=signer_certificate,
        cert_registry=SimpleCertificateStore(),
        timestamper=None,
        sign_data=SimpleNamespace(
            signer_name="QR Smoke Test",
            signer_reason="test",
            signer_location="VN",
            verification_url="https://example.test/verify/qr-smoke",
        ),
    )

    result = await asyncio.to_thread(
        VerifyService()._sync_verify_pdf_bytes,
        signed_pdf,
        ValidationContext(trust_roots=[signer_certificate]),
    )

    assert b"/ByteRange" in signed_pdf
    assert result["is_valid"] is True
    assert result["is_integrity_valid"] is True
    assert result["signer_info"]["subject"] == "Common Name: QR Smoke Test"

    credential = SimpleNamespace(
        id=42,
        tenant_id=7,
        tracking_id="qr-smoke-tracking-id",
        status=CredentialStatus.ISSUED,
        revocation_reason=None,
    )
    certificate_record = SimpleNamespace(
        certificate_data=signer_certificate.dump(),
        tenant_id=7,
        is_revoked=False,
    )

    def query_result(*, scalar=None, rows=()):
        return SimpleNamespace(
            scalar_one_or_none=lambda: scalar,
            scalars=lambda: SimpleNamespace(all=lambda: list(rows)),
        )

    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                query_result(scalar=credential),
                query_result(scalar=SimpleNamespace(name="Demo Tenant")),
                query_result(rows=[certificate_record]),
                query_result(rows=[]),
                query_result(scalar=certificate_record),
            ]
        )
    )
    log_action = AsyncMock()
    create_verify_log = AsyncMock()
    monkeypatch.setattr("app.services.verify_service.log_service.log_action", log_action)
    monkeypatch.setattr(
        "app.services.verify_service.verify_log_service.create_verify_log",
        create_verify_log,
    )

    upload_result = await VerifyService().verify_pdf_signature(
        db=db,
        file=signed_pdf,
        user_id=999,
        tenant_id=7,
    )

    assert upload_result["is_valid"] is True
    assert upload_result["tracking_id"] == "qr-smoke-tracking-id"
    assert create_verify_log.await_args.kwargs["signer_snapshot"]["subject"] == (
        "Common Name: QR Smoke Test"
    )

    monkeypatch.setattr(
        "app.services.verify_service.validation.validate_pdf_signature",
        Mock(side_effect=PathBuildingError("no trusted issuer")),
    )
    untrusted_result = await asyncio.to_thread(
        VerifyService()._sync_verify_pdf_bytes,
        signed_pdf,
        ValidationContext(trust_roots=[signer_certificate]),
    )
    assert untrusted_result["is_valid"] is False
    assert untrusted_result["signer_info"]["subject"] == "Common Name: QR Smoke Test"
