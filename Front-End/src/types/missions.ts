// Task.Presentation — default ASP.NET Core System.Text.Json output
// (camelCase, no attribute overrides on the DTOs) -> camelCase here.

export type MissionType = number; // Task.Domain.Enums.MissionType (server enum, numeric over the wire)
export type MissionStatus = number; // Task.Domain.Enums.MissionStatus

export interface MissionTemplate {
  id: string;
  name: string;
  description?: string | null;
  type: MissionType;
  rewardXP: number;
  rewardCoins: number;
  isActive: boolean;
}

export interface CreateMissionTemplateRequest {
  name: string;
  description?: string;
  type: MissionType;
  rewardXP: number;
  rewardCoins: number;
  requiresPhoto: boolean;
  requiresVideo: boolean;
  requiresLocation: boolean;
  minVideoSeconds?: number;
}

export interface UserMission {
  id: string;
  title: string;
  status: MissionStatus;
  rewardXP: number;
  rewardCoins: number;
  startAt: string;
  completedAt?: string | null;
  type: MissionType;
  requiresPhoto: boolean;
  requiresVideo: boolean;
  requiresLocation: boolean;
  minVideoSeconds?: number | null;
  /** URL of the submitted photo/video evidence — set once completed. */
  evidenceUrl?: string | null;
  /** Matches Task.Domain.Enums.EvidenceType (1 = Photo, 2 = Video). */
  evidenceType?: number | null;
}

export interface AssignMissionRequest {
  userId: string;
  tripId: string;
  placeId: string;
  templateId: string;
  /** Overrides the mission's title (e.g. "Chụp ảnh tại Cầu Rồng") — falls back to the template's own name when omitted. */
  title?: string;
}

export interface AssignMissionResponse {
  missionId: string;
  message: string;
}

export interface SubmitMissionResponse {
  submissionId: string;
  message: string;
}

export interface UserMissionSummary {
  totalXP: number;
  totalCoins: number;
  completedCount: number;
}

/** Task.Domain.Enums.MissionStatus */
export const MISSION_STATUS_LABEL: Record<number, string> = {
  0: "Đã giao", // Assigned
  1: "Chờ duyệt", // PendingReview
  2: "Hoàn thành", // Completed
  3: "Không đạt", // Rejected
  4: "Hết hạn", // Expired
};

/** Task.Domain.Enums.MissionType */
export const MISSION_TYPE_LABEL: Record<number, string> = {
  1: "Chụp ảnh",
  2: "Quay video",
  3: "Check-in",
};

export const MISSION_TYPE_PHOTO = 1;
export const MISSION_TYPE_VIDEO = 2;
