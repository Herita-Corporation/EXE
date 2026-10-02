import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { IconButton } from "@/components/IconButton";
import { SectionHeader } from "@/components/SectionHeader";
import { FeaturedMissionCard } from "@/components/FeaturedMissionCard";
import { VoucherIcon } from "@/components/VoucherIcon";
import { useAuth } from "@/context/AuthContext";
import { useGamification } from "@/hooks/useGamification";
import { useLocale } from "@/i18n/LocaleContext";
import type { TranslationKey } from "@/i18n/LocaleContext";
import { MOCK_OFFERS } from "@/mocks/destinations";
import { FEATURED_MISSIONS } from "@/mocks/featuredMissions";
import { colors, isDark, radius, spacing } from "@/theme/colors";
import { GradientHero } from "@/components/GradientHero";

// One consistent tile style for every action (soft blue tile, navy icon)
// instead of a different solid color per action — the old rainbow grid was
// the main source of visual noise on this screen. "Create itinerary" lives
// on the hero card as the primary CTA, so it isn't repeated here.
const QUICK_ACTIONS: Array<{
  key: string;
  labelKey: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}> = [
  { key: "my-itineraries", labelKey: "home.myItineraries", icon: "map-outline", href: "/(tabs)/mission/itineraries?from=home" },
  { key: "mission-history", labelKey: "home.missionHistory", icon: "time-outline", href: "/(tabs)/mission/completed?from=home" },
  { key: "collection", labelKey: "home.collection", icon: "albums-outline", href: "/(tabs)/mission/collection?from=home" },
  { key: "events", labelKey: "home.events", icon: "calendar-outline", href: "/(tabs)/mission/events?from=home" },
  { key: "more", labelKey: "home.more", icon: "grid-outline", href: "/(tabs)/account" },
];

// Mock offers carry an icon, not a category — map it so the tile picks up
// the same category colors used on the Voucher tab.
const OFFER_STYLE: Record<
  string,
  { category: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  "cafe-outline": { category: "Dining", icon: "cafe" },
  "bed-outline": { category: "Hotels", icon: "bed" },
  "airplane-outline": { category: "Travel", icon: "airplane" },
};

export default function HomeScreen() {
  const { user } = useAuth();
  const gamification = useGamification();
  const { t } = useLocale();
  const displayName = user?.username ?? t("common.voyager");

  return (
    <ScreenContainer avoidTabBar edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Image
          source={
            isDark
              ? require("@/assets/images/brand/logo-horizontal-white.png")
              : require("@/assets/images/brand/logo-horizontal.png")
          }
          style={styles.logo}
          contentFit="contain"
        />
        <IconButton
          icon="notifications-outline"
          variant="solid"
          size={20}
          onPress={() => Alert.alert("Thông báo", "Chưa có thông báo mới.")}
        />
      </View>

      {/* Hero: the one gradient block on the page — greeting, points and the
          screen's single amber CTA (create itinerary) together. */}
      <GradientHero style={styles.hero} markStyle={{ right: -40, width: 180 }}>
        <View style={styles.heroTop}>
          <Avatar name={displayName} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting} numberOfLines={1}>
              {t("home.greeting", { name: displayName })}
            </Text>
            <Text style={styles.heroSub}>{t("home.greetingSub")}</Text>
          </View>
        </View>

        <View style={styles.heroBottom}>
          <View style={styles.pointsPill}>
            <Ionicons name="star" size={14} color={colors.gold} />
            <Text style={styles.pointsText}>
              {gamification.points.toLocaleString()} {t("mission.pts")}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/(tabs)/mission/create?from=home")}
          >
            <Ionicons name="sparkles" size={16} color={colors.onAmber} />
            <Text style={styles.heroCtaText}>{t("home.createItinerary")}</Text>
          </Pressable>
        </View>
      </GradientHero>

      <View style={styles.quickRow}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.key}
            style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(action.href)}
          >
            <View style={styles.quickIconWrap}>
              <Ionicons name={action.icon} size={22} color={colors.primary} />
            </View>
            <Text style={styles.quickLabel} numberOfLines={2}>
              {t(action.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader
        title={t("home.featuredMissions")}
        actionLabel={t("home.viewAll")}
        onAction={() => router.push("/(tabs)/mission")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      >
        {FEATURED_MISSIONS.map((m) => (
          <FeaturedMissionCard
            key={m.id}
            mission={m}
            onPress={() =>
              Alert.alert(t("mission.sampleTitle"), t("mission.sampleMessage"), [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("mission.createToUnlock"),
                  onPress: () => router.push("/(tabs)/mission/create?from=home"),
                },
              ])
            }
          />
        ))}
      </ScrollView>

      <SectionHeader
        title={t("home.specialOffers")}
        actionLabel={t("home.viewAll")}
        onAction={() => router.push("/(tabs)/voucher")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      >
        {MOCK_OFFERS.map((offer) => (
          <Pressable
            key={offer.id}
            onPress={() =>
              Alert.alert("Claim Offer", `Đổi ưu đãi "${offer.title}"? (demo — chưa có backend ưu đãi)`)
            }
          >
            <Card variant="elevated" style={styles.offerCard}>
              <VoucherIcon
                category={OFFER_STYLE[offer.icon]?.category}
                icon={OFFER_STYLE[offer.icon]?.icon}
                size={48}
              />
              <View style={styles.offerInfo}>
                <Text style={styles.offerTitle} numberOfLines={1}>{offer.title}</Text>
                <Text style={styles.offerLocation} numberOfLines={1}>{offer.location}</Text>
                <Text style={styles.offerText} numberOfLines={1}>{offer.offerText}</Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const PAGE_PADDING = spacing(2.5);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  // brand/logo-horizontal.png is 1200×180.
  logo: { height: 26, aspectRatio: 1200 / 180 },

  hero: { gap: spacing(2.5) },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  heroGreeting: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 },
  heroBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(1),
  },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.pill,
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.5),
  },
  pointsText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.75),
  },
  heroCtaText: { color: colors.onAmber, fontSize: 13, fontWeight: "800" },

  quickRow: { flexDirection: "row", justifyContent: "space-between" },
  quickItem: { width: "19%", alignItems: "center", gap: spacing(0.75) },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 11, color: colors.text, textAlign: "center", fontWeight: "600" },


  // Bleeds to the screen edges so cards scroll off-screen; first card is
  // re-inset by the content container's paddingLeft.
  carousel: { marginHorizontal: -PAGE_PADDING, flexGrow: 0 },
  carouselContent: {
    alignItems: "flex-start",
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: spacing(1.5),
    gap: spacing(1.5),
  },

  offerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    width: 240,
    padding: spacing(1.5),
  },
  offerInfo: { flex: 1, gap: 1 },
  offerTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  offerLocation: { fontSize: 12, color: colors.textMuted },
  offerText: { fontSize: 12.5, fontWeight: "700", color: colors.link, marginTop: 2 },
});
