from unittest.mock import AsyncMock

import pytest

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
async def test_issue_endpoint_accepts_pdf_filename_with_generic_content_type(
    monkeypatch, client_full, override_current_user_full
):
    issue_credential = AsyncMock(return_value=(b"%PDF-signed", "signed-hash", "tracking-id"))
    monkeypatch.setattr(
        "app.routers.credential_router.file_service.issue_and_sign_credential",
        issue_credential,
    )
    monkeypatch.setattr(
        "app.routers.credential_router.log_service.log_action",
        AsyncMock(),
    )

    response = await client_full.post(
        "/api/credentials/issue",
        files={"file": ("certificate.pdf", b"%PDF-1.4\n", "application/octet-stream")},
        data={
            "key_id": "2",
            "recipient_name": "Nguyen Van A",
            "signer_name": "Tenant Admin",
        },
    )

    assert response.status_code == 200, response.text
    assert response.content == b"%PDF-signed"
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["x-tracking-id"] == "tracking-id"
    issue_credential.assert_awaited_once()
