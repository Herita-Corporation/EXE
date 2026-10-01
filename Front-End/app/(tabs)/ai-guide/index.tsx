import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { MINORITY_LANGUAGES } from "@/data/minorityLanguages";
import { BAHNAR_LANGUAGE_CODE } from "@/api/endpoints/translate";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

// AI Guide's UI has pivoted from a voice-chat assistant to a Vietnamese <->
// ethnic-minority-language translation tool (per product direction). This
// screen picks the language. Only Ba Na → Vietnamese has a trained model today
// (src/api/endpoints/translate.ts); every other language and the Vietnamese → Ba Na
// direction are shown as "coming soon" and can't be selected. When a new model ships,
// add its code to SUPPORTED (and route it to its screen below).
const SUPPORTED = new Set([BAHNAR_LANGUAGE_CODE]);
const LANGUAGES = [
  ...MINORITY_LANGUAGES.filter((l) => SUPPORTED.has(l.code)),
  ...MINORITY_LANGUAGES.filter((l) => !SUPPORTED.has(l.code)),
];

export default function AiGuideSetupScreen() {
  const { t } = useLocale();
  const [selected, setSelected] = useState(LANGUAGES[0].code);

  return (
    <ScreenContainer avoidTabBar backgroundColor={colors.surface}>
      <Text style={styles.title}>{t("aiGuide.setupTitle")}</Text>
      <Text style={styles.subtitle}>{t("aiGuide.setupSubtitle")}</Text>

      <Text style={styles.sectionLabel}>{t("aiGuide.selectLanguage")}</Text>
      <View style={styles.languageGrid}>
        {LANGUAGES.map((lang) => {
          // Languages without a trained model are shown as "coming soon" and can't be picked, so
          // nobody mistakes the placeholder screen for a working translator.
          const supported = SUPPORTED.has(lang.code);
          const isSelected = supported && selected === lang.code;
          return (
            <Pressable
              key={lang.code}
              disabled={!supported}
              accessibilityState={{ disabled: !supported, selected: isSelected }}
              style={[
                styles.languageCard,
                isSelected && styles.languageCardSelected,
                !supported && styles.languageCardDisabled,
              ]}
              onPress={() => setSelected(lang.code)}
            >
              <Ionicons
                name="language-outline"
                size={20}
                color={isSelected ? colors.primaryText : supported ? colors.navy : colors.textMuted}
              />
              <Text style={[styles.languageLabel, isSelected && styles.languageLabelSelected]}>{lang.name}</Text>
              <Text style={[styles.languageRegion, isSelected && styles.languageRegionSelected]}>{lang.region}</Text>
              <View style={supported ? styles.supportedBadge : styles.soonBadge}>
                <Text style={supported ? styles.supportedBadgeText : styles.soonBadgeText}>
                  {supported ? t("aiGuide.supportedBadge") : t("aiGuide.comingSoon")}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>{t("aiGuide.directionLabel")}</Text>
      <View style={styles.directionRow}>
        <View style={[styles.directionCard, styles.directionCardActive]}>
          <Text style={styles.directionTextActive}>{t("aiGuide.directionToVietnamese")}</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.primaryText} />
        </View>
        <View style={[styles.directionCard, styles.languageCardDisabled]}>
          <Text style={styles.directionText}>{t("aiGuide.directionFromVietnamese")}</Text>
          <View style={styles.soonBadge}>
            <Text style={styles.soonBadgeText}>{t("aiGuide.comingSoon")}</Text>
          </View>
        </View>
      </View>

      <View style={styles.noticeCard}>
        <Ionicons name="information-circle-outline" size={16} color={colors.gold} />
        <Text style={styles.noticeText}>{t("aiGuide.bahnarReadyNotice")}</Text>
      </View>

      <Button
        title={t("aiGuide.continueToTranslate")}
        icon="arrow-forward"
        iconPosition="right"
        onPress={() => router.push("/(tabs)/ai-guide/bahnar")}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "700", color: colors.navy, marginTop: spacing(1) },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing(1),
  },
  languageGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1.25) },
  languageCard: {
    flexBasis: "47%",
    alignItems: "center",
    gap: spacing(0.5),
    paddingVertical: spacing(2),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  languageCardSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  languageLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  languageLabelSelected: { color: colors.primaryText },
  languageRegion: { fontSize: 11, color: colors.textMuted },
  languageRegionSelected: { color: "rgba(255,255,255,0.7)" },
  supportedBadge: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1),
    paddingVertical: 2,
    marginTop: spacing(0.25),
  },
  supportedBadgeText: { fontSize: 10, fontWeight: "700", color: colors.navyDeep },
  soonBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1),
    paddingVertical: 2,
    marginTop: spacing(0.25),
  },
  soonBadgeText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
  languageCardDisabled: { opacity: 0.55 },
  directionRow: { flexDirection: "row", gap: spacing(1.25) },
  directionCard: {
    flex: 1,
    alignItems: "center",
    gap: spacing(0.5),
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(1),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  directionCardActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  directionText: { fontSize: 13, fontWeight: "700", color: colors.text, textAlign: "center" },
  directionTextActive: { fontSize: 13, fontWeight: "700", color: colors.primaryText, textAlign: "center" },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(0.75),
    backgroundColor: colors.goldMuted,
    borderRadius: radius.md,
    padding: spacing(1.25),
  },
  noticeText: { flex: 1, fontSize: 11, color: colors.navyDeep },
});
