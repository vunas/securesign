import base64
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEMO_SECRET_KEY = "securesign-demo-only-secret-key-change-before-production"
_DEMO_ENCRYPTION_KEY = "uO12M9L4hN4b6s4mXqK_3jJ_n-pXGvL9QvO2zZqE2y0="


class Settings(BaseSettings):
    PROJECT_NAME: str = "Digital Signature PDF API"
    VERSION: str = "0.1.0"
    APP_ENV: Literal["development", "test", "production"] = "development"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/digital_signature_db"

    # JWT
    SECRET_KEY: str = Field(default=_DEMO_SECRET_KEY, min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    COOKIE_SECURE: bool = False

    # ENCRYPTION
    ENCRYPTION_KEY: str = Field(default=_DEMO_ENCRYPTION_KEY, min_length=44, max_length=44)
    TSA_URL: str = "http://timestamp.digicert.com"
    PUBLIC_APP_URL: str = "http://localhost:3000"
    DEFAULT_MONTHLY_SIGNING_LIMIT: int = 1000
    MAX_UPLOAD_SIZE: int = 20 * 1024 * 1024

    @model_validator(mode="after")
    def validate_secrets(self):
        if self.APP_ENV == "production" and (
            self.SECRET_KEY == _DEMO_SECRET_KEY or self.ENCRYPTION_KEY == _DEMO_ENCRYPTION_KEY
        ):
            raise ValueError("Production requires independently generated secret keys.")

        try:
            encryption_key = base64.urlsafe_b64decode(self.ENCRYPTION_KEY.encode("ascii"))
        except (ValueError, UnicodeEncodeError) as exc:
            raise ValueError("ENCRYPTION_KEY must be URL-safe Base64.") from exc
        if len(encryption_key) != 32:
            raise ValueError("ENCRYPTION_KEY must decode to exactly 32 bytes.")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
