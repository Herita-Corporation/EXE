"""
Security utilities: JWT validation and API key verification.
Used as FastAPI Security dependencies.
"""

from typing import Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Scheme definitions ────────────────────────────────────────────────────────
_bearer_scheme = HTTPBearer(auto_error=False)
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


# ── JWT ───────────────────────────────────────────────────────────────────────

def decode_jwt(token: str) -> dict:
    """
    Decode and validate a JWT token.
    Validates issuer and audience to ensure the token was issued by IAMService.
    Raises UnauthorizedError on any failure.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={
                "verify_iss": True,
                "verify_aud": True,
            },
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
        )
        return payload
    except JWTError as exc:
        logger.warning("jwt_validation_failed", extra={"error": str(exc)})
        raise UnauthorizedError("Invalid or expired token.")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency that validates the Bearer JWT and returns the payload.
    Usage: current_user: dict = Depends(get_current_user)
    """
    if credentials is None:
        raise UnauthorizedError("Bearer token is required.")
    return decode_jwt(credentials.credentials)


# ── API Key ───────────────────────────────────────────────────────────────────

async def verify_api_key(
    api_key: Optional[str] = Security(_api_key_header),
) -> str:
    """
    FastAPI dependency that validates the X-API-Key header.
    Usage: _ = Depends(verify_api_key)
    """
    if api_key is None or api_key != settings.API_KEY:
        raise ForbiddenError("Invalid or missing API key.")
    return api_key


# ── Combined guard (JWT OR API Key) ──────────────────────────────────────────

async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer_scheme),
    api_key: Optional[str] = Security(_api_key_header),
) -> dict:
    """
    Accepts either a valid JWT Bearer token or a valid API key.
    Internal service calls use API keys; user-facing calls use JWT.
    """
    if api_key and api_key == settings.API_KEY:
        return {"sub": "service", "auth_method": "api_key"}
    if credentials:
        return decode_jwt(credentials.credentials)
    raise UnauthorizedError("Authentication required (Bearer token or X-API-Key).")


# ── User ID extraction from JWT ───────────────────────────────────────────────

def get_user_id_from_claims(auth_payload: dict) -> str:
    """
    Extract the user ID (sub claim) from the JWT payload.
    The 'sub' claim in IAMService JWT contains the User Guid.
    Raises UnauthorizedError if 'sub' is missing or it's a service token.
    """
    auth_method = auth_payload.get("auth_method")
    if auth_method == "api_key":
        raise UnauthorizedError("User JWT required for this endpoint (not API key).")
    
    user_id = auth_payload.get("sub")
    if not user_id or user_id == "service":
        raise UnauthorizedError("User identity not found in token claims.")
    return user_id
