// Task.Presentation — default ASP.NET Core System.Text.Json output
// (camelCase, no attribute overrides on the DTOs) -> camelCase here.
import type { TranslationKey } from "@/i18n/LocaleContext";

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
  /** Itinerary the mission was assigned from (older servers omit it). */
  tripId?: string;
  /** Itinerary activity_id the mission belongs to (older servers omit it). */
  placeId?: string;
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
  /** GPS of the mission's place — submissions too far from it are rejected. */
  targetLatitude?: number | null;
  targetLongitude?: number | null;
}

export interface AssignMissionRequest {
  userId: string;
  tripId: string;
  placeId: string;
  templateId: string;
  /** Overrides the mission's title (e.g. "Chụp ảnh tại Cầu Rồng") — falls back to the template's own name when omitted. */
  title?: string;
  /** GPS of the mission's place — the server checks submissions against it. */
  targetLatitude?: number | null;
  targetLongitude?: number | null;
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

/** Task.Domain.Enums.MissionStatus → translation key (render with t()). */
export const MISSION_STATUS_KEY: Record<number, TranslationKey> = {
  0: "missionStatus.assigned",
  1: "missionStatus.pendingReview",
  2: "missionStatus.completed",
  3: "missionStatus.rejected",
  4: "missionStatus.expired",
};

/** Task.Domain.Enums.MissionType → translation key (render with t()). */
export const MISSION_TYPE_KEY: Record<number, TranslationKey> = {
  1: "missionType.photo",
  2: "missionType.video",
  3: "missionType.checkIn",
};

export const MISSION_TYPE_PHOTO = 1;
export const MISSION_TYPE_VIDEO = 2;
