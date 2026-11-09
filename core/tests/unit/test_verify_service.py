from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from starlette.datastructures import UploadFile

from app.services.verify_service import VerifyService

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
async def test_verify_pdf_signature_empty_bytes_returns_message(monkeypatch):
    service = VerifyService()
    monkeypatch.setattr("app.services.verify_service.log_service.log_action", AsyncMock())
    monkeypatch.setattr(
        "app.services.verify_service.verify_log_service.create_verify_log", AsyncMock()
    )

    result = await service.verify_pdf_signature(db=None, file=b"")

    assert result["is_valid"] is False
    assert "rỗng" in result["message"]


@pytest.mark.unit
async def test_verify_pdf_signature_without_root_ca_returns_message(monkeypatch):
    service = VerifyService()
    monkeypatch.setattr(
        "app.services.verify_service.verify_log_service.create_verify_log", AsyncMock()
    )
    monkeypatch.setattr("app.services.verify_service.log_service.log_action", AsyncMock())

    async def execute(_statement):
        return SimpleNamespace(
            scalar_one_or_none=lambda: None,
            scalars=lambda: SimpleNamespace(all=lambda: []),
        )

    db = SimpleNamespace(execute=execute)
    result = await service.verify_pdf_signature(db=db, file=b"not-a-pdf")

    assert result["is_valid"] is False
    assert "Root CA" in result["message"]


@pytest.mark.unit
async def test_verify_pdf_signature_accepts_starlette_upload_and_records_failure(monkeypatch):
    log_action = AsyncMock()
    create_verify_log = AsyncMock()
    monkeypatch.setattr("app.services.verify_service.log_service.log_action", log_action)
    monkeypatch.setattr(
        "app.services.verify_service.verify_log_service.create_verify_log",
        create_verify_log,
    )

    async def execute(_statement):
        return SimpleNamespace(
            scalar_one_or_none=lambda: None,
            scalars=lambda: SimpleNamespace(all=lambda: []),
        )

    upload = UploadFile(
        filename="signed-document.pdf",
        file=BytesIO(b"%PDF-1.4\n"),
    )
    result = await VerifyService().verify_pdf_signature(
        db=SimpleNamespace(execute=execute),
        file=upload,
        user_id=23,
        tenant_id=7,
    )

    assert result["is_valid"] is False
    assert "Root CA" in result["message"]
    log_action.assert_awaited_once()
    create_verify_log.assert_awaited_once()
    assert create_verify_log.await_args.kwargs["verified_by_user_id"] == 23
    assert create_verify_log.await_args.kwargs["tenant_id"] == 7
