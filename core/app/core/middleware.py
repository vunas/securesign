import time

from app.core.request_context import request_ip, request_user_agent
from app.utils.logger import logger


class LoggingMiddleware:
    """
    Chặn (Intercept) mọi request đi vào và response đi ra khỏi hệ thống.
    Đo lường thời gian xử lý và ghi log giám sát.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.time()
        client = scope.get("client")
        client_ip = client[0] if client else None
        headers = dict(scope.get("headers", []))
        user_agent = headers.get(b"user-agent", b"").decode("latin-1") or None
        ip_token = request_ip.set(client_ip)
        agent_token = request_user_agent.set(user_agent)
        method = scope["method"]
        url = scope["path"]
        logger.info(f"Incoming: {method} {url} - IP: {client_ip or 'Unknown'}")

        try:

            async def send_with_timing(message):
                if message["type"] == "http.response.start":
                    process_time = (time.time() - start_time) * 1000
                    headers = list(message.get("headers", []))
                    headers.append((b"x-process-time", f"{process_time:.2f}".encode("ascii")))
                    message["headers"] = headers
                    logger.info(
                        f"Outgoing: {method} {url} - Status: {message['status']} "
                        f"- Time: {process_time:.2f}ms"
                    )
                await send(message)

            await self.app(scope, receive, send_with_timing)
        except Exception:
            logger.exception(f"Request failed: {method} {url}")
            raise
        finally:
            request_ip.reset(ip_token)
            request_user_agent.reset(agent_token)
