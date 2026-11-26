from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.middleware import LoggingMiddleware
from app.db.database import init_db
from app.routers import (
    api_key_router,
    auth_router,
    certificate_router,
    credential_router,
    dashboard_router,
    key_router,
    log_router,
    signature_router,
    tenant_router,
    tenant_user_router,
    verify_router,
)


# 2. KHỞI TẠO FASTAPI APP
@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Hệ thống Chữ ký số - Backend API",
    lifespan=lifespan,
)

# 3. ĐĂNG KÝ MIDDLEWARE (Bảo mật CORS & Ghi Log)
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health-check", tags=["System"], include_in_schema=True)
async def health_check():
    from datetime import UTC, datetime

    return {
        "status": "healthy",
        "timestamp": datetime.now(UTC).isoformat(),
        "service": settings.PROJECT_NAME,
    }


# 4. ĐĂNG KÝ CÁC API ROUTERS
app.include_router(auth_router.router)
app.include_router(api_key_router.router)
app.include_router(tenant_router.router)
app.include_router(tenant_user_router.router)
app.include_router(key_router.router)
app.include_router(certificate_router.router)
app.include_router(verify_router.router)
app.include_router(credential_router.router)
app.include_router(dashboard_router.router)
app.include_router(signature_router.router)
app.include_router(log_router.router)


@app.get("/", tags=["System"], include_in_schema=False)
async def root():
    """Root API endpoint info"""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/health-check",
    }


# 5. KHỞI CHẠY SERVER BẰNG UVICORN
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
