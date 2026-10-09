import { request } from "@/api/http";
import type { DisaEvent } from "@/types/events";

// Base: <EXPO_PUBLIC_IAM_API_URL>/api/events (IAMService/Controllers/EventController.cs)
// The app only reads events; they're managed server-side.

export function listEvents() {
  return request<DisaEvent[]>("iam", "/api/events", { auth: false });
}

export function getEvent(id: string) {
  return request<DisaEvent>("iam", `/api/events/${id}`, { auth: false });
}
