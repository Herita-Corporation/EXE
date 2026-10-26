import { request } from "@/api/http";
import type {
  ActivityAlternative,
  ActivityAlternativesResponse,
  GenerateItineraryRequest,
  ItineraryResponse,
  LocationCoords,
} from "@/types/itinerary";

// Base: <EXPO_PUBLIC_AITOUR_API_URL>/api/v1/itinerary
// (AITour.Presentation/Controllers/AITourController.cs — proxies to the
// AI-Itinerary Python service; user_id is derived server-side from the JWT).

export function generateItinerary(payload: GenerateItineraryRequest) {
  const durationDays = Math.max(
    1,
    Math.round(
      (Date.parse(payload.end_date) - Date.parse(payload.start_date)) / 86_400_000
    ) + 1
  );
  // AI-Itinerary generates five days per model call. Scale the client timeout
  // with the number of chunks instead of treating five days as a product limit.
  const timeoutMs = Math.max(
    180_000,
    Math.ceil(durationDays / 5) * 120_000 + 60_000
  );

  return request<ItineraryResponse>("aiTour", "/api/v1/itinerary/generate", {
    method: "POST",
    data: payload,
    timeoutMs,
  });
}

export function getItinerary(itineraryId: string) {
  return request<ItineraryResponse>(
    "aiTour",
    `/api/v1/itinerary/${itineraryId}`
  );
}

export function deleteItinerary(itineraryId: string) {
  return request<{ success: boolean }>(
    "aiTour",
    `/api/v1/itinerary/${itineraryId}`,
    { method: "DELETE" }
  );
}

export function resolveActivityCoordinates(
  itineraryId: string,
  activityId: string
) {
  return request<LocationCoords>(
    "aiTour",
    `/api/v1/itinerary/${itineraryId}/activities/${activityId}/coordinates`,
    { method: "POST", timeoutMs: 15000 }
  );
}

export function deleteAllItineraryData() {
  return request<{ success: boolean }>("aiTour", "/api/v1/itinerary/user-data/all", {
    method: "DELETE",
  });
}

export function getActivityAlternatives(itineraryId: string, activityId: string) {
  return request<ActivityAlternativesResponse>(
    "aiTour",
    `/api/v1/itinerary/${itineraryId}/activities/${activityId}/alternatives`,
    { timeoutMs: 60000 } // GPT call — same generous cap style as generate
  );
}

export function replaceActivity(
  itineraryId: string,
  activityId: string,
  payload: ActivityAlternative
) {
  return request<ItineraryResponse>(
    "aiTour",
    `/api/v1/itinerary/${itineraryId}/activities/${activityId}`,
    { method: "PATCH", data: payload }
  );
}
