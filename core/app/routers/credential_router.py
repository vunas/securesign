import json
from datetime import date

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.core.dependencies import ActiveTenantUserDep, DatabaseDep, TenantAdminDep
from app.models.enums import TargetResourceType
from app.repositories.credential_repo import credential_repo
from app.schemas.credential_schema import CredentialResponse
from app.schemas.public_credential_schema import CredentialRevokeRequest
from app.schemas.signature_schema import SignatureCreate
from app.services.credential_service import credential_service
from app.services.file_service import file_service
from app.services.log_service import log_service
from app.services.quota_service import QuotaExceededError

router = APIRouter(prefix="/api/credentials", tags=["Credentials"])


@router.post("/issue", status_code=status.HTTP_200_OK)
async def issue_credential(
    db: DatabaseDep,
    current_user: ActiveTenantUserDep,
    file: UploadFile = File(...),
    key_id: int = Form(...),
    recipient_name: str = Form(..., min_length=1, max_length=150),
    recipient_id: str | None = Form(None, max_length=50),
    credential_number: str | None = Form(None, max_length=100),
    issue_date: date | None = Form(None),
    metadata: str | None = Form(None),
    signer_name: str = Form(..., min_length=1, max_length=100),
    signer_reason: str = Form("Cấp phát văn bằng"),
    signer_location: str = Form("Việt Nam"),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Chỉ chấp nhận tệp PDF.")

    try:
        metadata_payload = json.loads(metadata) if metadata else None
        if metadata_payload is not None and not isinstance(metadata_payload, dict):
            raise ValueError("metadata phải là một JSON object.")

        sign_data = SignatureCreate(
            credential_id=0,
            key_id=key_id,
            signer_name=signer_name,
            signer_reason=signer_reason,
            signer_location=signer_location,
        )
        signed_pdf, signed_hash, tracking_id = await file_service.issue_and_sign_credential(
            db=db,
            file=file,
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            recipient_name=recipient_name,
            recipient_id=recipient_id,
            credential_number=credential_number,
            issue_date=issue_date,
            metadata_payload=metadata_payload,
            sign_data=sign_data,
        )
    except QuotaExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "QUOTA_EXCEEDED", "message": str(exc)},
        ) from exc
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await log_service.log_action(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="ISSUE_CREDENTIAL",
        target_type=TargetResourceType.CREDENTIAL,
        target_id=tracking_id,
        payload={"signed_hash": signed_hash},
    )
    return StreamingResponse(
        iter([signed_pdf]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="credential-signed.pdf"',
            "X-Tracking-ID": tracking_id,
            "X-Signed-Hash": signed_hash,
        },
    )


@router.get("/", response_model=list[CredentialResponse])
async def get_my_credentials(db: DatabaseDep, current_user: ActiveTenantUserDep):
    return await credential_repo.get_all_by_tenant(db, current_user.tenant_id)


@router.post("/{credential_id}/revoke", response_model=CredentialResponse)
async def revoke_credential(
    credential_id: int,
    payload: CredentialRevokeRequest,
    db: DatabaseDep,
    current_user: TenantAdminDep,
):
    if not payload.reason.strip():
        raise HTTPException(status_code=422, detail="Lý do thu hồi không được để trống.")
    try:
        credential = await credential_service.revoke(
            db,
            credential_id,
            current_user.tenant_id,
            current_user,
            payload.reason.strip(),
            payload.password,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if credential is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy văn bằng.")
    return credential
