"""Generated itinerary ORM model."""

import uuid
from datetime import datetime

from sqlalchemy import INT, NUMERIC, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class GeneratedItinerary(Base):
    __tablename__ = "ai_generated_itineraries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    request_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    generated_itinerary: Mapped[dict] = mapped_column(JSONB, nullable=False)
    total_cost: Mapped[float | None] = mapped_column(NUMERIC(12, 2))
    generation_time_ms: Mapped[int | None] = mapped_column(INT)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
