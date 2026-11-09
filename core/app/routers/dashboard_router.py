import base64

from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import ActiveTenantUserDep, DatabaseDep
from app.models.enums import UserRole
from app.repositories.credential_repo import credential_repo
from app.repositories.key_repo import key_repo
from app.repositories.signature_repo import signature_repo
from app.services.quota_service import quota_service

router = APIRouter(prefix="/dashboard-api", tags=["Dashboard"])


@router.get("/summary")
async def get_dashboard_summary(db: DatabaseDep, current_user: ActiveTenantUserDep):
    """
    API cung cấp toàn bộ dữ liệu thống kê cho giao diện Dashboard HTML.
    """
    tenant_id = current_user.tenant_id
    if tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant role required.")
    keys = await key_repo.get_all_by_tenant(db, tenant_id)
    docs = await credential_repo.get_all_by_tenant(db, tenant_id)
    quota = await quota_service.get_current_quota(db, tenant_id)

    signatures_list = []
    for credential in docs:
        credential_signatures = await signature_repo.get_by_credential(db, credential.id)
        for sig in credential_signatures:
            sig_base64 = (
                base64.b64encode(sig.signature_value).decode("utf-8")
                if sig.signature_value
                else "N/A"
            )

            key_name = "Khóa bị ẩn/xóa"
            key = await key_repo.get_by_id(db, sig.key_id, tenant_id)
            if key:
                key_name = key.key_name

            signatures_list.append(
                {
                    "id": sig.id,
                    "credential_name": credential.file_name,
                    "key_id": sig.key_id,
                    "key_name": key_name,
                    "signer": sig.signer_name,
                    "algorithm": sig.signature_algorithm.value,
                    "signed_at": sig.created_at.strftime("%H:%M:%S %d-%m-%Y")
                    if sig.created_at
                    else "",
                    "signature_base64": sig_base64,
                }
            )

    return {
        "stats": {
            "total_keys": len(keys),
            "total_credentials": len(docs),
            "total_sigs": len(signatures_list),
            "monthly_signing_limit": quota.monthly_limit,
            "monthly_signing_used": quota.used_count,
            "period_start": quota.period_start.isoformat(),
            "period_end": quota.period_end.isoformat(),
        },
        "permissions": {
            "can_manage_api_keys": current_user.role == UserRole.TENANT_ADMIN,
            "can_revoke_credentials": current_user.role == UserRole.TENANT_ADMIN,
        },
        "keys": [
            {
                "id": k.id,
                "name": k.key_name,
                "algorithm": k.algorithm.value,
                "storage_type": k.storage_type.value,
                "created_at": k.created_at.strftime("%d-%m-%Y") if k.created_at else "",
                "public_key": k.public_key.decode("utf-8")
                if isinstance(k.public_key, bytes)
                else k.public_key,
                "key_fingerprint": k.key_fingerprint,
                "is_revoked": k.is_revoked,
            }
            for k in keys
        ],
        "credentials": [
            {
                "id": credential.id,
                "name": credential.file_name,
                "hash": credential.signed_hash or credential.original_hash,
                "size": 0,
                "tracking_id": credential.tracking_id,
                "credential_number": credential.credential_number,
                "recipient_name": credential.recipient_name,
                "status": credential.status.value,
                "revocation_reason": credential.revocation_reason,
            }
            for credential in docs
        ],
        "signatures": signatures_list,
    }
