import pytest

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
async def test_sign_endpoint_returns_signature_response_shape(
    client_full, fastapi_app_full, override_current_user_full, monkeypatch
):
    # Validates: /api/signatures/sign-pdf uses dependency overrides and returns response.
    async def fake_sign_pdf(db, pdf_bytes, tenant_id: int, user_id: int, sign_data):
        assert tenant_id == override_current_user_full.tenant_id
        assert user_id == override_current_user_full.id
        assert pdf_bytes == b"%PDF-test"
        return b"%PDF-signed", "signed-hash"

    monkeypatch.setattr("app.routers.signature_router.sign_service.sign_pdf", fake_sign_pdf)

    res = await client_full.post(
        "/api/signatures/sign-pdf",
        files={"file": ("credential.pdf", b"%PDF-test", "application/pdf")},
        data={
            "credential_id": "1",
            "key_id": "2",
            "signer_name": "Test Signer",
            "signer_reason": "Reason",
            "signer_location": "VN",
        },
    )
    assert res.status_code == 200, res.text
    assert res.content == b"%PDF-signed"
    assert res.headers["x-signed-hash"] == "signed-hash"
