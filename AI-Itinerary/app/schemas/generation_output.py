"""Strict JSON Schema used for an itinerary-generation model response."""

_ACTIVITY_TYPES = [
    "transportation", "breakfast", "lunch", "dinner", "attraction",
    "hotel", "shopping", "experience", "market", "coffee",
]

ITINERARY_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "itinerary_chunk",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["days", "total_cost"],
            "properties": {
                "days": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["date", "city", "activities"],
                        "properties": {
                            "date": {"type": "string"},
                            "city": {"type": "string"},
                            "activities": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "required": ["start_time", "end_time", "type", "name", "activity", "location", "cost", "rating", "notes"],
                                    "properties": {
                                        "start_time": {"type": "string"},
                                        "end_time": {"type": "string"},
                                        "type": {"type": "string", "enum": _ACTIVITY_TYPES},
                                        "name": {"type": "string"},
                                        "activity": {"type": "string"},
                                        "location": {"type": ["string", "null"]},
                                        "cost": {"type": "number", "minimum": 0},
                                        "rating": {"type": ["number", "null"], "minimum": 0, "maximum": 5},
                                        "notes": {"type": ["string", "null"]},
                                    },
                                },
                            },
                        },
                    },
                },
                "total_cost": {"type": "number", "minimum": 0},
            },
        },
    },
}
