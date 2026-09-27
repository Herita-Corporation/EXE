"""Hotel ORM model."""

import uuid
from datetime import datetime

from sqlalchemy import DECIMAL, INT, VARCHAR, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class Hotel(Base):
    __tablename__ = "hotels"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str | None] = mapped_column(VARCHAR(255))
    city: Mapped[str | None] = mapped_column(VARCHAR(255))
    latitude: Mapped[float | None] = mapped_column(DECIMAL(10, 7))
    longitude: Mapped[float | None] = mapped_column(DECIMAL(10, 7))
    rating: Mapped[float | None] = mapped_column(DECIMAL(2, 1))
    review_count: Mapped[int | None] = mapped_column(INT)
    price_per_night: Mapped[float | None] = mapped_column(DECIMAL(12, 2))
    source: Mapped[str | None] = mapped_column(VARCHAR(100))
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "city": self.city,
            "latitude": float(self.latitude) if self.latitude else None,
            "longitude": float(self.longitude) if self.longitude else None,
            "rating": float(self.rating) if self.rating else None,
            "review_count": self.review_count,
            "price_per_night": float(self.price_per_night) if self.price_per_night else 0.0,
            "source": self.source,
        }
