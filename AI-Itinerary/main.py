"""
AI-Itinerary Service — Application Entry Point
"""

import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import health, itinerary, retrieval
from app.core.config import settings
from app.core.exceptions import (
    AIItineraryBaseException,
    DatabaseError,
)
from app.core.logging import get_logger, setup_logging
from app.database.session import engine
from app.database.models import (  # noqa: F401 — ensure models are loaded
    attraction,
    cache,
    embeddings,
    hotel,
    itinerary as itinerary_model,
    restaurant,
)

setup_logging()
logger = get_logger(__name__)

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "startup",
        extra={
            "event": "service_startup",
            "app_name": settings.APP_NAME,
            "environment": settings.APP_ENV,
        },
    )
    yield
    logger.info("shutdown", extra={"event": "service_shutdown"})
    await engine.dispose()


# ── Application factory ───────────────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "AI-powered travel itinerary generation service using "
            "Retrieval-Augmented Generation (RAG) architecture."
        ),
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── Rate limiting ─────────────────────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Request-ID + structured logging middleware ────────────────────────────
    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start_time = time.monotonic()

        response = await call_next(request)

        duration_ms = int((time.monotonic() - start_time) * 1000)
        logger.info(
            "request_completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        response.headers["X-Request-ID"] = request_id
        return response

    # ── Exception handlers ────────────────────────────────────────────────────
    @app.exception_handler(AIItineraryBaseException)
    async def itinerary_exception_handler(
        request: Request, exc: AIItineraryBaseException
    ):
        return JSONResponse(
            status_code=exc.http_status,
            content={
                "success": False,
                "error_code": exc.error_code,
                "message": exc.message,
            },
        )

    @app.exception_handler(DatabaseError)
    async def database_exception_handler(request: Request, exc: DatabaseError):
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error_code": "DATABASE_UNAVAILABLE",
                "message": "Database is temporarily unavailable.",
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(
            "unhandled_exception",
            extra={"error": str(exc), "path": request.url.path},
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error_code": "UNKNOWN_ERROR",
                "message": "An unexpected error occurred.",
            },
        )

    # ── Prometheus metrics ────────────────────────────────────────────────────
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(health.router, tags=["Health"])
    app.include_router(itinerary.router, prefix="/api/v1", tags=["Itinerary"])
    app.include_router(retrieval.router, prefix="/api/v1", tags=["Retrieval"])

    return app


app = create_app()
