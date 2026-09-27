"""Models package — import all models so SQLAlchemy discovers them."""

from app.database.models.attraction import Attraction
from app.database.models.cache import AICache
from app.database.models.embeddings import (
    AttractionEmbedding,
    HotelEmbedding,
    RestaurantEmbedding,
)
from app.database.models.hotel import Hotel
from app.database.models.itinerary import GeneratedItinerary
from app.database.models.restaurant import Restaurant

__all__ = [
    "Attraction",
    "Restaurant",
    "Hotel",
    "GeneratedItinerary",
    "AICache",
    "AttractionEmbedding",
    "RestaurantEmbedding",
    "HotelEmbedding",
]
