import hashlib
import hmac
import json
from datetime import datetime
from enum import Enum

from fastapi.encoders import jsonable_encoder


def _enum_value(value):
    return value.value if isinstance(value, Enum) else value


def audit_hash_payload(
    *,
    previous_hash: str,
    tenant_id: int | None,
    user_id: int | None,
    action: str,
    target_type,
    target_id: str | None,
    level,
    status,
    ip_address: str | None,
    user_agent: str | None,
    payload: dict | None,
    created_at: datetime,
) -> bytes:
    record = {
        "previous_hash": previous_hash,
        "tenant_id": tenant_id,
        "user_id": user_id,
        "action": action,
        "target_type": _enum_value(target_type),
        "target_id": target_id,
        "level": _enum_value(level),
        "status": _enum_value(status),
        "ip_address": ip_address,
        "user_agent": user_agent,
        "payload": jsonable_encoder(payload or {}),
        "created_at": created_at.isoformat(),
    }
    return json.dumps(record, sort_keys=True, separators=(",", ":")).encode("utf-8")


def create_audit_hash(secret: str, **record) -> str:
    digest = hmac.new(
        secret.encode("utf-8"), audit_hash_payload(**record), hashlib.sha256
    ).hexdigest()
    return f"hmac-sha256:{digest}"


def verify_audit_hash(secret: str, entry, previous_hash: str) -> bool:
    if not entry.log_hash:
        return False
    if entry.log_hash.startswith("hmac-sha256:"):
        expected = create_audit_hash(
            secret,
            previous_hash=previous_hash,
            tenant_id=entry.tenant_id,
            user_id=entry.user_id,
            action=entry.action,
            target_type=entry.target_type,
            target_id=entry.target_id,
            level=entry.level,
            status=entry.status,
            ip_address=entry.ip_address,
            user_agent=entry.user_agent,
            payload=entry.payload,
            created_at=entry.created_at,
        )
        return hmac.compare_digest(expected, entry.log_hash)

    safe_payload = json.dumps(jsonable_encoder(entry.payload or {}), sort_keys=True)
    legacy_input = (
        f"{previous_hash}|{entry.tenant_id}|{entry.user_id}|{entry.action}|"
        f"{entry.target_type}|{entry.target_id}|{entry.status}|{safe_payload}"
    )
    expected_legacy_hash = hashlib.sha256(legacy_input.encode("utf-8")).hexdigest()
    return hmac.compare_digest(expected_legacy_hash, entry.log_hash)
