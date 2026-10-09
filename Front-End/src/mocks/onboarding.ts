// Static intro content, no backend involved. Images are real landmark
// photos bundled from Wikimedia Commons (same set as
// src/mocks/featuredMissions.ts — see its header comment for licensing).
// Copy lives in i18n (onboarding.*) so it follows the app language.
import type { TranslationKey } from "@/i18n/LocaleContext";

export interface OnboardingSlide {
  /** require() asset module id. */
  image: number;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    image: require("@/assets/images/missions/fansipan.jpg"),
    titleKey: "onboarding.slide1Title",
    bodyKey: "onboarding.slide1Body",
  },
  {
    image: require("@/assets/images/missions/cau-vang.jpg"),
    titleKey: "onboarding.slide2Title",
    bodyKey: "onboarding.slide2Body",
  },
  {
    image: require("@/assets/images/missions/hoi-an-den-hoa-dang.jpg"),
    titleKey: "onboarding.slide3Title",
    bodyKey: "onboarding.slide3Body",
  },
];
