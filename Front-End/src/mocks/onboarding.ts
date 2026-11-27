// Local partner imagery; no network request on first launch.
import type { TranslationKey } from "@/i18n/LocaleContext";

export interface OnboardingSlide {
  /** require() asset module id. */
  image: number;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    image: require("@/assets/images/partners/emerald-phu-quoc-cover.jpg"),
    titleKey: "onboarding.slide1Title",
    bodyKey: "onboarding.slide1Body",
  },
  {
    image: require("@/assets/images/partners/sus-house-coffee-cover.jpg"),
    titleKey: "onboarding.slide2Title",
    bodyKey: "onboarding.slide2Body",
  },
  {
    image: require("@/assets/images/partners/lat-valley-villa-cover.jpg"),
    titleKey: "onboarding.slide3Title",
    bodyKey: "onboarding.slide3Body",
  },
];
