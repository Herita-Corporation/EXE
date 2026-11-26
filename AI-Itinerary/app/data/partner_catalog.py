"""Curated, route-safe partner locations used during itinerary generation.

This catalogue intentionally lives on the server.  The client may display
offers, but it must not be able to inject arbitrary sponsored stops into an
AI request.  ``route_eligible`` is independent from a voucher being active:
an expired promotion may still be a legitimate place to recommend.
"""

from typing import Any
import unicodedata


PARTNER_LOCATIONS: tuple[dict[str, Any], ...] = (
    {
        "id": "emerald-phu-quoc",
        "name": "Emerald Boutique Hotel Phú Quốc",
        "type": "hotel",
        "address": "S09-10/SS24 Sonasea Villas và Resort, ấp Đường Bào, Phú Quốc, An Giang, Việt Nam",
        "destinations": ("phú quốc", "kien giang", "kiên giang", "an giang"),
        "route_eligible": True,
    },
    {
        "id": "lat-valley-villa",
        "name": "Lat Valley Villa",
        "type": "hotel",
        "address": "02 Đường Khởi Nghĩa Bắc Sơn, Xuân Hương - Đà Lạt, Lâm Đồng, Việt Nam",
        "destinations": ("đà lạt", "da lat", "lâm đồng", "lam dong"),
        "route_eligible": True,
    },
    {
        "id": "sus-house-coffee",
        "name": "Su's House Coffee",
        "type": "coffee",
        "address": "CT31 Đường Tam Đảo, Cư xá Bắc Hải, Hòa Hưng, Hồ Chí Minh, Việt Nam",
        "destinations": ("hồ chí minh", "ho chi minh", "hcm", "tphcm", "sài gòn", "sai gon"),
        "route_eligible": True,
    },
)


def _normalise(value: str) -> str:
    return " ".join(
        unicodedata.normalize("NFD", value.casefold())
        .replace("đ", "d")
        .encode("ascii", "ignore")
        .decode("ascii")
        .split()
    )


def partners_for_cities(cities: list[str]) -> list[dict[str, str]]:
    """Return only partners geographically relevant to the requested trip."""
    city_terms = {_normalise(city) for city in cities}
    eligible: list[dict[str, str]] = []
    for partner in PARTNER_LOCATIONS:
        if not partner["route_eligible"]:
            continue
        if not any(_normalise(destination) in city_terms for destination in partner["destinations"]):
            continue
        eligible.append(
            {
                "id": partner["id"],
                "name": partner["name"],
                "type": partner["type"],
                "address": partner["address"],
            }
        )
    return eligible
