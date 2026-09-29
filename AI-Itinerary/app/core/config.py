"""
Core configuration — loaded from environment variables via Pydantic Settings.
All secrets must be provided through environment variables. Hardcoded values
are strictly forbidden.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ───────────────────────────────────────────────────────────
    APP_NAME: str = "AI-Itinerary"
    APP_ENV: str = "development"
    APP_DEBUG: bool = False
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000

    # ── Database ──────────────────────────────────────────────────────────────
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "ai_itinerary"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    # "disable" for the local Docker postgres container (default, unchanged
    # behavior); set to "require" for managed Postgres (Azure Flexible
    # Server, Neon, Supabase, ...) which reject plain unencrypted connections.
    POSTGRES_SSL_MODE: str = "disable"

    @property
    def DATABASE_URL(self) -> str:
        url = (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
        if self.POSTGRES_SSL_MODE != "disable":
            url += f"?ssl={self.POSTGRES_SSL_MODE}"
        return url

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """URL for Alembic migrations. We use the async driver (asyncpg) for migrations too."""
        return self.DATABASE_URL

    # ── OpenAI ────────────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_FALLBACK_MODEL: str = "gpt-4.1-mini"
    OPENAI_MAX_RETRIES: int = 2
    OPENAI_TIMEOUT: int = 30

    # ── OSRM ──────────────────────────────────────────────────────────────────
    OSRM_URL: str = "http://router.project-osrm.org"

    # ── Overpass API ──────────────────────────────────────────────────────────
    OVERPASS_URL: str = "https://overpass-api.de/api/interpreter"

    # ── Cache ─────────────────────────────────────────────────────────────────
    CACHE_TTL_HOURS: int = 24

    # ── Security ──────────────────────────────────────────────────────────────
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    # Must match IAMService Jwt:Issuer and Jwt:Audience in Disa-App
    JWT_ISSUER: str = "IAMService"
    JWT_AUDIENCE: str = "IAMClient"
    API_KEY: str = "change-me"

    @property
    def validate_issuer(self) -> str:
        return self.JWT_ISSUER

    @property
    def validate_audience(self) -> str:
        return self.JWT_AUDIENCE

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60

    # ── Optional Providers ────────────────────────────────────────────────────
    AMADEUS_API_KEY: str = ""
    AMADEUS_API_SECRET: str = ""

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
