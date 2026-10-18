from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

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
