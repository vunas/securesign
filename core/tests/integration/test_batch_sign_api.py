import io
import json
import zipfile
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_db
from app.repositories import key_repo
from app.routers import api_key_router
from app.routers.api_key_router import get_api_key
from app.services.quota_service import QuotaExceededError

pytestmark = pytest.mark.asyncio


@pytest.fixture()
def batch_app():
    app = FastAPI()
    app.include_router(api_key_router.router)

    async def override_db():
        yield object()

    async def override_api_key():
        return SimpleNamespace(tenant_id=42)

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_api_key] = override_api_key
    return app


async def test_batch_sign_returns_zip_and_tracking_header(batch_app, monkeypatch):
    async def fake_issue_and_sign(*, recipient_name, **kwargs):
        return f"%PDF-signed-{recipient_name}".encode(), "hash", f"tracking-{recipient_name}"

    monkeypatch.setattr(
        api_key_router.file_service,
        "issue_and_sign_credential",
        fake_issue_and_sign,
    )

    metadata = [
        {"recipient_name": "Nguyen Van A", "signer_name": "Signer"},
        {"recipient_name": "Tran Thi B", "signer_name": "Signer"},
    ]
    files = [
        ("files", ("a.pdf", b"%PDF-a", "application/pdf")),
        ("files", ("b.pdf", b"%PDF-b", "application/pdf")),
    ]

    async with AsyncClient(
        transport=ASGITransport(app=batch_app), base_url="http://testserver"
    ) as client:
        response = await client.post(
            "/api/batch/sign",
            files=files[:2],
            data={"key_id": "1", "batch_metadata": json.dumps(metadata)},
            headers={"X-API-Key": "test-key"},
        )

    assert response.status_code == 200
    assert json.loads(response.headers["x-tracking-ids"]) == ["tracking-Nguyen Van A", "tracking-Tran Thi B"]
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert len([name for name in archive.namelist() if name.endswith(".pdf")]) == 2
        assert json.loads(archive.read("tracking-ids.json")) == [
            "tracking-Nguyen Van A",
            "tracking-Tran Thi B",
        ]


async def test_batch_sign_uses_tenant_default_key_when_key_id_is_omitted(batch_app, monkeypatch):
    async def fake_issue_and_sign(*, recipient_name, **kwargs):
        assert kwargs["sign_data"].key_id == 7
        return b"%PDF-signed", "hash", "tracking-default"

    monkeypatch.setattr(
        key_repo.key_repo,
        "get_signing_keys",
        AsyncMock(return_value=[SimpleNamespace(id=7)]),
    )
    monkeypatch.setattr(
        api_key_router.file_service,
        "issue_and_sign_credential",
        fake_issue_and_sign,
    )

    async with AsyncClient(
        transport=ASGITransport(app=batch_app), base_url="http://testserver"
    ) as client:
        response = await client.post(
            "/api/batch/sign",
            files={"files": ("a.pdf", b"%PDF-a", "application/pdf")},
            data={
                "batch_metadata": json.dumps(
                    [{"recipient_name": "Recipient", "signer_name": "Signer"}]
                )
            },
        )

    assert response.status_code == 200
    assert response.headers["x-tracking-ids"] == '["tracking-default"]'


async def test_batch_sign_maps_quota_error_to_forbidden(batch_app, monkeypatch):
    monkeypatch.setattr(
        api_key_router.file_service,
        "issue_and_sign_credential",
        AsyncMock(side_effect=QuotaExceededError("quota exhausted")),
    )

    async with AsyncClient(
        transport=ASGITransport(app=batch_app), base_url="http://testserver"
    ) as client:
        response = await client.post(
            "/api/batch/sign",
            files={"files": ("a.pdf", b"%PDF-a", "application/pdf")},
            data={
                "key_id": "1",
                "batch_metadata": json.dumps(
                    [{"recipient_name": "Recipient", "signer_name": "Signer"}]
                ),
            },
        )

    assert response.status_code == 403
    assert response.json() == {
        "detail": {"code": "QUOTA_EXCEEDED", "message": "quota exhausted"}
    }


async def test_batch_sign_maps_signing_validation_error_to_unprocessable(
    batch_app, monkeypatch
):
    monkeypatch.setattr(
        api_key_router.file_service,
        "issue_and_sign_credential",
        AsyncMock(side_effect=ValueError("PDF có mật khẩu hoặc sai cấu trúc.")),
    )

    async with AsyncClient(
        transport=ASGITransport(app=batch_app), base_url="http://testserver"
    ) as client:
        response = await client.post(
            "/api/batch/sign",
            files={"files": ("a.pdf", b"%PDF-a", "application/pdf")},
            data={
                "key_id": "1",
                "batch_metadata": json.dumps(
                    [{"recipient_name": "Recipient", "signer_name": "Signer"}]
                ),
            },
        )

    assert response.status_code == 422
    assert response.json() == {"detail": "PDF có mật khẩu hoặc sai cấu trúc."}


async def test_batch_sign_rejects_metadata_count_mismatch(batch_app):
    async with AsyncClient(
        transport=ASGITransport(app=batch_app), base_url="http://testserver"
    ) as client:
        response = await client.post(
            "/api/batch/sign",
            files=[
                ("files", ("a.pdf", b"%PDF-a", "application/pdf")),
                ("files", ("b.pdf", b"%PDF-b", "application/pdf")),
            ],
            data={
                "key_id": "1",
                "batch_metadata": json.dumps(
                    [{"recipient_name": "Recipient", "signer_name": "Signer"}]
                ),
            },
        )

    assert response.status_code == 422
    assert "tương ứng" in response.json()["detail"]
