"""Vector embedding ORM models for pgvector semantic retrieval."""

import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import EMBEDDING_DIMENSIONS
from app.database.session import Base


class AttractionEmbedding(Base):
    __tablename__ = "attraction_embeddings"

    attraction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attractions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    embedding: Mapped[list] = mapped_column(Vector(EMBEDDING_DIMENSIONS))


class RestaurantEmbedding(Base):
    __tablename__ = "restaurant_embeddings"

    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        primary_key=True,
    )
    embedding: Mapped[list] = mapped_column(Vector(EMBEDDING_DIMENSIONS))


class HotelEmbedding(Base):
    __tablename__ = "hotel_embeddings"

    hotel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hotels.id", ondelete="CASCADE"),
        primary_key=True,
    )
    embedding: Mapped[list] = mapped_column(Vector(EMBEDDING_DIMENSIONS))
