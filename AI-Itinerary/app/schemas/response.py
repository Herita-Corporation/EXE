"""
Response schemas — standard success and error response wrappers.
"""

from typing import Any, Optional

from pydantic import BaseModel


class SuccessResponse(BaseModel):
    """Generic success wrapper."""
    success: bool = True
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    """Standard error response (spec §45)."""
    success: bool = False
    error_code: str
    message: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": False,
                "error_code": "INVALID_BUDGET",
                "message": "Budget must be greater than zero.",
            }
        }
    }


class DeleteResponse(BaseModel):
    success: bool = True


class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str = "2.0.0"
