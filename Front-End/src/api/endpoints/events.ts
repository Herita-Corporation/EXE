import { request } from "@/api/http";
import type { DisaEvent, EventFormValues } from "@/types/events";

// Base: <EXPO_PUBLIC_IAM_API_URL>/api/events (IAMService/Controllers/EventController.cs)
// GET routes are public; POST/PUT/DELETE require the Admin role.

export function listEvents() {
  return request<DisaEvent[]>("iam", "/api/events", { auth: false });
}

export function listAllEventsForAdmin() {
  return request<DisaEvent[]>("iam", "/api/events/admin/all");
}

export function getEvent(id: string) {
  return request<DisaEvent>("iam", `/api/events/${id}`, { auth: false });
}

function toFormData(payload: EventFormValues): FormData {
  const form = new FormData();
  form.append("Title", payload.title);
  form.append("Description", payload.description);
  form.append("Tag", payload.tag);
  form.append("City", payload.city);
  form.append("StartDate", payload.startDate);
  form.append("EndDate", payload.endDate);
  if (payload.isActive != null) form.append("IsActive", String(payload.isActive));
  if (payload.coverImageUri) {
    const fileName = payload.coverImageUri.split("/").pop() ?? "cover.jpg";
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    // Same { uri, name, type } shape used by src/api/endpoints/missions.ts —
    // Task.Application/IAM.Application both bind this as IFormFile server-side.
    form.append("CoverImage", {
      uri: payload.coverImageUri,
      name: fileName,
      type: mime,
    } as unknown as Blob);
  }
  return form;
}

export function createEvent(payload: EventFormValues) {
  return request<DisaEvent>("iam", "/api/events", {
    method: "POST",
    data: toFormData(payload),
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function updateEvent(id: string, payload: EventFormValues) {
  return request<DisaEvent>("iam", `/api/events/${id}`, {
    method: "PUT",
    data: toFormData(payload),
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function deleteEvent(id: string) {
  return request<string>("iam", `/api/events/${id}`, { method: "DELETE" });
}
