"""Restaurant Ingestion — validate and normalize restaurant records."""

import uuid
from typing import Any, Dict, List

from app.core.constants import MAX_RATING, MIN_RATING
from app.core.logging import get_logger
from app.database.models.restaurant import Restaurant

logger = get_logger(__name__)


class RestaurantIngestion:
    def validate(self, record: Dict[str, Any]) -> tuple[bool, str]:
        if not record.get("name"):
            return False, "missing_name"
        if record.get("latitude") is None or record.get("longitude") is None:
            return False, "missing_coordinates"
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
        return {
            "name": str(record["name"])[:255],
            "city": str(record.get("city", ""))[:255],
            "latitude": float(record["latitude"]),
            "longitude": float(record["longitude"]),
            "rating": float(record["rating"]) if record.get("rating") is not None else None,
            "review_count": int(record["review_count"]) if record.get("review_count") else None,
            "avg_price": float(record["avg_price"]) if record.get("avg_price") else None,
            "cuisine": str(record.get("cuisine", ""))[:100] if record.get("cuisine") else None,
            "source": str(record.get("source", "manual"))[:100],
        }

    def process_batch(
        self, records: List[Dict[str, Any]]
    ) -> tuple[List[Restaurant], List[Dict]]:
        valid = []
        rejected = []
        for record in records:
            is_valid, reason = self.validate(record)
            if not is_valid:
                rejected.append({**record, "rejection_reason": reason})
                continue
            normalized = self.normalize(record)
            valid.append(Restaurant(id=uuid.uuid4(), **normalized))
        logger.info(
            "restaurant_ingestion_batch",
            extra={"total": len(records), "valid": len(valid), "rejected": len(rejected)},
        )
        return valid, rejected
