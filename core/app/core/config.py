from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Digital Signature PDF API"
    VERSION: str = "0.1.0"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/digital_signature_db"

    # JWT
    SECRET_KEY: str = "your-super-secret-jwt-key-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # ENCRYPTION
    ENCRYPTION_KEY: str = "uO12M9L4hN4b6s4mXqK_3jJ_n-pXGvL9QvO2zZqE2y0="
    TSA_URL: str = "http://timestamp.digicert.com"

    # Tự động đọc từ file .env nếu có, nếu không sẽ lấy giá trị mặc định ở trên
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
