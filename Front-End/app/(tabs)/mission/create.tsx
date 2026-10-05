import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { generateItinerary } from "@/api/endpoints/itinerary";
import { pruneMissions } from "@/api/endpoints/missions";
import { ApiError } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { getLiveItineraryIds, setLastGeneratedItinerary } from "@/utils/itineraryHistory";
import { useSmartBack } from "@/utils/backNavigation";
import { VIETNAM_PROVINCES, type ProvinceHighlight } from "@/data/vietnamProvinces";
import { getRegionImage } from "@/data/regionImages";
import { useLocale, type TranslationKey } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

const TRAVEL_STYLE_KEYS: Array<{ key: string; labelKey: TranslationKey; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "food", labelKey: "createItinerary.styleFood", icon: "restaurant-outline" },
  { key: "culture", labelKey: "createItinerary.styleCulture", icon: "library-outline" },
  { key: "adventure", labelKey: "createItinerary.styleAdventure", icon: "walk-outline" },
  { key: "explore", labelKey: "createItinerary.styleExplore", icon: "compass-outline" },
];

const MIN_BUDGET_VND = 2_000_000;
const MAX_BUDGET_VND = 125_000_000;

function formatVnd(n: number): string {
  return `${Math.round(n).toLocaleString("vi-VN")} VND`;
}

function formatVndShort(n: number, unit: string): string {
  return `${(n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ${unit}`;
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Large photo card for a featured area in the area picker sheet. */
function FeaturedAreaCard({
  area,
  province,
  selected,
  badge,
  onPress,
}: {
  area: ProvinceHighlight;
  province: string | null;
  selected: boolean;
  badge: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.bigAreaCard, selected && styles.bigAreaCardSelected]}
      onPress={onPress}
    >
      <Image
        source={getRegionImage(area.name, province)}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.bigAreaScrim} />
      <View style={styles.bigAreaBadge}>
        <Ionicons name="star" size={11} color="#FFFFFF" />
        <Text style={styles.bigAreaBadgeText}>{badge}</Text>
      </View>
      {selected ? (
        <View style={styles.bigAreaCheck}>
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        </View>
      ) : null}
      <View style={styles.bigAreaTextWrap}>
        <Text style={styles.bigAreaName} numberOfLines={1}>
          {area.name}
        </Text>
        <Text style={styles.bigAreaNote} numberOfLines={2}>
          {area.note}
        </Text>
      </View>
    </Pressable>
  );
}

export default function CreateItineraryScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useSmartBack();
  const { t } = useLocale();
  const { user } = useAuth();
  const [province, setProvince] = useState<string | null>(null);
  const [provincePickerOpen, setProvincePickerOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const selectedProvince = VIETNAM_PROVINCES.find((p) => p.name === province) ?? null;
  const featuredAreas = selectedProvince?.highlights.filter((h) => h.featured) ?? [];
  const otherAreas = selectedProvince?.highlights.filter((h) => !h.featured) ?? [];
  const areaSections = [
    { key: "featured", title: t("createItinerary.featuredSection"), data: featuredAreas },
    { key: "other", title: t("createItinerary.otherAreasSection"), data: otherAreas },
  ].filter((s) => s.data.length > 0);

  function pickArea(name: string | null) {
    setHighlight(name);
    setHighlightPickerOpen(false);
  }
  const [startDate, setStartDate] = useState(todayPlus(14));
  const [endDate, setEndDate] = useState(todayPlus(18));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [travelers, setTravelers] = useState(2);
  const [budgetVnd, setBudgetVnd] = useState(30_000_000);
  const [styles_, setStyles_] = useState<string[]>(["food"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(list: string[], key: string, setList: (v: string[]) => void) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  async function onGenerate() {
    setError(null);
    if (!province) {
      setError(t("createItinerary.errorSelectProvince"));
      return;
    }
    if (startDate > endDate) {
      setError(t("createItinerary.errorDateOrder"));
      return;
    }
    if (styles_.length === 0) {
      setError(t("createItinerary.errorSelectStyle"));
      return;
    }

    setLoading(true);
    try {
      const result = await generateItinerary({
        cities: [highlight ? `${highlight}, ${province}` : province],
        budget: budgetVnd,
        start_date: startDate,
        end_date: endDate,
        preferences: styles_,
      });
      // Drop missions left over from itineraries that no longer exist — only
      // saved ones ("Lộ trình của tôi") and this new one keep theirs.
      // Best-effort: a failure here must not block opening the new itinerary.
      if (user) {
        try {
          await setLastGeneratedItinerary(user.id, result.itinerary_id);
          await pruneMissions(user.id, await getLiveItineraryIds(user.id));
        } catch {}
      }
      // Not saved to "My Itineraries" yet — only once the user reviews and
      // taps "Xác nhận tạo lộ trình" on the detail screen (see [id].tsx).
      router.replace(`/(tabs)/mission/itinerary/${result.itinerary_id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("createItinerary.errorGenerateFailed")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scroll noPadding backgroundColor={colors.surface}>
      <View style={styles.hero}>
        <Image
          source={{ uri: "https://picsum.photos/seed/disa-plan-trip/900/500" }}
          style={styles.heroImage}
          contentFit="cover"
        />
        {/* Bottom scrim for text legibility */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          style={styles.heroScrim}
        />
        {/* Back button — glassmorphism pill */}
        <Pressable
          style={[styles.backBtn, { top: insets.top + spacing(1.5) }]}
          onPress={goBack}
        >
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          <Text style={styles.backBtnText}>Quay lại</Text>
        </Pressable>
        <View style={styles.heroText}>
          <Text style={styles.heroStep}>{t("createItinerary.heroStep")}</Text>
          <Text style={styles.heroTitle}>{t("createItinerary.heroTitle")}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <ErrorBanner message={error} />

        <Text style={styles.label}>{t("createItinerary.whereLabel")}</Text>
        <Pressable style={styles.selectBox} onPress={() => setProvincePickerOpen(true)}>
          <Ionicons name="location-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.selectText, !province && styles.placeholderText]}>
            {province ?? t("createItinerary.provincePlaceholder")}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>

        {selectedProvince && featuredAreas.length > 0 ? (
          <View style={styles.featuredBox}>
            <View style={styles.featuredHeader}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.featuredTitle}>{t("createItinerary.featuredAreasLabel")}</Text>
              <Pressable onPress={() => setHighlightPickerOpen(true)} hitSlop={8} style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>
                  {t("createItinerary.seeAllAreas")} ({selectedProvince.highlights.length})
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.navy} />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredStrip}
            >
              {featuredAreas.map((area) => {
                const selected = highlight === area.name;
                return (
                  <Pressable
                    key={area.name}
                    style={[styles.featuredCard, selected && styles.featuredCardSelected]}
                    onPress={() => setHighlightPickerOpen(true)}
                  >
                    <Image
                      source={getRegionImage(area.name, province)}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={200}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.75)"]}
                      style={styles.featuredScrim}
                    />
                    {selected ? (
                      <View style={styles.featuredCheck}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    ) : null}
                    <View style={styles.featuredTextWrap}>
                      <Text style={styles.featuredName} numberOfLines={1}>
                        {area.name}
                      </Text>
                      <Text style={styles.featuredNote} numberOfLines={1}>
                        {area.note}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {highlight ? (
              <View style={styles.selectedAreaRow}>
                <Ionicons name="location" size={16} color={colors.navy} />
                <Text style={styles.selectedAreaText} numberOfLines={1}>
                  {highlight}, {province}
                </Text>
                <Pressable onPress={() => setHighlight(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : (
              <Text style={styles.featuredHint}>{t("createItinerary.areaPlaceholder")}</Text>
            )}
          </View>
        ) : null}

        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t("createItinerary.startDateLabel")}</Text>
            <Pressable style={styles.selectBox} onPress={() => setShowStartPicker(true)}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.selectText}>{startDate}</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t("createItinerary.endDateLabel")}</Text>
            <Pressable style={styles.selectBox} onPress={() => setShowEndPicker(true)}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.selectText}>{endDate}</Text>
            </Pressable>
          </View>
        </View>

        {showStartPicker ? (
          <DateTimePicker
            value={new Date(startDate)}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_, date) => {
              setShowStartPicker(false);
              if (date) setStartDate(date.toISOString().slice(0, 10));
            }}
          />
        ) : null}
        {showEndPicker ? (
          <DateTimePicker
            value={new Date(endDate)}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_, date) => {
              setShowEndPicker(false);
              if (date) setEndDate(date.toISOString().slice(0, 10));
            }}
          />
        ) : null}

        <View style={styles.card}>
          <View style={styles.stepperRow}>
            <View style={styles.stepperIconWrap}>
              <Ionicons name="people-outline" size={18} color={colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepperTitle}>{t("createItinerary.travelersTitle")}</Text>
              <Text style={styles.stepperSubtitle}>{t("createItinerary.travelersSubtitle")}</Text>
            </View>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setTravelers((t) => Math.max(1, t - 1))}
            >
              <Ionicons name="remove" size={16} color={colors.navy} />
            </Pressable>
            <Text style={styles.stepperValue}>{travelers}</Text>
            <Pressable
              style={[styles.stepperButton, styles.stepperButtonActive]}
              onPress={() => setTravelers((t) => Math.min(10, t + 1))}
            >
              <Ionicons name="add" size={16} color={colors.primaryText} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.budgetHeaderRow}>
            <View style={styles.stepperIconWrap}>
              <Ionicons name="cash-outline" size={18} color={colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepperTitle}>{t("createItinerary.budgetTitle")}</Text>
              <Text style={styles.stepperSubtitle}>{t("createItinerary.budgetSubtitle")}</Text>
            </View>
            <Text style={styles.budgetValue}>{formatVnd(budgetVnd)}</Text>
          </View>
          <Slider
            minimumValue={MIN_BUDGET_VND}
            maximumValue={MAX_BUDGET_VND}
            step={1_000_000}
            value={budgetVnd}
            onValueChange={setBudgetVnd}
            minimumTrackTintColor={colors.navy}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.navy}
          />
          <View style={styles.budgetRangeRow}>
            <Text style={styles.budgetRangeText}>
              {formatVndShort(MIN_BUDGET_VND, t("createItinerary.budgetUnitMillion"))}
            </Text>
            <Text style={styles.budgetRangeText}>
              {formatVndShort(MAX_BUDGET_VND, t("createItinerary.budgetUnitMillion"))}+
            </Text>
          </View>
        </View>

        <Text style={styles.label}>{t("createItinerary.travelStyleLabel")}</Text>
        <View style={styles.chipGrid}>
          {TRAVEL_STYLE_KEYS.map((s) => (
            <Chip
              key={s.key}
              label={t(s.labelKey)}
              icon={s.icon}
              selected={styles_.includes(s.key)}
              onPress={() => toggle(styles_, s.key, setStyles_)}
              style={styles.chipHalf}
            />
          ))}
        </View>

        <Button
          title={t("createItinerary.generateButton")}
          icon="sparkles"
          iconPosition="right"
          onPress={onGenerate}
          loading={loading}
          style={{ marginTop: spacing(1) }}
        />
      </View>

      <Modal visible={provincePickerOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t("createItinerary.provincePickerTitle")}</Text>
            <FlatList
              data={VIETNAM_PROVINCES}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    if (item.name !== province) setHighlight(null);
                    setProvince(item.name);
                    setProvincePickerOpen(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{item.name}</Text>
                  {province === item.name ? (
                    <Ionicons name="checkmark" size={18} color={colors.navy} />
                  ) : null}
                </Pressable>
              )}
            />
            <Button title={t("common.close")} variant="ghost" onPress={() => setProvincePickerOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal
        visible={highlightPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setHighlightPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, styles.areaSheet]}>
            <View style={styles.areaSheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {t("createItinerary.areaListTitle", { province: province ?? "" })}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {t("createItinerary.highlightPickerSubtitle")}
                </Text>
              </View>
              <Pressable onPress={() => setHighlightPickerOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <SectionList
              sections={areaSections}
              keyExtractor={(item) => item.name}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <Pressable
                  style={[styles.wholeProvinceRow, !highlight && styles.areaRowSelected]}
                  onPress={() => pickArea(null)}
                >
                  <View style={styles.wholeProvinceIcon}>
                    <Ionicons name="map-outline" size={20} color={colors.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.areaRowName}>{t("createItinerary.noAreaSelection")}</Text>
                    <Text style={styles.areaRowNote}>{t("createItinerary.wholeProvinceSubtitle")}</Text>
                  </View>
                  {!highlight ? <Ionicons name="checkmark-circle" size={20} color={colors.navy} /> : null}
                </Pressable>
              }
              renderSectionHeader={({ section }) => (
                <View style={styles.sectionHeader}>
                  {section.key === "featured" ? (
                    <Ionicons name="star" size={14} color="#F59E0B" />
                  ) : (
                    <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                  )}
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                </View>
              )}
              renderItem={({ item, section }) =>
                section.key === "featured" ? (
                  <FeaturedAreaCard
                    area={item}
                    province={province}
                    selected={highlight === item.name}
                    badge={t("createItinerary.featuredBadge")}
                    onPress={() => pickArea(item.name)}
                  />
                ) : (
                  <Pressable
                    style={[styles.areaRow, highlight === item.name && styles.areaRowSelected]}
                    onPress={() => pickArea(item.name)}
                  >
                    <Image
                      source={getRegionImage(item.name, province)}
                      style={styles.areaThumb}
                      contentFit="cover"
                      transition={200}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.areaRowName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.areaRowNote} numberOfLines={2}>
                        {item.note}
                      </Text>
                    </View>
                    {highlight === item.name ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.navy} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    )}
                  </Pressable>
                )
              }
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { height: 200 },
  heroImage: StyleSheet.absoluteFill,
  heroScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  backBtn: {
    position: "absolute",
    left: spacing(2),
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    overflow: "hidden",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  heroText: { position: "absolute", bottom: spacing(2), left: spacing(2.5) },
  heroStep: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },
  heroTitle: { fontSize: 26, fontWeight: "800", color: "#FFFFFF" },
  body: { padding: spacing(2.5), gap: spacing(1.25) },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  selectBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.25),
  },
  selectText: { flex: 1, color: colors.text, fontSize: 14 },
  placeholderText: { color: colors.textMuted },
  dateRow: { flexDirection: "row", gap: spacing(1.5) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1),
  },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  stepperIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  stepperSubtitle: { fontSize: 11, color: colors.textMuted },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepperValue: { fontSize: 16, fontWeight: "700", color: colors.text, minWidth: 24, textAlign: "center" },
  divider: { height: 1, backgroundColor: colors.border },
  budgetHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  budgetValue: { fontSize: 16, fontWeight: "800", color: colors.navy },
  budgetRangeRow: { flexDirection: "row", justifyContent: "space-between" },
  budgetRangeText: { fontSize: 11, color: colors.textMuted },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
  chipHalf: { flexBasis: "47%" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing(2.5),
    maxHeight: "70%",
    gap: spacing(1),
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  modalSubtitle: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(0.5) },
  // ── Featured areas strip (main form) ──
  featuredBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.25),
    gap: spacing(1),
  },
  featuredHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing(1.5),
  },
  featuredTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontSize: 13, fontWeight: "600", color: colors.navy },
  featuredStrip: { paddingHorizontal: spacing(1.5), gap: spacing(1) },
  featuredCard: {
    width: 140,
    height: 100,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: "transparent",
  },
  featuredCardSelected: { borderColor: colors.navy },
  featuredScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 64 },
  featuredCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredTextWrap: { position: "absolute", left: 8, right: 8, bottom: 6 },
  featuredName: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  featuredNote: { color: "rgba(255,255,255,0.85)", fontSize: 10 },
  featuredHint: { fontSize: 12, color: colors.textMuted, paddingHorizontal: spacing(1.5) },
  selectedAreaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: spacing(1.5),
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.75),
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  selectedAreaText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },

  // ── Area picker sheet ──
  areaSheet: { maxHeight: "88%", paddingBottom: spacing(3) },
  areaSheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing(1) },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: spacing(1.5),
    paddingBottom: spacing(1),
    backgroundColor: colors.surface,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  bigAreaCard: {
    height: 150,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing(1.25),
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: "transparent",
  },
  bigAreaCardSelected: { borderColor: colors.navy },
  bigAreaScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 100 },
  bigAreaBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F59E0B",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bigAreaBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  bigAreaCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  bigAreaTextWrap: { position: "absolute", left: 14, right: 14, bottom: 12 },
  bigAreaName: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  bigAreaNote: { color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 2 },
  areaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    padding: spacing(1),
    marginBottom: spacing(0.75),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  areaRowSelected: { borderColor: colors.navy, backgroundColor: colors.surfaceAlt },
  areaThumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  areaRowName: { fontSize: 15, fontWeight: "700", color: colors.text },
  areaRowNote: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  wholeProvinceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    padding: spacing(1),
    marginTop: spacing(1),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wholeProvinceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing(1.25),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRowText: { fontSize: 15, color: colors.text },
});
