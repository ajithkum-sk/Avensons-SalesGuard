"""Runtime settings. Override with a .env file or real env vars."""
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    db_host: str = os.getenv("PGHOST", "localhost")
    db_port: int = int(os.getenv("PGPORT", "5432"))
    db_name: str = os.getenv("PGDATABASE", "salesguard")
    db_user: str = os.getenv("PGUSER", "salesguard")
    db_password: str = os.getenv("PGPASSWORD", "salesguard")
    cors_origins: str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = int(os.getenv("JWT_EXPIRES_MINUTES", "480"))
    reset_token_expires_minutes: int = int(os.getenv("RESET_TOKEN_EXPIRES_MINUTES", "60"))
    app_base_url: str = os.getenv("APP_BASE_URL", "http://localhost:5173")

    @property
    def dsn(self) -> str:
        return (
            f"host={self.db_host} port={self.db_port} dbname={self.db_name} "
            f"user={self.db_user} password={self.db_password}"
        )


settings = Settings()
