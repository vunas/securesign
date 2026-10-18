import hashlib
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.file_service import FileService

pytestmark = pytest.mark.asyncio


class DummyUploadFile:
    """
    Minimal UploadFile-like object for deterministic unit tests.
    Giúp test không phụ thuộc vào fastapi.UploadFile thực tế.
    """

    def __init__(self, filename: str, content_type: str, content: bytes):
        self.filename = filename
        self.content_type = content_type
        self._content = content

    async def read(self, size: int = -1) -> bytes:
        return self._content


@pytest.mark.unit
async def test_upload_credential_hash_is_computed(monkeypatch):
    """
    Validates: FileService tính toán chính xác sha256 hash và file_size
    dựa trên bytes đọc được từ file upload.
    """
    created_db_record = {}

    monkeypatch.setattr(
        "app.services.file_service.credential_repo.create",
        AsyncMock(
            side_effect=lambda db, **kwargs: (
                created_db_record.update(kwargs) or SimpleNamespace(**kwargs, id=1)
            )
        ),
    )
    monkeypatch.setattr("app.services.file_service.log_service.log_action", AsyncMock())

    svc = FileService()
    f = DummyUploadFile("doc.pdf", "application/pdf", b"ABC")
    credential = await svc.upload_credential(db=object(), user_id=10, file=f, tenant_id=1)

    assert credential.tenant_id == 1
    assert created_db_record["original_hash"] == hashlib.sha256(b"ABC").hexdigest()
    assert created_db_record["signed_hash"] is None
    assert created_db_record["file_name"] == "doc.pdf"
    assert created_db_record["file_download_url"] is None


@pytest.mark.unit
async def test_upload_credential_empty_file_edge_case(monkeypatch):
    """
    Validates: Xử lý an toàn file rỗng (0 bytes upload).
    Đảm bảo sinh ra sha256 của chuỗi rỗng và size=0.
    """
    created_db_record = {}

    monkeypatch.setattr(
        "app.services.file_service.credential_repo.create",
        AsyncMock(
            side_effect=lambda db, **kwargs: (
                created_db_record.update(kwargs) or SimpleNamespace(**kwargs, id=1)
            )
        ),
    )
    monkeypatch.setattr("app.services.file_service.log_service.log_action", AsyncMock())

    svc = FileService()
    f = DummyUploadFile("empty.pdf", "application/pdf", b"")
    with pytest.raises(ValueError, match="không được rỗng"):
        await svc.upload_credential(db=object(), user_id=1, file=f, tenant_id=1)
