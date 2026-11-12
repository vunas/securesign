from sqlalchemy import inspect, text

from app.db.base import Base
from app.db.session import engine


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_first_login_column)
    print("Database initialized successfully (Async).")


def _ensure_first_login_column(connection) -> None:
    user_columns = {column["name"] for column in inspect(connection).get_columns("users")}
    if "initial_api_credentials_issued_at" not in user_columns:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN initial_api_credentials_issued_at TIMESTAMP")
        )

    api_key_columns = {column["name"] for column in inspect(connection).get_columns("api_keys")}
    for column in ("onboarding_secret_encrypted", "secret_delivered_at"):
        if column in api_key_columns:
            connection.execute(text(f"ALTER TABLE api_keys DROP COLUMN {column}"))
