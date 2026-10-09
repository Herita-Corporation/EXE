import type { UserMission } from "@/types/missions";

/** Completed missions that carry photo/video evidence — the user's real
 * "memories". Grouped per itinerary via UserMission.tripId. */
export function missionsWithEvidence(missions: UserMission[]): UserMission[] {
  return missions
    .filter((m) => !!m.evidenceUrl)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}

export function memoriesForTrip(missions: UserMission[], tripId: string): UserMission[] {
  return missionsWithEvidence(missions).filter((m) => m.tripId === tripId);
}
