"""
Custom exceptions for AI-Itinerary Service.
Each exception maps to a standard error response: {success, error_code, message}.
"""

from typing import Optional


class AIItineraryBaseException(Exception):
    """Base class for all service exceptions."""

    error_code: str = "UNKNOWN_ERROR"
    http_status: int = 500
    message: str = "An unexpected error occurred."

    def __init__(self, message: Optional[str] = None):
        self.message = message or self.__class__.message
        super().__init__(self.message)


# ── Validation Errors (HTTP 400) ──────────────────────────────────────────────

class InvalidBudgetError(AIItineraryBaseException):
    error_code = "INVALID_BUDGET"
    http_status = 400
    message = "Budget must be greater than zero."


class InvalidDateError(AIItineraryBaseException):
    error_code = "INVALID_DATE"
    http_status = 400
    message = "start_date must be less than or equal to end_date."


class InvalidCityError(AIItineraryBaseException):
    error_code = "INVALID_CITY"
    http_status = 400
    message = "At least one valid city must be provided."


# ── Resource Errors (HTTP 404 / 422) ─────────────────────────────────────────

class ItineraryNotFoundError(AIItineraryBaseException):
    error_code = "ITINERARY_NOT_FOUND"
    http_status = 404
    message = "Itinerary not found."


class ActivityNotFoundError(AIItineraryBaseException):
    error_code = "ACTIVITY_NOT_FOUND"
    http_status = 404
    message = "Activity not found in this itinerary."


class NoCandidatesFoundError(AIItineraryBaseException):
    error_code = "NO_CANDIDATES_FOUND"
    http_status = 422
    message = "No candidate locations found for the given cities and budget."


# ── Integration Errors (HTTP 502 / 503) ───────────────────────────────────────

class GPTGenerationFailedError(AIItineraryBaseException):
    error_code = "GPT_GENERATION_FAILED"
    http_status = 502
    message = "GPT itinerary generation failed after maximum retries."


class OSRMUnavailableError(AIItineraryBaseException):
    error_code = "OSRM_UNAVAILABLE"
    http_status = 502
    message = "Route optimization service is temporarily unavailable."


class DatabaseError(AIItineraryBaseException):
    error_code = "DATABASE_ERROR"
    http_status = 503
    message = "Database operation failed."


class CacheError(AIItineraryBaseException):
    error_code = "CACHE_ERROR"
    http_status = 500
    message = "Cache operation failed."


# ── Security Errors (HTTP 401 / 403) ─────────────────────────────────────────

class UnauthorizedError(AIItineraryBaseException):
    error_code = "UNAUTHORIZED"
    http_status = 401
    message = "Authentication required."


class ForbiddenError(AIItineraryBaseException):
    error_code = "FORBIDDEN"
    http_status = 403
    message = "Access denied."


# ── Validation Errors (HTTP 422) ──────────────────────────────────────────────

class BudgetExceededError(AIItineraryBaseException):
    error_code = "BUDGET_EXCEEDED"
    http_status = 422
    message = "Generated itinerary exceeds planning budget."


class InvalidItineraryError(AIItineraryBaseException):
    error_code = "INVALID_ITINERARY"
    http_status = 422
    message = "Generated itinerary failed validation."
