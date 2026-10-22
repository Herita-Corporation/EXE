import { request } from "@/api/http";
import type {
  ActivityAlternative,
  ActivityAlternativesResponse,
  GenerateItineraryRequest,
  ItineraryResponse,
} from "@/types/itinerary";

// Base: <EXPO_PUBLIC_AITOUR_API_URL>/api/v1/itinerary
// (AITour.Presentation/Controllers/AITourController.cs — proxies to the
// AI-Itinerary Python service; user_id is derived server-side from the JWT).

export function generateItinerary(payload: GenerateItineraryRequest) {
  return request<ItineraryResponse>("aiTour", "/api/v1/itinerary/generate", {
    method: "POST",
    data: payload,
    timeoutMs: 90000, // GPT-4o-mini generation: longer multi-day trips can take ~50-60s
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
