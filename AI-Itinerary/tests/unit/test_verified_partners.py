from app.data.partner_catalog import apply_partner_stops, partner_point
from app.schemas.itinerary import Activity, DayPlan
from app.integrations.osm_client import _normalise_locality


def day(city, kind, name):
    return DayPlan(date="2027-01-01", city=city, activities=[
        Activity(type=kind, name=name, start_time="14:00", end_time="15:00", cost=50000)])


def test_verified_coffee_budget_and_pin():
    d = day("Quận 10, TP.HCM", "coffee", "The Coffee House")
    apply_partner_stops([d], [d.city], 2, 2000000, 500000)
    a = d.activities[0]
    assert a.name == "Su's House Coffee" and a.cost == 70000
    assert a.coordinates.lat == partner_point(a.name, d.city)[0]
    assert _normalise_locality("Quận 10,") == "quan 10"


def test_nightly_rates_and_affordability():
    for city, expected in [("Đà Lạt",700000),("Phú Quốc",2500000)]:
        d = day(city, "hotel", "Other hotel")
        apply_partner_stops([d], [city], 2, 9000000, 3000000)
        assert d.activities[0].cost == expected
    d = day("Phú Quốc", "hotel", "Budget hotel")
    apply_partner_stops([d], [d.city], 2, 2000000, 500000)
    assert d.activities[0].name == "Budget hotel"
    assert partner_point("Su's House Coffee", d.city) is None
