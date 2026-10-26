import json
from datetime import date

import pytest

from app.core.exceptions import InvalidItineraryError
from app.orchestrators.itinerary_orchestrator import (
    normalize_daily_hotel_costs,
    validate_itinerary_quality,
)
from app.planners.itinerary_builder import ItineraryBuilder, compute_total_cost
from app.schemas.itinerary import Activity, ActivityType, DayPlan


def test_rejects_truncated_nine_day_itinerary():
    raw = json.dumps({"days": [{"city": "Huế", "activities": []}]})

    with pytest.raises(InvalidItineraryError, match="expected exactly 9"):
        ItineraryBuilder().build_from_gpt_output(
            raw,
            start_date=date(2027, 1, 1),
            cities=["Huế"],
            expected_days=9,
        )


def test_accepts_and_dates_all_nine_days():
    raw = json.dumps(
        {"days": [{"city": "Huế", "activities": []} for _ in range(9)]}
    )
    days = ItineraryBuilder().build_from_gpt_output(
        raw,
        start_date=date(2027, 1, 1),
        cities=["Huế"],
        expected_days=9,
    )

    assert len(days) == 9
    assert days[0].date == "2027-01-01"
    assert days[-1].date == "2027-01-09"


def test_same_day_plan_removes_elapsed_slots_and_clamps_first_activity():
    raw = json.dumps(
        {
            "days": [
                {
                    "city": "Huế",
                    "activities": [
                        {
                            "name": "Breakfast",
                            "type": "breakfast",
                            "start_time": "08:00",
                            "end_time": "09:00",
                            "cost": 100_000,
                        },
                        {
                            "name": "Đại Nội Huế",
                            "type": "attraction",
                            "start_time": "13:00",
                            "end_time": "16:00",
                            "cost": 200_000,
                        },
                    ],
                }
            ]
        }
    )

    days = ItineraryBuilder().build_from_gpt_output(
        raw,
        start_date=date(2027, 1, 1),
        cities=["Huế"],
        expected_days=1,
        earliest_start_time="14:30",
    )

    assert len(days[0].activities) == 1
    assert days[0].activities[0].name == "Đại Nội Huế"
    assert days[0].activities[0].start_time == "14:30"


def test_same_place_gets_stable_activity_id():
    raw = json.dumps(
        {
            "days": [
                {
                    "city": "Hồ Chí Minh",
                    "activities": [
                        {
                            "name": "Chợ Bến Thành",
                            "location": "Quận 1, Thành phố Hồ Chí Minh",
                            "type": "market",
                            "start_time": "09:00",
                            "end_time": "10:00",
                            "cost": 100_000,
                        }
                    ],
                }
            ]
        }
    )
    builder = ItineraryBuilder()
    first = builder.build_from_gpt_output(raw, date(2027, 1, 1), ["Hồ Chí Minh"])
    second = builder.build_from_gpt_output(raw, date(2027, 1, 1), ["Hồ Chí Minh"])

    assert first[0].activities[0].activity_id == second[0].activities[0].activity_id


def _hotel(name: str, cost: float, start: str, end: str) -> Activity:
    return Activity(
        name=name,
        type=ActivityType.HOTEL,
        activity="Nghỉ tại khách sạn",
        start_time=start,
        end_time=end,
        cost=cost,
    )


def test_same_hotel_is_charged_only_once_per_day():
    day = DayPlan(
        date="2027-01-01",
        city="Hồ Chí Minh",
        activities=[
            _hotel("Liberty Saigon", 1_500_000, "13:00", "14:00"),
            _hotel(" liberty saigon ", 0, "20:00", "21:00"),
        ],
    )

    assert compute_total_cost([day]) == 1_500_000


def test_different_hotels_are_not_treated_as_a_free_repeat():
    day = DayPlan(
        date="2027-01-01",
        city="Hồ Chí Minh",
        activities=[
            _hotel("Liberty Saigon", 1_500_000, "13:00", "14:00"),
            _hotel("Harmony Hotel", 900_000, "14:00", "15:00"),
        ],
    )

    assert compute_total_cost([day]) == 2_400_000


def _activity(
    name: str,
    activity_type: ActivityType,
    cost: float,
    start: str,
    end: str,
) -> Activity:
    return Activity(
        name=name,
        type=activity_type,
        activity=name,
        start_time=start,
        end_time=end,
        cost=cost,
    )


def test_hotel_only_day_is_rejected():
    day = DayPlan(
        date="2027-01-01",
        city="Hà Nội",
        activities=[
            _hotel("Sofitel Legend Metropole Hanoi", 0, "14:00", "15:30"),
            _hotel("Sofitel Legend Metropole Hanoi", 0, "18:30", "20:30"),
        ],
    )
    normalize_daily_hotel_costs([day], 5_000_000)

    with pytest.raises(InvalidItineraryError, match="no named meal stop"):
        validate_itinerary_quality([day])


def test_zero_cost_hotel_rows_receive_one_nightly_charge():
    day = DayPlan(
        date="2027-01-01",
        city="Hà Nội",
        activities=[
            _hotel("Sofitel Legend Metropole Hanoi", 0, "13:00", "14:00"),
            _activity("Hồ Hoàn Kiếm", ActivityType.ATTRACTION, 0, "15:30", "17:30"),
            _activity("Nhà hàng Ngon", ActivityType.DINNER, 500_000, "18:00", "19:30"),
            _hotel("Sofitel Legend Metropole Hanoi", 0, "20:00", "21:00"),
        ],
    )

    normalize_daily_hotel_costs([day], 5_000_000)
    validate_itinerary_quality([day])

    hotel_costs = [
        activity.cost for activity in day.activities if activity.type == ActivityType.HOTEL
    ]
    assert hotel_costs == [5_000_000, 0]
    assert compute_total_cost([day]) == 5_500_000


def test_day_with_multiple_hotel_names_is_rejected():
    day = DayPlan(
        date="2027-01-01",
        city="Hà Nội",
        activities=[
            _hotel("Hotel A", 1_000_000, "13:00", "14:00"),
            _activity("Hồ Hoàn Kiếm", ActivityType.ATTRACTION, 0, "15:30", "17:30"),
            _activity("Nhà hàng Ngon", ActivityType.DINNER, 500_000, "18:00", "19:30"),
            _hotel("Hotel B", 0, "20:00", "21:00"),
        ],
    )

    with pytest.raises(InvalidItineraryError, match="multiple hotels"):
        validate_itinerary_quality([day])
