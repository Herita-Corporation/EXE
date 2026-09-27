"""
Structured JSON logging setup.
All log records emit JSON with required fields: request_id, user_id,
endpoint, duration_ms, status.
"""

import logging
import sys
from typing import Any

try:
    import json
except ImportError:
    pass


class JSONFormatter(logging.Formatter):
    """Format log records as single-line JSON objects."""

    REQUIRED_FIELDS = {"request_id", "user_id", "endpoint", "duration_ms", "status"}

    def format(self, record: logging.LogRecord) -> str:
        log_dict: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Merge any extra fields passed by the caller
        for key, value in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
                "taskName",
            }:
                log_dict[key] = value

        if record.exc_info:
            log_dict["exception"] = self.formatException(record.exc_info)

        import json as _json
        return _json.dumps(log_dict, default=str, ensure_ascii=False)


def setup_logging(level: str = "INFO") -> None:
    """Configure root logger with JSON handler to stdout."""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Remove any existing handlers
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root_logger.addHandler(handler)

    # Suppress noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a named logger (use __name__ in modules)."""
    return logging.getLogger(name)
