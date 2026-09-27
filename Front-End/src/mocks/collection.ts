// MOCK — Task.Presentation stores submitted mission evidence
// (MissionEvidences table) but exposes no GET endpoint to list it back per
// user or per trip, so there's nothing for "My Collection" to actually
// fetch yet. Media items are derived from each itinerary's own days/
// activities (already real data) so the gallery still feels tied to that
// specific trip instead of showing unrelated placeholder photos.
import type { ItineraryResponse } from "@/types/itinerary";

export interface CollectionMediaItem {
  id: string;
  type: "photo" | "video";
  uri: string;
  caption: string;
  location: string;
  capturedAt: string;
}

export function getDefaultCover(itineraryId: string): string {
  return `https://picsum.photos/seed/disa-cover-${itineraryId}/600/600`;
}

export function getMockCollectionMedia(
  itinerary: ItineraryResponse
): CollectionMediaItem[] {
  return itinerary.days.flatMap((day, dayIdx) =>
    day.activities.slice(0, 2).map((activity, actIdx) => ({
      id: `${itinerary.itinerary_id}-${dayIdx}-${actIdx}`,
      type: (dayIdx + actIdx) % 3 === 0 ? "video" : "photo",
      uri: `https://picsum.photos/seed/disa-${itinerary.itinerary_id}-${dayIdx}-${actIdx}/500/500`,
      caption: activity.name,
      location: activity.location ?? day.city,
      capturedAt: day.date,
    }))
  );
}
