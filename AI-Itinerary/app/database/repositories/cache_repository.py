"""Cache repository — get/set/delete with TTL expiry support."""

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.database.models.cache import AICache

logger = get_logger(__name__)


class CacheRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, cache_key: str) -> Optional[dict]:
        """Return cached value if it exists and has not expired."""
        try:
            result = await self.db.execute(
                select(AICache).where(AICache.cache_key == cache_key)
            )
            record = result.scalar_one_or_none()
            if record is None:
                return None
            if record.expires_at and record.expires_at < datetime.now(timezone.utc):
                await self.delete(cache_key)
                return None
            return record.cache_value
        except Exception as exc:
            logger.warning("cache_get_failed", extra={"key": cache_key, "error": str(exc)})
            return None

    async def set(
        self,
        cache_key: str,
        value: dict,
        expires_at: Optional[datetime] = None,
    ) -> None:
        """Upsert a cache entry."""
        try:
            existing = await self.db.execute(
                select(AICache).where(AICache.cache_key == cache_key)
            )
            record = existing.scalar_one_or_none()
            if record:
                record.cache_value = value
                record.expires_at = expires_at
            else:
                record = AICache(
                    cache_key=cache_key,
                    cache_value=value,
                    expires_at=expires_at,
                )
                self.db.add(record)
            await self.db.flush()
        except Exception as exc:
            logger.warning("cache_set_failed", extra={"key": cache_key, "error": str(exc)})

    async def delete(self, cache_key: str) -> None:
        try:
            await self.db.execute(
                delete(AICache).where(AICache.cache_key == cache_key)
            )
        except Exception as exc:
            logger.warning("cache_delete_failed", extra={"key": cache_key, "error": str(exc)})
