// MOCK — static content, no backend involved. Images are real landmark
// photos bundled from Wikimedia Commons (same set as
// src/mocks/featuredMissions.ts — see its header comment for licensing),
// replacing the old picsum.photos placeholders.

export interface OnboardingSlide {
  /** require() asset module id. */
  image: number;
  headline: string;
  description: string;
  cta: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    image: require("@/assets/images/missions/fansipan.jpg"),
    headline: "AI Trip Planner",
    description:
      "Experience the future of travel with personalized itineraries crafted by our intelligent concierge, tailored to your unique rhythm and heritage.",
    cta: "Next",
  },
  {
    image: require("@/assets/images/missions/cau-vang.jpg"),
    headline: "Curated Stays & Journeys",
    description:
      "From hidden gems to iconic landmarks, we hand-pick the finest experiences to match your taste and heritage.",
    cta: "Next",
  },
  {
    image: require("@/assets/images/missions/hoi-an-den-hoa-dang.jpg"),
    headline: "Your AI Tour Guide",
    description:
      "Unlock the secrets of every destination with real-time audio guidance and cultural insights that bring history to life.",
    cta: "Get Started",
  },
];
