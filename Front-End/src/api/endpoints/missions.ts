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

// Called when an itinerary is deleted — removes the still-active missions
// assigned under it (completed ones, and their earned rewards, are kept).
export function deleteMissionsForTrip(tripId: string) {
  return request<{ success: boolean }>("task", `/api/user-missions/trip/${tripId}`, {
    method: "DELETE",
  });
}

export function getUserMissionsSummary(userId: string) {
  return request<UserMissionSummary>("task", `/api/user-missions/user/${userId}/summary`);
}

// ── Mission submissions (multipart/form-data) ───────────────────────────────

export interface SubmitMissionParams {
  userMissionId: string;
  photoUri?: string | null;
  videoUri?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  takenAt?: string; // ISO string; defaults server-side to UtcNow if omitted
}

export function submitMission({
  userMissionId,
  photoUri,
  videoUri,
  latitude,
  longitude,
  takenAt,
}: SubmitMissionParams) {
  const form = new FormData();
  if (photoUri) {
    const fileName = photoUri.split("/").pop() ?? "evidence.jpg";
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    // React Native's FormData accepts this { uri, name, type } shape in
    // place of a Blob/File — Task.Application's SubmitMissionRequest.Photo
    // is bound as IFormFile on the server.
    form.append("Photo", {
      uri: photoUri,
      name: fileName,
      type: mime,
    } as unknown as Blob);
  }
  if (videoUri) {
    const fileName = videoUri.split("/").pop() ?? "evidence.mp4";
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mime = ext === "mov" ? "video/quicktime" : "video/mp4";
    // Task.Application's SubmitMissionRequest.Video is bound as IFormFile.
    form.append("Video", {
      uri: videoUri,
      name: fileName,
      type: mime,
    } as unknown as Blob);
  }
  if (latitude != null) form.append("Latitude", String(latitude));
  if (longitude != null) form.append("Longitude", String(longitude));
  if (takenAt) form.append("TakenAt", takenAt);

  return request<SubmitMissionResponse>(
    "task",
    `/api/mission-submissions/${userMissionId}`,
    {
      method: "POST",
      data: form,
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
}
