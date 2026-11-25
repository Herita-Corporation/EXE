from app.api.routes.trip_lifecycle import display_group

def trip(start="2026-11-08", end="2026-11-10", status="PLANNED"):
    return {"trip_summary": {"start_date": start, "end_date": end}, "lifecycle": {"status": status}}

def test_future_is_upcoming():
    assert display_group(trip(), "2026-11-07") == "UPCOMING"

def test_calendar_current_is_ongoing():
    assert display_group(trip(), "2026-11-08") == "ONGOING"

def test_completed_current_trip_is_past():
    assert display_group(trip(status="COMPLETED"), "2026-11-08") == "PAST"

def test_cancelled_future_trip_is_past():
    assert display_group(trip(status="CANCELLED"), "2026-11-07") == "PAST"

def test_old_uncompleted_trip_is_past_not_fake_visited():
    data = trip()
    assert display_group(data, "2026-11-11") == "PAST"
    assert data["lifecycle"]["status"] == "PLANNED"
