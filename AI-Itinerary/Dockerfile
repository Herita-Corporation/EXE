# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for AI-Itinerary Service
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies for C-extension wheels (e.g. some cryptography packages).
# asyncpg does NOT need libpq-dev.
# If your Docker DNS is broken and pip wheels are all pre-built, this step may succeed
# even without gcc because pip downloads binary wheels from PyPI.
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update --fix-missing -o Acquire::Retries=3 \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/* \
    || echo "WARNING: apt-get failed, continuing with pre-built wheels only"

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Security: non-root user
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY --chown=appuser:appgroup . .

# Ensure non-root
USER appuser

# Expose port
EXPOSE 8000

# Health check
# Note: Using python -c to avoid curl dependency and minimize image size
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()" || exit 1

# Graceful shutdown: uvicorn handles SIGTERM
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "4", "--timeout-graceful-shutdown", "30"]
