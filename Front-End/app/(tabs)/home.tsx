import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { IconButton } from "@/components/IconButton";
import { useAuth } from "@/context/AuthContext";
import { useGamification } from "@/hooks/useGamification";
import { useLocale } from "@/i18n/LocaleContext";
import type { TranslationKey } from "@/i18n/LocaleContext";
import { MOCK_DESTINATIONS, MOCK_OFFERS } from "@/mocks/destinations";
import { colors, radius, spacing } from "@/theme/colors";

// Voucher/Account still have placeholder tab roots until Phase 5.
// Each action gets a solid fill of an existing theme color (not a new hue)
// with a white icon, so the grid reads as colorful but still on-brand.
const QUICK_ACTIONS: Array<{
  key: string;
  labelKey: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  bg: string;
}> = [
  { key: "create", labelKey: "home.createItinerary", icon: "sparkles-outline", href: "/(tabs)/mission/create?from=home", bg: colors.gold },
  { key: "my-itineraries", labelKey: "home.myItineraries", icon: "map-outline", href: "/(tabs)/mission/itineraries?from=home", bg: colors.navy },
  { key: "mission-history", labelKey: "home.missionHistory", icon: "time-outline", href: "/(tabs)/mission/completed?from=home", bg: colors.warning },
  { key: "collection", labelKey: "home.collection", icon: "albums-outline", href: "/(tabs)/mission/collection?from=home", bg: colors.success },
  { key: "events", labelKey: "home.events", icon: "calendar-outline", href: "/(tabs)/mission/events?from=home", bg: colors.danger },
  { key: "more", labelKey: "home.more", icon: "ellipsis-horizontal", href: "/(tabs)/account", bg: colors.textMuted },
];

// Solid theme colors cycled per offer card (the card itself carries the
// color now; the icon sits on a white badge instead), paired with a
// readable text color for that background.
const OFFER_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: colors.success, text: "#FFFFFF" },
  { bg: colors.navy, text: "#FFFFFF" },
  { bg: colors.gold, text: colors.navyDeep },
  { bg: colors.danger, text: "#FFFFFF" },
  { bg: colors.warning, text: colors.navyDeep },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const gamification = useGamification();
  const { t } = useLocale();
  const displayName = user?.username ?? t("common.voyager");

  return (
    <View style={styles.root}>
      {/* Header background reaches into the status-bar area, so status-bar
          icons need to switch to light while this screen is focused (reverts
          to the global "dark" style from app/_layout.tsx on navigating away). */}
      <StatusBar style="light" />
      {/* Fixed header — lives outside ScreenContainer's ScrollView so it
          never scrolls away. Home-only: no other screen renders this. */}
      <View style={[styles.header, { paddingTop: insets.top + spacing(1) }]}>
        <Image source={require("@/assets/images/disa-logo-white.png")} style={styles.logo} contentFit="contain" />
        <IconButton
          icon="notifications-outline"
          color="#FFFFFF"
          onPress={() => Alert.alert("Thông báo", "Chưa có thông báo mới.")}
        />
      </View>

      <ScreenContainer edges={["bottom", "left", "right"]} avoidTabBar>
        {/* Full-bleed navy band continuing the header's color down through
            the profile card and quick-actions, stopping right before
            Special Offers (negative margins cancel ScreenContainer's own
            padding). */}
        <View style={styles.heroBand}>
          <Card variant="elevated" style={styles.profileCard}>
            <Avatar name={displayName} size={48} />
            <Text style={[styles.profileName, { flex: 1 }]}>{displayName}</Text>
            <Badge
              label={`${gamification.points.toLocaleString()} ${t("mission.pts")}`}
              tone="gold"
              style={styles.pointsBadge}
            />
          </Card>

          <Card variant="elevated" style={styles.quickGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.key}
                style={styles.quickItem}
                onPress={() => router.push(action.href)}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: action.bg }]}>
                  <Ionicons name={action.icon} size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.quickLabel}>{t(action.labelKey)}</Text>
              </Pressable>
            ))}
          </Card>
        </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t("home.specialOffers")}</Text>
        <Text style={styles.sectionLink}>{t("home.viewAll")}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      >
        {MOCK_OFFERS.map((offer, index) => {
          const palette = OFFER_PALETTE[index % OFFER_PALETTE.length];
          return (
            <Pressable
              key={offer.id}
              onPress={() =>
                Alert.alert("Claim Offer", `Đổi ưu đãi "${offer.title}"? (demo — chưa có backend ưu đãi)`)
              }
            >
              <Card
                variant="elevated"
                style={{
                  ...styles.offerCard,
                  marginLeft: index === 0 ? spacing(2.5) : spacing(1.25),
                }}
              >
                <View style={[styles.offerMain, { backgroundColor: palette.bg }]}>
                  <View style={styles.offerIconWrap}>
                    <Ionicons name={offer.icon} size={24} color={palette.bg} />
                  </View>
                  <View style={styles.offerInfo}>
                    <Text style={[styles.offerTitle, { color: palette.text }]}>
                      {offer.title}
                    </Text>
                    <Text style={[styles.offerLocation, { color: palette.text }]}>
                      {offer.location}
                    </Text>
                    <Text style={[styles.offerText, { color: palette.text }]}>
                      {offer.offerText}
                    </Text>
                  </View>
                </View>
                {/* The "torn stub" — a lighter tint of the same color (plain
                    white overlay at low opacity, so it stays exactly the
                    same hue, just lighter) holding the claim icon. */}
                <View style={[styles.offerStub, { backgroundColor: palette.bg }]}>
                  <View style={[StyleSheet.absoluteFill, styles.offerStubTint]} />
                  <Ionicons name="gift-outline" size={20} color={palette.text} />
                </View>
                {/* Dashed divider at the seam, colored to match whatever
                    text color already reads on this palette. */}
                <View style={[styles.offerDivider, { borderColor: palette.text }]} />
                {/* Perforation notches at the seam between the main body and
                    the stub — same "painted in the page bg" trick as a real
                    ticket cutout. */}
                <View style={[styles.offerNotch, styles.offerNotchTop]} />
                <View style={[styles.offerNotch, styles.offerNotchBottom]} />
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionTitle}>{t("home.popularDestinations")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      >
        {MOCK_DESTINATIONS.map((dest) => (
          <Card
            key={dest.id}
            variant="media"
            imageSource={dest.image}
            style={styles.destCard}
            overlay={
              <View style={styles.heartBadge}>
                <Ionicons name="heart-outline" size={16} color={colors.navy} />
              </View>
            }
          >
            <View style={styles.destRow}>
              <Text style={styles.destName}>{dest.name}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={12} color={colors.gold} />
                <Text style={styles.ratingText}>{dest.rating}</Text>
              </View>
            </View>
            <View style={styles.destRow}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={styles.destRegion}>{dest.region}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const CARD_WIDTH = 220;
const OFFER_STUB_WIDTH = 48;
const OFFER_NOTCH_SIZE = 14;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // Match ScreenContainer's content padding (spacing(2.5)) below, so the
    // logo's left edge lines up with the profile card's left edge.
    paddingLeft: spacing(2.5),
    paddingRight: spacing(2.5),
    paddingBottom: spacing(1),
    backgroundColor: colors.navy,
  },
  // Matches the logo asset's real aspect ratio (740×403) so `contentFit`
  // doesn't letterbox it inside a wider box and push it toward the center.
  logo: { height: 48, aspectRatio: 740 / 403 },
  heroBand: {
    backgroundColor: colors.navy,
    marginTop: -spacing(2.5),
    marginHorizontal: -spacing(2.5),
    // Smaller inset than the band's own full-bleed edges — makes the cards
    // wider/bigger than the rest of the page's content, while still leaving
    // a visible gap so they don't touch the screen edge.
    paddingHorizontal: spacing(1.25),
    paddingTop: spacing(2.5),
    paddingBottom: spacing(3),
    gap: spacing(2),
    // Only the bottom corners curve — the top stays flush/square against
    // the fixed navy header above, only the navy→white edge below is rounded.
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  profileName: { fontSize: 15, fontWeight: "700", color: colors.text },
  // Lighter gold than the default Badge tone="gold". No extra margin, so its
  // right gap is just the Card's own padding — matching the Avatar's left
  // gap on the other side. Re-centered vertically — Badge's own base style
  // hardcodes alignSelf: "flex-start", which otherwise overrides the row's
  // alignItems: "center" for just this child.
  pointsBadge: {
    backgroundColor: colors.goldMuted,
    alignSelf: "center",
  },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1.5) },
  quickItem: { width: "30%", alignItems: "center", gap: spacing(0.75) },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 11, color: colors.text, textAlign: "center", fontWeight: "600" },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing(1),
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(1) },
  sectionLink: { fontSize: 12, color: colors.navy, fontWeight: "600" },
  carousel: { marginHorizontal: -spacing(2.5), flexGrow: 0 },
  // ScrollView's content container defaults to alignItems: "stretch", which
  // otherwise stretches each card to match the row's own height instead of
  // sizing to its own content — same underlying issue as voucher's filter
  // Chips (see voucher/index.tsx's filterContent comment), just less visible
  // here since Card has no border-radius extreme enough to exaggerate it.
  carouselContent: { alignItems: "flex-start" },
  // padding: 0, gap: 0 — both explicitly override Card's own base style
  // (which sets padding: spacing(2) and gap: spacing(1) by default; style
  // arrays only override keys a later object actually sets, so leaving gap
  // out here would silently keep Card's 8px gap between offerMain/offerStub,
  // showing Card's own white background through that seam).
  // No fixed width — sizes to offerMain's real content (icon + text) plus
  // offerStub's fixed width, so it never carries dead empty space.
  offerCard: {
    flexDirection: "row",
    alignItems: "stretch",
    padding: 0,
    gap: 0,
  },
  offerMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(1.25),
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  // Fixed white — regardless of the card's per-offer color, the icon badge
  // stays a consistent white chip.
  offerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  offerInfo: { gap: 2 },
  offerTitle: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  offerLocation: { fontSize: 11, opacity: 0.8 },
  offerText: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  // The "torn stub" holding the claim icon — same hue as offerMain, just
  // lighter (a translucent white layer on top, see offerStubTint).
  offerStub: {
    width: OFFER_STUB_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: "hidden",
  },
  offerStubTint: { backgroundColor: "rgba(255,255,255,0.35)" },
  // Vertical dashed line exactly at the seam, inset from the top/bottom
  // notches so it doesn't poke into their circles.
  offerDivider: {
    position: "absolute",
    right: OFFER_STUB_WIDTH,
    top: OFFER_NOTCH_SIZE / 2 + 2,
    bottom: OFFER_NOTCH_SIZE / 2 + 2,
    borderLeftWidth: 2.5,
    borderStyle: "dashed",
    opacity: 0.4,
  },
  // Painted in the page's own background color, straddling the seam between
  // offerMain and offerStub, to "punch" a semicircle notch top and bottom —
  // the classic ticket-perforation look.
  offerNotch: {
    position: "absolute",
    right: OFFER_STUB_WIDTH - OFFER_NOTCH_SIZE / 2,
    width: OFFER_NOTCH_SIZE,
    height: OFFER_NOTCH_SIZE,
    borderRadius: OFFER_NOTCH_SIZE / 2,
    backgroundColor: colors.background,
  },
  offerNotchTop: { top: -OFFER_NOTCH_SIZE / 2 },
  offerNotchBottom: { bottom: -OFFER_NOTCH_SIZE / 2 },
  destCard: { width: CARD_WIDTH, marginLeft: spacing(2.5) },
  destRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  destName: { fontSize: 14, fontWeight: "700", color: colors.text },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 12, fontWeight: "600", color: colors.text },
  destRegion: { fontSize: 11, color: colors.textMuted },
  heartBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
});
