from calendar import monthrange
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.enums import CertType, TargetResourceType, TenantStatus, UserRole
from app.models.tenant import Tenant
from app.models.tenant_quota import TenantQuota
from app.models.user import User
from app.schemas.certificate_schema import CertificateCreate
from app.schemas.key_schema import KeyCreate
from app.schemas.tenant_schema import TenantRegistration, TenantStatusUpdate
from app.services.certificate_service import certificate_service
from app.services.key_service import key_service
from app.services.log_service import log_service


class TenantService:
    async def register(self, db: AsyncSession, request: TenantRegistration) -> Tenant:
        if len(request.password.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu không được vượt quá 72 byte UTF-8.")
        tenant_code = request.tenant_code.strip().upper()
        email = request.email.strip().lower()
        domain = request.domain.strip().lower() if request.domain else None
        username = request.admin_username.strip()

        tenant_conditions = [Tenant.tenant_code == tenant_code, Tenant.email == email]
        if domain:
            tenant_conditions.append(Tenant.domain == domain)
        existing_tenant = await db.scalar(select(Tenant).where(or_(*tenant_conditions)))
        existing_user = await db.scalar(
            select(User).where(or_(User.username == username, User.email == email))
        )
        if existing_tenant or existing_user:
            raise ValueError("Mã tổ chức, email hoặc tên đăng nhập đã được sử dụng.")

        tenant = Tenant(
            tenant_code=tenant_code,
            name=request.name.strip(),
            domain=domain,
            email=email,
            status=TenantStatus.PENDING,
        )
        db.add(tenant)
        await db.flush()
        db.add(
            User(
                tenant_id=tenant.id,
                username=username,
                email=email,
                full_name=request.admin_full_name.strip(),
                password_hash=get_password_hash(request.password),
                role=UserRole.TENANT_ADMIN,
                is_active=True,
            )
        )
        await log_service.log_action(
            db=db,
            tenant_id=tenant.id,
            user_id=None,
            action="REGISTER_TENANT",
            target_type=TargetResourceType.TENANT,
            target_id=str(tenant.id),
            payload={"tenant_code": tenant.tenant_code},
        )
        return tenant

    async def list_tenants(
        self, db: AsyncSession, status: TenantStatus | None = None
    ) -> list[Tenant]:
        statement = select(Tenant).order_by(Tenant.created_at.desc())
        if status:
            statement = statement.where(Tenant.status == status)
        result = await db.execute(statement)
        return list(result.scalars().all())

    async def review(
        self,
        db: AsyncSession,
        tenant_id: int,
        request: TenantStatusUpdate,
        reviewer: User,
    ) -> tuple[Tenant, str | None] | None:
        tenant = await db.get(Tenant, tenant_id, with_for_update=True)
        if tenant is None:
            return None
        if tenant.status != TenantStatus.PENDING:
            raise ValueError("Chỉ tổ chức đang chờ duyệt mới có thể được xét duyệt.")
        if request.status == TenantStatus.REJECTED and not (request.reason or "").strip():
            raise ValueError("Cần nêu lý do khi từ chối đăng ký.")

        tenant.status = request.status
        if request.status == TenantStatus.ACTIVE:
            today = date.today()
            period_start = today.replace(day=1)
            period_end = today.replace(day=monthrange(today.year, today.month)[1])
            db.add(
                TenantQuota(
                    tenant_id=tenant.id,
                    monthly_limit=settings.DEFAULT_MONTHLY_SIGNING_LIMIT,
                    used_count=0,
                    period_start=period_start,
                    period_end=period_end,
                )
            )
            root_certificate = await certificate_service.get_root_ca(db)
            if root_certificate is None:
                root_key = await key_service.create_key(
                    db,
                    tenant.id,
                    KeyCreate(key_name=f"{tenant.tenant_code} Root CA"),
                    user_id=reviewer.id,
                )
                root_certificate = await certificate_service.create_root_ca(
                    db,
                    tenant.id,
                    CertificateCreate(
                        cert_name=f"{tenant.tenant_code} Root CA",
                        key_id=root_key.id,
                        issuer=tenant.name,
                        subject=tenant.name,
                        valid_days=3650,
                        cert_type=CertType.ROOT,
                    ),
                    user_id=reviewer.id,
                )

            intermediate_key = await key_service.create_key(
                db,
                tenant.id,
                KeyCreate(key_name=f"{tenant.tenant_code} Intermediate CA"),
                user_id=reviewer.id,
            )
            intermediate_certificate = await certificate_service.create_signed_cert(
                db,
                tenant.id,
                CertificateCreate(
                    cert_name=f"{tenant.tenant_code} Intermediate CA",
                    key_id=intermediate_key.id,
                    issuer=root_certificate.subject,
                    subject=f"{tenant.name} Signing CA",
                    valid_days=1825,
                    cert_type=CertType.INTERMEDIATE,
                ),
                issuer_cert=root_certificate,
                user_id=reviewer.id,
            )

            signing_key = await key_service.create_key(
                db,
                tenant.id,
                KeyCreate(key_name=f"{tenant.tenant_code} Signing Key"),
                user_id=reviewer.id,
            )
            await certificate_service.create_signed_cert(
                db,
                tenant.id,
                CertificateCreate(
                    cert_name=f"{tenant.tenant_code} Signing Certificate",
                    key_id=signing_key.id,
                    issuer=intermediate_certificate.subject,
                    subject=tenant.name,
                    valid_days=365,
                    cert_type=CertType.END_ENTITY,
                ),
                issuer_cert=intermediate_certificate,
                user_id=reviewer.id,
            )
        await log_service.log_action(
            db=db,
            tenant_id=tenant.id,
            user_id=reviewer.id,
            action="REVIEW_TENANT",
            target_type=TargetResourceType.TENANT,
            target_id=str(tenant.id),
            payload={
                "status": request.status.value,
                "reason": request.reason,
            },
        )
        await db.flush()
        return tenant, None

    async def set_status(
        self, db: AsyncSession, tenant_id: int, status: TenantStatus, reviewer: User
    ) -> Tenant | None:
        tenant = await db.get(Tenant, tenant_id, with_for_update=True)
        if tenant is None:
            return None
        if tenant.status not in {TenantStatus.ACTIVE, TenantStatus.SUSPENDED}:
            raise ValueError("Chỉ có thể tạm ngưng hoặc kích hoạt lại tổ chức đã được duyệt.")
        if status not in {TenantStatus.ACTIVE, TenantStatus.SUSPENDED}:
            raise ValueError("Trạng thái quản trị không hợp lệ.")
        tenant.status = status
        await log_service.log_action(
            db=db,
            tenant_id=tenant.id,
            user_id=reviewer.id,
            action="CHANGE_TENANT_STATUS",
            target_type=TargetResourceType.TENANT,
            target_id=str(tenant.id),
            payload={"status": status.value},
        )
        await db.flush()
        return tenant

    async def update_quota(
        self, db: AsyncSession, tenant_id: int, monthly_limit: int, reviewer: User
    ) -> TenantQuota | None:
        tenant = await db.get(Tenant, tenant_id)
        if tenant is None:
            return None
        today = date.today()
        quota = await db.scalar(
            select(TenantQuota)
            .where(
                TenantQuota.tenant_id == tenant_id,
                TenantQuota.period_start <= today,
                TenantQuota.period_end >= today,
            )
            .with_for_update()
        )
        if quota is None:
            raise ValueError("Tổ chức chưa có hạn ngạch hiện tại.")
        if monthly_limit < quota.used_count:
            raise ValueError("Hạn ngạch mới không thể thấp hơn số lượt đã sử dụng.")
        quota.monthly_limit = monthly_limit
        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=reviewer.id,
            action="UPDATE_TENANT_QUOTA",
            target_type=TargetResourceType.TENANT,
            target_id=str(tenant_id),
            payload={"monthly_limit": monthly_limit},
        )
        await db.flush()
        return quota


tenant_service = TenantService()
