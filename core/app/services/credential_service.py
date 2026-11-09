from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.models.enums import CredentialStatus, TargetResourceType
from app.models.tenant import Tenant
from app.repositories.credential_repo import credential_repo
from app.services.log_service import log_service
from app.services.verify_log_service import verify_log_service


class CredentialService:
    async def get_public_status(self, db: AsyncSession, tracking_id: str) -> dict | None:
        credential = await credential_repo.get_by_tracking_id(db, tracking_id)
        if credential is None or credential.status == CredentialStatus.DRAFT:
            return None

        tenant_result = await db.execute(select(Tenant).where(Tenant.id == credential.tenant_id))
        tenant = tenant_result.scalar_one_or_none()
        is_issued = credential.status == CredentialStatus.ISSUED
        await verify_log_service.create_verify_log(
            db=db,
            tenant_id=credential.tenant_id,
            tracking_id=credential.tracking_id,
            credential_id=credential.id,
            signature_id=None,
            verified_by_user_id=None,
            is_valid=is_issued,
            is_not_revoked=is_issued,
            message="Văn bằng đã được phát hành." if is_issued else "Văn bằng đã bị thu hồi.",
        )
        recipient_id = credential.recipient_id
        masked_recipient_id = None
        if recipient_id:
            masked_recipient_id = (
                "*" * len(recipient_id)
                if len(recipient_id) <= 4
                else f"{recipient_id[:2]}{'*' * (len(recipient_id) - 4)}{recipient_id[-2:]}"
            )

        return {
            "tracking_id": credential.tracking_id,
            "credential_number": credential.credential_number,
            "recipient_name": credential.recipient_name,
            "recipient_id": masked_recipient_id,
            "issue_date": credential.issue_date,
            "status": credential.status,
            "revocation_reason": credential.revocation_reason,
            "revoked_at": credential.revoked_at,
            "organization_name": tenant.name if tenant else "Không xác định",
            "organization_logo_url": tenant.logo_url if tenant else None,
            "organization_website_url": tenant.website_url if tenant else None,
        }

    async def revoke(
        self,
        db: AsyncSession,
        credential_id: int,
        tenant_id: int,
        user,
        reason: str,
        password: str,
    ):
        credential = await credential_repo.get_by_id(db, credential_id, tenant_id)
        if credential is None:
            return None
        if credential.status == CredentialStatus.REVOKED:
            raise ValueError("Văn bằng đã được thu hồi trước đó.")
        if credential.status != CredentialStatus.ISSUED:
            raise ValueError("Chỉ có thể thu hồi văn bằng đã phát hành.")
        if not verify_password(password, user.password_hash):
            raise PermissionError("Mật khẩu xác nhận không chính xác.")

        credential.revoke(reason)
        credential.revoked_at = datetime.now(UTC)
        credential.revoked_by_user_id = user.id
        await db.flush()
        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=user.id,
            action="REVOKE_CREDENTIAL",
            target_type=TargetResourceType.CREDENTIAL,
            target_id=str(credential.id),
            payload={"tracking_id": credential.tracking_id, "reason": reason},
        )
        return credential


credential_service = CredentialService()
