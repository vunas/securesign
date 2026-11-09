from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.core.request_context import request_ip, request_user_agent
from app.services.log_service import LogService


@pytest.mark.unit
@pytest.mark.asyncio
async def test_audit_log_captures_request_ip_and_user_agent():
    latest_log_result = SimpleNamespace(scalars=lambda: SimpleNamespace(first=lambda: None))
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[latest_log_result]),
        add=Mock(),
        flush=AsyncMock(),
    )
    ip_token = request_ip.set("192.0.2.10")
    agent_token = request_user_agent.set("SecureSign-Test/1.0")
    try:
        await LogService().log_action(
            db=db,
            tenant_id=7,
            user_id=3,
            action="TEST",
            target_type="SYSTEM",
            target_id="test",
        )
    finally:
        request_ip.reset(ip_token)
        request_user_agent.reset(agent_token)

    audit_log = db.add.call_args.args[0]
    assert audit_log.ip_address == "192.0.2.10"
    assert audit_log.user_agent == "SecureSign-Test/1.0"
    assert audit_log.log_hash

    db.execute.side_effect = [
        SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [audit_log]))
    ]
    assert (await LogService().verify_chain(db))["valid"] is True

    audit_log.payload = {"modified": True}
    db.execute.side_effect = [
        SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [audit_log]))
    ]
    integrity = await LogService().verify_chain(db)
    assert integrity["valid"] is False
