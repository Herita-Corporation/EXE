// MOCK — static content, no backend involved. Images are generic placeholder
// photography (picsum.photos, seeded for stable results) until the project
// has real brand photography to drop in.

export interface OnboardingSlide {
  image: string;
  headline: string;
  description: string;
  cta: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    image: "https://picsum.photos/seed/disa-halong/1200/2000",
    headline: "AI Trip Planner",
    description:
      "Experience the future of travel with personalized itineraries crafted by our intelligent concierge, tailored to your unique rhythm and heritage.",
    cta: "Next",
  },
  {
    image: "https://picsum.photos/seed/disa-train/1200/2000",
    headline: "Curated Stays & Journeys",
    description:
      "From hidden gems to iconic landmarks, we hand-pick the finest experiences to match your taste and heritage.",
    cta: "Next",
  },
  {
    image: "https://picsum.photos/seed/disa-hoian/1200/2000",
    headline: "Your AI Tour Guide",
    description:
      "Unlock the secrets of every destination with real-time audio guidance and cultural insights that bring history to life.",
    cta: "Get Started",
  },
];
