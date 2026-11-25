import { Platform } from "react-native";
import { request } from "@/api/http";
import type {
  AssignMissionRequest,
  AssignMissionResponse,
  CreateMissionTemplateRequest,
  MissionTemplate,
  SubmitMissionResponse,
  UserMission,
  UserMissionSummary,
} from "@/types/missions";

// Base: <EXPO_PUBLIC_TASK_API_URL>/api/...
// (Task.Presentation/Controllers/*.cs — none of these require [Authorize]
// today, but we still send the Bearer token when present.)

// ── Mission templates ("api/[controller]" -> MissionTemplateController) ────

export function listMissionTemplates() {
  return request<MissionTemplate[]>("task", "/api/MissionTemplate");
}

export function getMissionTemplate(id: string) {
  return request<MissionTemplate>("task", `/api/MissionTemplate/${id}`);
}

export function createMissionTemplate(payload: CreateMissionTemplateRequest) {
  return request<string>("task", "/api/MissionTemplate", {
    method: "POST",
    data: payload,
  });
}

// ── User missions ────────────────────────────────────────────────────────

export function assignMission(payload: AssignMissionRequest) {
  return request<AssignMissionResponse>("task", "/api/user-missions/assign", {
    method: "POST",
    data: payload,
  });
}

export function listUserMissions(userId: string) {
  return request<UserMission[]>("task", `/api/user-missions/user/${userId}`);
}

export function getUserMission(id: string) {
  return request<UserMission>("task", `/api/user-missions/${id}`);
}

// User deletes one not-yet-completed mission (the server refuses Completed ones).
export function deleteMission(id: string) {
  return request<{ success: boolean }>("task", `/api/user-missions/${id}`, {
    method: "DELETE",
  });
}

// Called when an itinerary is deleted — removes the still-active missions
// assigned under it (completed ones, and their earned rewards, are kept).
export function deleteMissionsForTrip(tripId: string) {
  return request<{ success: boolean }>("task", `/api/user-missions/trip/${tripId}`, {
    method: "DELETE",
  });
}

// Called after a new itinerary is created — removes the still-active missions
// of every itinerary not in keepTripIds (completed ones are kept).
export function pruneMissions(userId: string, keepTripIds: string[]) {
  return request<{ success: boolean }>("task", `/api/user-missions/user/${userId}/prune`, {
    method: "POST",
    data: { keepTripIds },
  });
}

export function getUserMissionsSummary(userId: string) {
  return request<UserMissionSummary>("task", `/api/user-missions/user/${userId}/summary`);
}

// ── Mission submissions (multipart/form-data) ───────────────────────────────

export interface EvidenceFile {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  file?: File;
}

export interface MissionEvidence {
  photo?: EvidenceFile | null;
  video?: EvidenceFile | null;
  latitude?: number | null;
  longitude?: number | null;
  takenAt?: string;
}

async function appendEvidence(form: FormData, field: "Photo" | "Video", evidence: EvidenceFile) {
  const fallbackName = field === "Photo" ? "evidence.jpg" : "evidence.mp4";
  if (Platform.OS === "web") {
    const file = evidence.file ?? await (await fetch(evidence.uri)).blob();
    form.append(field, file, evidence.name ?? (file.type === "image/png" ? "evidence.png" : fallbackName));
    return;
  }

  const uriName = evidence.uri.split("/").pop();
  const name = uriName?.includes(".") ? uriName : evidence.name ?? fallbackName;
  const extension = name.split(".").pop()?.toLowerCase();
  const fallbackType = field === "Photo"
    ? extension === "png" ? "image/png" : "image/jpeg"
    : extension === "mov" ? "video/quicktime" : "video/mp4";
  // React Native's FormData accepts a native file descriptor instead of a Blob.
  form.append(field, {
    uri: evidence.uri,
    name: name.includes(".") ? name : fallbackName,
    type: evidence.mimeType ?? fallbackType,
  } as unknown as Blob);
}

export async function postMissionEvidence<T>(path: string, {
  photo,
  video,
  latitude,
  longitude,
  takenAt,
}: MissionEvidence) {
  const form = new FormData();
  if (photo) await appendEvidence(form, "Photo", photo);
  if (video) await appendEvidence(form, "Video", video);
  if (latitude != null) form.append("Latitude", String(latitude));
  if (longitude != null) form.append("Longitude", String(longitude));
  if (takenAt) form.append("TakenAt", takenAt);

  return request<T>("task", path, {
    method: "POST",
    data: form,
    timeoutMs: video ? 120000 : undefined,
    ...(Platform.OS !== "web" && { headers: { "Content-Type": "multipart/form-data" } }),
  });
}

export function submitMission(userMissionId: string, evidence: MissionEvidence) {
  return postMissionEvidence<SubmitMissionResponse>(`/api/mission-submissions/${userMissionId}`, evidence);
}
