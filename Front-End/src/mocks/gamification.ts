// MOCK — no points/level/tier backend exists anywhere in Disa-App or
// AI-Itinerary. Replace with a real aggregate endpoint when one ships
// (likely on Task.Presentation, next to the mission reward fields).

export interface GamificationSummary {
  points: number;
  level: number;
  pointsToNextTier: number;
  nextTierName: string;
}

export const MOCK_GAMIFICATION: GamificationSummary = {
  points: 12450,
  level: 8,
  pointsToNextTier: 1550,
  nextTierName: "Gold Tier",
};
