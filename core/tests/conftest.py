from __future__ import annotations

import os
from types import SimpleNamespace
from typing import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.dependencies import get_current_user, get_db
from app.db.base import Base
from app.models.enums import UserRole

load_dotenv()


@pytest_asyncio.fixture()
async def pg_engine() -> AsyncGenerator[AsyncEngine, None]:
    database_url = os.getenv(
        "DATABASE_URL_TEST", "postgresql+asyncpg://test:test@localhost:5432/test_db"
    )
    engine = create_async_engine(database_url, echo=False, pool_pre_ping=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    try:
        yield engine
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest_asyncio.fixture()
async def db_session(pg_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    connection = await pg_engine.connect()
    outer_transaction = await connection.begin()
    TestingSessionLocal = async_sessionmaker(
        autocommit=False, autoflush=False, bind=connection, expire_on_commit=False
    )
    db = TestingSessionLocal()
    await db.begin_nested()

    @event.listens_for(db.sync_session, "after_transaction_end")
    def _restart_savepoint(session, transaction):
        if transaction.nested and not transaction._parent.nested:
            session.begin_nested()

    try:
        yield db
    finally:
        await db.close()
        if outer_transaction.is_active:
            await outer_transaction.rollback()
        await connection.close()


@pytest.fixture()
def override_get_db(db_session: AsyncSession):
    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    return _override


@pytest.fixture()
def fastapi_app_full(override_get_db) -> FastAPI:
    from app.routers import auth_router, key_router, signature_router, verify_router

    app = FastAPI()
    app.include_router(auth_router.router)
    app.include_router(signature_router.router)
    app.include_router(verify_router.router)
    app.include_router(key_router.router)
    app.dependency_overrides[get_db] = override_get_db
    return app


@pytest_asyncio.fixture()
async def client_full(fastapi_app_full: FastAPI):
    transport = ASGITransport(app=fastapi_app_full)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture()
def override_current_user_full(fastapi_app_full: FastAPI):
    from app.models.user import User

    user = User(
        id=999,
        username="test_enterprise_user",
        password_hash="hash",
        tenant_id=1,
        role=UserRole.TENANT_OPERATOR,
        is_active=True,
    )

    def _override() -> User:
        return user

    fastapi_app_full.dependency_overrides[get_current_user] = _override
    return user


@pytest.fixture()
def mock_uow():
    """
    Generic Unit of Work test double for services that need commit/rollback checks.
    """

    class MockUnitOfWork:
        def __init__(self):
            self.committed = False
            self.rolled_back = False

        async def commit(self):
            self.committed = True

        async def rollback(self):
            self.rolled_back = True

    return MockUnitOfWork()


# --- MOCK FACTORIES (ENTERPRISE PATTERN) ---


@pytest.fixture()
def mock_sign_repos(monkeypatch):

    class RepoMocker:
        def __init__(self):
            # Default Dummy Data
            self.credential = SimpleNamespace(
                id=1,
                file_name="test.pdf",
                file_download_url=None,
            )
            self.key = SimpleNamespace(
                id=1, storage_type="server", private_key_encrypted=b"ENCRYPTED"
            )
            self.cert = SimpleNamespace(
                id=1,
                certificate_data=b"DERCERT",
                is_valid_now=lambda: True,
            )

        def set_not_found(self):
            self.credential = None
            self.key = None
            self.cert = None

        def apply(self, target_module: str = "app.services.sign_service"):
            # Tự động apply monkeypatch dựa trên state hiện tại của class
            monkeypatch.setattr(
                f"{target_module}.credential_repo.get_by_id",
                AsyncMock(return_value=self.credential),
            )
            monkeypatch.setattr(
                f"{target_module}.key_repo.get_by_id", AsyncMock(return_value=self.key)
            )
            monkeypatch.setattr(
                f"{target_module}.certificate_repo.get_by_key_id",
                AsyncMock(return_value=self.cert),
            )

    return RepoMocker()
