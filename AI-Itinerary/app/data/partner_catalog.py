"""Curated, route-safe partner locations used during itinerary generation.

This catalogue intentionally lives on the server.  The client may display
offers, but it must not be able to inject arbitrary sponsored stops into an
AI request.  ``route_eligible`` is independent from a voucher being active:
an expired promotion may still be a legitimate place to recommend.
"""

from typing import Any
import unicodedata
import re


PARTNER_LOCATIONS: tuple[dict[str, Any], ...] = (
    {
        "id": "emerald-phu-quoc",
        "point": (10.1339473, 103.9838179),
        "name": "Emerald Boutique Hotel Phú Quốc",
        "type": "hotel",
        "address": "S09-10/SS24 Sonasea Villas và Resort, ấp Đường Bào, Phú Quốc, An Giang, Việt Nam",
        "destinations": ("phú quốc",),
        "rate_note": "Khoảng 2.500.000 VND/phòng/đêm; xác nhận sức chứa và giá với cơ sở.",
        "route_eligible": True,
    },
    {
        "id": "lat-valley-villa",
        "point": (11.9341257, 108.4475181),
        "name": "Lat Valley Villa",
        "type": "hotel",
        "address": "02 Đường Khởi Nghĩa Bắc Sơn, Xuân Hương - Đà Lạt, Lâm Đồng, Việt Nam",
        "destinations": ("đà lạt",),
        "rate_note": "Phòng 01: 1.000.000; 02–04: 1.200.000; 05 (4 khách): 1.500.000; 06: 700.000. Nguyên căn 14 khách: 6.800.000. Chưa gồm ăn sáng. Check-in 14h, check-out trước 12h.",
        "route_eligible": True,
    },
    {
        "id": "sus-house-coffee",
        "point": (10.7796465, 106.6637412),
        "name": "Su's House Coffee",
        "type": "coffee",
        "address": "CT31 Đường Tam Đảo, Cư xá Bắc Hải, Hòa Hưng, Hồ Chí Minh, Việt Nam",
        "destinations": ("hồ chí minh", "ho chi minh", "hcm", "tphcm", "sài gòn", "sai gon"),
        "rate_note": "Menu tham khảo mỗi ly: cà phê đen 30–40k, cà phê sữa 35–45k, cà phê muối 40–50k, trà sữa 45–50k VND.",
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
    city_terms = {" ".join(re.findall(r"[a-z0-9]+", _normalise(city))) for city in cities}
    eligible: list[dict[str, str]] = []
    for partner in PARTNER_LOCATIONS:
        if not partner["route_eligible"]:
            continue
        if not any(f" {_normalise(destination)} " in f" {city} " for city in city_terms for destination in partner["destinations"]):
            continue
        eligible.append(
            {
                "id": partner["id"],
                "name": partner["name"],
                "type": partner["type"],
                "address": partner["address"],
                "rate_note": partner["rate_note"],
            }
        )
    return eligible


def partner_point(name, city):
    ids = {p["id"] for p in partners_for_cities([city or ""])}
    for p in PARTNER_LOCATIONS:
        if p["id"] in ids and _normalise(name) in {_normalise(p["name"]), *({"su cafe house"} if p["type"] == "coffee" else set())}:
            return p["point"]
    return None


def apply_partner_stops(days, cities, travelers, budget, accommodation):
    """Choose equivalent slots only. Never turn a meal into a coffee break."""
    from app.schemas.itinerary import Activity, ActivityType, LocationCoords, SlotType
    used_cafe = False
    for day in days:
        eligible = partners_for_cities([day.city])
        if not eligible and not day.city.strip() and len(cities) == 1:
            eligible = partners_for_cities(cities)
        allowed = {p["id"] for p in partners_for_cities(cities)}
        for p in eligible:
            if p["id"] not in allowed:
                continue
            slots = [a for a in day.activities if a.type.value == p["type"]]
            if p["type"] == "coffee" and not slots and not used_cafe:
                # Only add a break inside a real gap near Bắc Hải, not instead of a meal.
                def minute(t):
                    h, m = map(int, t.split(":"))
                    return h * 60 + m
                for left, right in zip(day.activities, day.activities[1:]):
                    vicinity = _normalise(" ".join([day.city, left.location or "", right.location or ""]))
                    if not re.search(r"\b(quan 10|q10|hoa hung|bac hai)\b", vicinity):
                        continue
                    start = minute(left.end_time) + 15
                    if minute(right.start_time) - start < 45 or not 8*60 <= start <= 17*60:
                        continue
                    if sum(a.cost for d in days for a in d.activities) + 35000 * travelers > budget:
                        break
                    fmt = lambda m: f"{m//60:02d}:{m%60:02d}"
                    cafe = Activity(start_time=fmt(start), end_time=fmt(start+30), type=ActivityType.COFFEE,
                                    slot_type=SlotType.FLEXIBLE, name=p["name"])
                    day.activities.insert(day.activities.index(right), cafe)
                    slots = [cafe]
                    break
            if not slots:
                continue
            existing = any(_normalise(a.name) == _normalise(p["name"]) for a in slots)
            location = _normalise(day.city + (" " + cities[0] if len(cities) == 1 else ""))
            if p["type"] == "coffee":
                near = lambda text: bool(re.search(r"\b(quan 10|q\.?\s*10|hoa hung|bac hai)\b", _normalise(text)))
                compatible = [a for a in slots if near(a.location or "") or near(location)
                              or (not re.search(r"\b(quan|huyen|phuong|district|ward|thu duc|q\.?\s*\d+)\b", _normalise((a.location or "") + " " + location))
                                  and not a.coordinates)]
                if used_cafe or not (existing or compatible):
                    continue
                slots = [next((a for a in slots if _normalise(a.name) == _normalise(p["name"])), (compatible or slots)[0])]
                cost = 35000 * travelers
                note = "Cà phê sữa cỡ nhỏ, 35.000đ/khách (giá menu tham khảo)."
            elif p["id"] == "lat-valley-villa":
                # Published inventory: one room per row; up to 14 guests per villa.
                rates = {0: 0}
                for capacity, price in [(2,700000),(2,1000000),(2,1200000),(2,1200000),(2,1200000),(4,1500000)]:
                    for n, amount in list(rates.items()):
                        rates[n+capacity] = min(rates.get(n+capacity, float("inf")), amount+price)
                if travelers > 14:
                    continue
                cost = min(6800000, min(v for n,v in rates.items() if n >= travelers))
                note = "Ước tính theo bảng giá phòng/đêm, chưa bao gồm ăn sáng; cần xác nhận phòng trống."
            else:
                cost = 2500000 * ((travelers + 1)//2)
                note = "Ước tính 2.500.000đ/phòng/đêm, tạm tính 2 khách/phòng; cần xác nhận."
            old = sum(a.cost for a in slots)
            if not existing and (sum(a.cost for d in days for a in d.activities)-old+cost > budget or
                    (p["type"] == "hotel" and cost > accommodation)):
                continue
            if not existing and p["type"] == "hotel" and any(k in _normalise(cities[0]) for k in ("ganh dau", "an thoi", "tuyen lam")):
                continue
            if p["type"] == "coffee":
                used_cafe = True
            for i, a in enumerate(slots):
                a.name, a.location = p["name"], p["address"]
                a.cost = cost if i == 0 else 0
                lat, lng = next(row["point"] for row in PARTNER_LOCATIONS if row["id"] == p["id"])
                a.coordinates = LocationCoords(lat=lat, lng=lng)
                a.notes = note
                a.activity = ("Thưởng thức cà phê" if p["type"] == "coffee" else (a.activity or "Lưu trú tại khách sạn"))
