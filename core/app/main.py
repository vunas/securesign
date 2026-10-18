import os

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.core.config import settings
from app.core.middleware import LoggingMiddleware
from app.routers import (
    auth_router,
    certificate_router,
    credential_router,
    dashboard_router,
    key_router,
    log_router,
    signature_router,
    verify_router,
)

# 2. KHỞI TẠO FASTAPI APP
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Hệ thống Chữ ký số - Demo",
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


# 4. CẤU HÌNH GIAO DIỆN (UI) VÀ TÀI NGUYÊN TĨNH
os.makedirs("app/static/css", exist_ok=True)
os.makedirs("app/static/js", exist_ok=True)
os.makedirs("app/templates", exist_ok=True)

# Phục vụ CSS, JS từ thư mục static
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Khởi tạo Jinja2 engine để render HTML
templates = Jinja2Templates(directory="app/templates")

# 5. ĐĂNG KÝ CÁC API ROUTERS
app.include_router(auth_router.router)
app.include_router(key_router.router)
app.include_router(certificate_router.router)
app.include_router(verify_router.router)
app.include_router(credential_router.router)
app.include_router(dashboard_router.router)
app.include_router(signature_router.router)
app.include_router(log_router.router)

# ==========================================
# 6. CÁC ROUTES PHỤC VỤ GIAO DIỆN (FRONTEND)
# ==========================================


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root(request: Request):
    """Trang Chủ giới thiệu (Landing Page)"""
    return templates.TemplateResponse(request, "index.html")


@app.get("/login", response_class=HTMLResponse, include_in_schema=False)
async def login_page(request: Request):
    """Trang Đăng Nhập"""
    return templates.TemplateResponse(request, "login.html")


@app.get("/dashboard", response_class=HTMLResponse, include_in_schema=False)
async def dashboard_page(request: Request):
    """Trang Tổng Quan (Sau khi đăng nhập)"""
    return templates.TemplateResponse(request, "dashboard.html")


@app.get("/generate-key", response_class=HTMLResponse, include_in_schema=False)
async def generate_key_page(request: Request):
    """Trang Khởi Tạo Khóa"""
    return templates.TemplateResponse(request, "generate_key.html")


@app.get("/sign", response_class=HTMLResponse, include_in_schema=False)
async def sign_page(request: Request):
    return templates.TemplateResponse(request, "sign.html")


@app.get("/verify", response_class=HTMLResponse, include_in_schema=False)
async def verify_page(request: Request):
    """Trang Xác Thực Chữ Ký"""
    return templates.TemplateResponse(request, "verify.html")


@app.get("/log", response_class=HTMLResponse, include_in_schema=False)
async def log_page(request: Request):
    return templates.TemplateResponse(request, "log.html")


# 7. KHỞI CHẠY SERVER BẰNG UVICORN
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
