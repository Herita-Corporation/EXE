import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { generateItinerary } from "@/api/endpoints/itinerary";
import { ApiError } from "@/api/http";
import { useSmartBack } from "@/utils/backNavigation";
import { VIETNAM_PROVINCES } from "@/data/vietnamProvinces";
import { getRegionImage } from "@/data/regionImages";
import { useLocale, type TranslationKey } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

const TRAVEL_STYLE_KEYS: Array<{ key: string; labelKey: TranslationKey; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "food", labelKey: "createItinerary.styleFood", icon: "restaurant-outline" },
  { key: "culture", labelKey: "createItinerary.styleCulture", icon: "library-outline" },
  { key: "adventure", labelKey: "createItinerary.styleAdventure", icon: "walk-outline" },
  { key: "explore", labelKey: "createItinerary.styleExplore", icon: "compass-outline" },
];

// UI-only — GenerateItineraryRequest has no transportation field; the
// selection is never sent to the API, kept only for Figma fidelity.
const TRANSPORT_OPTION_KEYS: Array<{ key: string; labelKey: TranslationKey; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "bus", labelKey: "createItinerary.transportBus", icon: "bus-outline" },
  { key: "train", labelKey: "createItinerary.transportTrain", icon: "train-outline" },
  { key: "flight", labelKey: "createItinerary.transportFlight", icon: "airplane-outline" },
  { key: "car", labelKey: "createItinerary.transportCar", icon: "car-outline" },
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

export default function CreateItineraryScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useSmartBack();
  const { t } = useLocale();
  const [province, setProvince] = useState<string | null>(null);
  const [provincePickerOpen, setProvincePickerOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const selectedProvince = VIETNAM_PROVINCES.find((p) => p.name === province) ?? null;
  const [startDate, setStartDate] = useState(todayPlus(14));
  const [endDate, setEndDate] = useState(todayPlus(18));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [travelers, setTravelers] = useState(2);
  const [budgetVnd, setBudgetVnd] = useState(30_000_000);
  const [styles_, setStyles_] = useState<string[]>(["food"]);
  const [transport, setTransport] = useState<string[]>(["flight"]);
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
        <View style={[styles.heroOverlay, { top: insets.top + spacing(1.5) }]}>
          <IconButton icon="arrow-back" variant="glass" onPress={goBack} />
        </View>
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

        {selectedProvince && selectedProvince.highlights.length > 0 ? (
          <Pressable style={styles.selectBox} onPress={() => setHighlightPickerOpen(true)}>
            <Ionicons name="image-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.selectText, !highlight && styles.placeholderText]}>
              {highlight ?? t("createItinerary.areaPlaceholder")}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
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

        <Text style={styles.label}>{t("createItinerary.transportLabel")}</Text>
        <View style={styles.chipGrid}>
          {TRANSPORT_OPTION_KEYS.map((opt) => (
            <Chip
              key={opt.key}
              label={t(opt.labelKey)}
              icon={opt.icon}
              selected={transport.includes(opt.key)}
              onPress={() => toggle(transport, opt.key, setTransport)}
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

      <Modal visible={highlightPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {t("createItinerary.highlightPickerTitle", { province: province ?? "" })}
            </Text>
            <Text style={styles.modalSubtitle}>
              {t("createItinerary.highlightPickerSubtitle")}
            </Text>
            <FlatList
              data={selectedProvince?.highlights ?? []}
              keyExtractor={(item) => item.name}
              numColumns={2}
              columnWrapperStyle={styles.highlightRow}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.highlightTile}
                  onPress={() => {
                    setHighlight(item.name);
                    setHighlightPickerOpen(false);
                  }}
                >
                  <Card
                    variant="media"
                    imageHeight={90}
                    imageSource={getRegionImage(item.name, province)}
                    overlay={
                      highlight === item.name ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.navy} />
                      ) : undefined
                    }
                  >
                    <Text style={styles.highlightName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </Card>
                </Pressable>
              )}
            />
            <Button
              title={t("createItinerary.noAreaSelection")}
              variant="outline"
              onPress={() => {
                setHighlight(null);
                setHighlightPickerOpen(false);
              }}
            />
            <Button title={t("common.close")} variant="ghost" onPress={() => setHighlightPickerOpen(false)} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { height: 180 },
  heroImage: StyleSheet.absoluteFill,
  heroOverlay: { position: "absolute", left: spacing(2.5) },
  heroText: { position: "absolute", bottom: spacing(2), left: spacing(2.5) },
  heroStep: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  heroTitle: { fontSize: 24, fontWeight: "700", color: "#FFFFFF" },
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
  highlightRow: { gap: spacing(1) },
  highlightTile: { flex: 1, marginBottom: spacing(1) },
  highlightName: { fontSize: 12, fontWeight: "700", color: colors.text },
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
