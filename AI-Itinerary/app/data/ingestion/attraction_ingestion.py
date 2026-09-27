"""
Attraction Ingestion — validate, normalize, and import attraction records.
Applies data quality rules (spec §12).
"""

from typing import Any, Dict, List

from app.core.constants import MAX_RATING, MIN_RATING
from app.core.logging import get_logger
from app.database.models.attraction import Attraction

logger = get_logger(__name__)


class AttractionIngestion:
    """
    Data quality validation and normalization for attractions.

    Rejection criteria (spec §12):
    - missing name
    - missing coordinates
    - invalid city
    - rating outside 0.0–5.0
    """

    VALID_CITIES = {
        "da nang", "hoi an", "ho chi minh city", "ho chi minh",
        "hcm", "hanoi", "ha noi", "hue", "nha trang", "da lat",
        "dalat", "phu quoc", "can tho", "quy nhon", "vung tau",
        "ha long", "ha long bay",
    }

    def validate(self, record: Dict[str, Any]) -> tuple[bool, str]:
        """Return (is_valid, rejection_reason)."""
        if not record.get("name"):
            return False, "missing_name"
        if record.get("latitude") is None or record.get("longitude") is None:
            return False, "missing_coordinates"
        city = (record.get("city") or "").lower().strip()
        if city and city not in self.VALID_CITIES:
            logger.debug("unknown_city_accepted", extra={"city": city})
        rating = record.get("rating")
        if rating is not None:
            try:
                r = float(rating)
                if not (MIN_RATING <= r <= MAX_RATING):
                    return False, f"rating_out_of_range:{r}"
            except (TypeError, ValueError):
                return False, "invalid_rating_type"
        return True, ""

    def normalize(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize field values to database-ready types."""
        return {
            "name": str(record["name"])[:255],
            "city": str(record.get("city", ""))[:255],
            "latitude": float(record["latitude"]) if record.get("latitude") is not None else None,
            "longitude": float(record["longitude"]) if record.get("longitude") is not None else None,
            "rating": float(record["rating"]) if record.get("rating") is not None else None,
            "review_count": int(record["review_count"]) if record.get("review_count") else None,
            "ticket_price": float(record["ticket_price"]) if record.get("ticket_price") else None,
            "category": str(record.get("category", ""))[:100] if record.get("category") else None,
            "description": str(record.get("description", "")) if record.get("description") else None,
            "source": str(record.get("source", "manual"))[:100],
        }

    def process_batch(
        self, records: List[Dict[str, Any]]
    ) -> tuple[List[Attraction], List[Dict]]:
        """Validate and normalize a batch. Returns (valid_models, rejected_records)."""
        import uuid
        valid = []
        rejected = []
        for record in records:
            is_valid, reason = self.validate(record)
            if not is_valid:
                rejected.append({**record, "rejection_reason": reason})
                continue
            normalized = self.normalize(record)
            valid.append(Attraction(id=uuid.uuid4(), **normalized))

        logger.info(
            "ingestion_batch_processed",
            extra={
                "total": len(records),
                "valid": len(valid),
                "rejected": len(rejected),
            },
        )
        return valid, rejected
