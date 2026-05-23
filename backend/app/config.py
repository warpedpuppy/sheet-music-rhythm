from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    secret_key: str = "dev-secret-key-change-me"
    admin_password: str = "admin123"
    database_url: str = f"sqlite:///{BACKEND_DIR / 'app.db'}"
    access_token_expire_minutes: int = 60 * 24
    jwt_algorithm: str = "HS256"


settings = Settings()
