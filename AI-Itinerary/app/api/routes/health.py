"""
Health check and metrics endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.response import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
    tags=["Health"],
)
async def health_check(
    db: AsyncSession = Depends(get_db),
) -> HealthResponse:
    """
    Returns service health status.
    Also pings the database to confirm connectivity.
    Returns HTTP 503 if DB is unreachable (handled by global exception handler).
    """
    await db.execute(text("SELECT 1"))
    return HealthResponse(status="healthy", version="2.0.0")


@router.get(
    "/health/live",
    summary="Liveness probe (no DB check)",
    tags=["Health"],
)
async def liveness() -> dict:
    """Lightweight liveness probe for container orchestrators."""
    return {"status": "alive"}


@router.get(
    "/health/ready",
    summary="Readiness probe (with DB check)",
    tags=["Health"],
)
async def readiness(db: AsyncSession = Depends(get_db)) -> dict:
    """Readiness probe — confirms DB connection is available."""
    await db.execute(text("SELECT 1"))
    return {"status": "ready"}
