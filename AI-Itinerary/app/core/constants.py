"""
Application-wide constants derived from the specification.
All business-rule numbers live here — never scattered across modules.
"""

# ── Budget Planning (Section 14) ──────────────────────────────────────────────
PLANNING_BUDGET_RATIO: float = 0.70   # 70% → planned expenses
RESERVE_BUDGET_RATIO: float = 0.30    # 30% → reserve

# ── Budget Category Allocation (Section 15) ───────────────────────────────────
# Proportional split within planning budget
BUDGET_ALLOCATION = {
    "transportation": 0.25,
    "accommodation": 0.35,
    "food": 0.25,
    "attractions": 0.10,
    "contingency": 0.05,
}

# ── Realistic Price Floors (VND) ──────────────────────────────────────────────
# Used when DB has no price data or budget is very low, to prevent zero-cost assignments.
MIN_MEAL_PRICE_VND: float = 30_000        # cheapest street food / bún bò etc.
MIN_HOTEL_PRICE_VND: float = 150_000      # cheapest hostel dorm per night
MIN_ATTRACTION_PRICE_VND: float = 0       # free attractions exist (parks, beaches)
MIN_COFFEE_PRICE_VND: float = 20_000      # cà phê vỉa hè

# Price range multipliers — max ≈ min × multiplier per category
MEAL_PRICE_RANGE_MULTIPLIER: float = 2.5    # 30k → 30k–75k typical range
HOTEL_PRICE_RANGE_MULTIPLIER: float = 2.0
ATTRACTION_PRICE_RANGE_MULTIPLIER: float = 1.5

# ── Rating Rules (Section 13) ─────────────────────────────────────────────────
MIN_RATING_PREFERRED: float = 4.5
MIN_RATING_FALLBACK: float = 4.0
MAX_RATING: float = 5.0
MIN_RATING: float = 0.0

# ── Candidate Selection (Section 23) ─────────────────────────────────────────
# Increased pool sizes to support alternatives generation
MAX_ATTRACTIONS: int = 40
MAX_RESTAURANTS: int = 40
MAX_HOTELS: int = 10
MAX_MARKETS: int = 20
MAX_GPT_CONTEXT_ENTITIES: int = 60

# ── Recommendations (per flexible slot) ───────────────────────────────────────
# Each flexible slot (breakfast/lunch/dinner/coffee/market/shopping) must have
# a ranked list of 5 candidate places with priority 1-5 for user to choose from.
MIN_RECOMMENDATIONS: int = 5       # minimum number of ranked recommendations
MAX_RECOMMENDATIONS: int = 5       # target (show exactly 5)
MAX_ALTERNATIVES: int = 8          # kept for backward compat (internal pool size)
MAX_DETOUR_KM: float = 2.0         # max detour from travel route to consider

# ── GPT / OpenAI ─────────────────────────────────────────────────────────────
GPT_MAX_RETRIES: int = 2
GPT_TEMPERATURE: float = 0.2      # Low temperature for deterministic output
GPT_MAX_TOKENS: int = 4096

# ── Cache (Section 44) ────────────────────────────────────────────────────────
CACHE_TTL_HOURS: int = 24

# ── Rate Limiting (Section 49) ────────────────────────────────────────────────
RATE_LIMIT_PER_MINUTE: int = 60

# ── Activity Types (Section 42) ───────────────────────────────────────────────
ACTIVITY_TYPES = {
    "transportation",
    "breakfast",
    "lunch",
    "dinner",
    "attraction",
    "hotel",
    "shopping",
    "experience",
    "market",   # NEW — markets are NOT restaurants
    "coffee",   # NEW — coffee stops are flexible slots
}

# ── Slot Classification ───────────────────────────────────────────────────────
# Fixed slots define route anchors; flexible slots are chosen along the route.
FIXED_ACTIVITY_TYPES = {
    "hotel",
    "transportation",
    "attraction",
    "experience",
}

FLEXIBLE_ACTIVITY_TYPES = {
    "breakfast",
    "lunch",
    "dinner",
    "coffee",
    "shopping",
    "market",
}

# ── Market Category Keywords ──────────────────────────────────────────────────
# Used to reclassify attractions with these OSM categories as type=market.
MARKET_CATEGORIES = {
    "market",
    "marketplace",
    "night_market",
    "food_market",
    "floating_market",
    "traditional_market",
    "local_market",
    "wet_market",
}

# ── Time Slots ────────────────────────────────────────────────────────────────
BREAKFAST_START = "07:30"
BREAKFAST_END = "08:30"
MORNING_ATTRACTION_START = "09:00"
MORNING_ATTRACTION_END = "11:30"
LUNCH_START = "12:00"
LUNCH_END = "13:00"
AFTERNOON_ATTRACTION_START = "13:30"
AFTERNOON_ATTRACTION_END = "17:00"
DINNER_START = "18:00"
DINNER_END = "19:30"
HOTEL_CHECKIN = "20:00"
HOTEL_CHECKOUT = "20:30"

# ── Hotel-First Pattern (Day 1) ───────────────────────────────────────────────
# On the arrival day, hotel check-in must happen before sightseeing.
HOTEL_CHECKIN_DAY1_START = "13:00"   # earliest realistic check-in after travel
HOTEL_CHECKIN_DAY1_END = "14:00"
HOTEL_REST_START = "14:00"
HOTEL_REST_END = "15:30"             # rest period before going out

# ── End-of-Day Hotel Return ───────────────────────────────────────────────────
HOTEL_RETURN_START = "20:30"
HOTEL_RETURN_END = "21:00"

# ── Performance Targets (Section 66) ─────────────────────────────────────────
TARGET_LATENCY_SECONDS: int = 15
MAX_LATENCY_SECONDS: int = 30
RETRIEVAL_QUERY_MAX_MS: int = 500
ROUTE_OPTIMIZATION_MAX_SECONDS: int = 2
GPT_GENERATION_MAX_SECONDS: int = 10

# ── Supported Transport Modes (FR-06) ─────────────────────────────────────────
TRANSPORT_MODES = {
    "airplane",
    "train",
    "sleeper_bus",
    "taxi",
    "ride_hailing",
    "rental_vehicle",
}

# ── Embedding Dimensions ──────────────────────────────────────────────────────
EMBEDDING_DIMENSIONS: int = 1536   # text-embedding-ada-002 / text-embedding-3-small
