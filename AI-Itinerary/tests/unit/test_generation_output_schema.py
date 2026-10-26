from app.schemas.generation_output import ITINERARY_RESPONSE_FORMAT


def test_itinerary_response_schema_is_strict_and_complete():
    response_format = ITINERARY_RESPONSE_FORMAT
    schema = response_format["json_schema"]["schema"]
    activity = schema["properties"]["days"]["items"]["properties"]["activities"]["items"]

    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["strict"] is True
    assert schema["additionalProperties"] is False
    assert set(activity["required"]) == {
        "start_time", "end_time", "type", "name", "activity", "location", "cost", "rating", "notes"
    }
