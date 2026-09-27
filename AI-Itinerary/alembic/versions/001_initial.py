"""Initial migration — creates all core tables and enables pgvector."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    # ── attractions ───────────────────────────────────────────────────────────
    op.create_table(
        "attractions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.VARCHAR(255), nullable=False),
        sa.Column("city", sa.VARCHAR(255)),
        sa.Column("latitude", sa.DECIMAL(10, 7)),
        sa.Column("longitude", sa.DECIMAL(10, 7)),
        sa.Column("rating", sa.DECIMAL(2, 1)),
        sa.Column("review_count", sa.INT),
        sa.Column("ticket_price", sa.NUMERIC(12, 2)),
        sa.Column("category", sa.VARCHAR(100)),
        sa.Column("description", sa.TEXT),
        sa.Column("source", sa.VARCHAR(100)),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_attractions_city", "attractions", ["city"])
    op.create_index("ix_attractions_rating", "attractions", ["rating"])

    # ── restaurants ───────────────────────────────────────────────────────────
    op.create_table(
        "restaurants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.VARCHAR(255)),
        sa.Column("city", sa.VARCHAR(255)),
        sa.Column("latitude", sa.DECIMAL(10, 7)),
        sa.Column("longitude", sa.DECIMAL(10, 7)),
        sa.Column("rating", sa.DECIMAL(2, 1)),
        sa.Column("review_count", sa.INT),
        sa.Column("avg_price", sa.NUMERIC(12, 2)),
        sa.Column("cuisine", sa.VARCHAR(100)),
        sa.Column("source", sa.VARCHAR(100)),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_restaurants_city", "restaurants", ["city"])
    op.create_index("ix_restaurants_rating", "restaurants", ["rating"])

    # ── hotels ────────────────────────────────────────────────────────────────
    op.create_table(
        "hotels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.VARCHAR(255)),
        sa.Column("city", sa.VARCHAR(255)),
        sa.Column("latitude", sa.DECIMAL(10, 7)),
        sa.Column("longitude", sa.DECIMAL(10, 7)),
        sa.Column("rating", sa.DECIMAL(2, 1)),
        sa.Column("review_count", sa.INT),
        sa.Column("price_per_night", sa.NUMERIC(12, 2)),
        sa.Column("source", sa.VARCHAR(100)),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hotels_city", "hotels", ["city"])
    op.create_index("ix_hotels_rating", "hotels", ["rating"])

    # ── ai_generated_itineraries ──────────────────────────────────────────────
    op.create_table(
        "ai_generated_itineraries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_payload", postgresql.JSONB, nullable=False),
        sa.Column("generated_itinerary", postgresql.JSONB, nullable=False),
        sa.Column("total_cost", sa.NUMERIC(12, 2)),
        sa.Column("generation_time_ms", sa.INT),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_itineraries_user_id", "ai_generated_itineraries", ["user_id"])
    op.create_index("ix_itineraries_created_at", "ai_generated_itineraries", ["created_at"])

    # ── ai_cache ──────────────────────────────────────────────────────────────
    op.create_table(
        "ai_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("cache_key", sa.TEXT, unique=True, nullable=False),
        sa.Column("cache_value", postgresql.JSONB),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_cache_key", "ai_cache", ["cache_key"])
    op.create_index("ix_cache_expires_at", "ai_cache", ["expires_at"])

    # ── vector embedding tables ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE attraction_embeddings (
            attraction_id UUID PRIMARY KEY REFERENCES attractions(id) ON DELETE CASCADE,
            embedding VECTOR(1536)
        )
    """)
    op.execute("""
        CREATE TABLE restaurant_embeddings (
            restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
            embedding VECTOR(1536)
        )
    """)
    op.execute("""
        CREATE TABLE hotel_embeddings (
            hotel_id UUID PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
            embedding VECTOR(1536)
        )
    """)

    # IVFFlat indexes for approximate nearest-neighbor search
    op.execute("CREATE INDEX ON attraction_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)")
    op.execute("CREATE INDEX ON restaurant_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)")
    op.execute("CREATE INDEX ON hotel_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)")


def downgrade() -> None:
    op.drop_table("hotel_embeddings")
    op.drop_table("restaurant_embeddings")
    op.drop_table("attraction_embeddings")
    op.drop_table("ai_cache")
    op.drop_table("ai_generated_itineraries")
    op.drop_table("hotels")
    op.drop_table("restaurants")
    op.drop_table("attractions")
    op.execute("DROP EXTENSION IF EXISTS vector")
    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp"')
