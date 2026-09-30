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
// screen picks the target language; the actual translation backend is a
// separate, later effort — see src/api/endpoints/translate.ts.
export default function AiGuideSetupScreen() {
  const { t } = useLocale();
  const [selected, setSelected] = useState(MINORITY_LANGUAGES[0].code);

  return (
    <ScreenContainer avoidTabBar backgroundColor={colors.surface}>
      <Text style={styles.title}>{t("aiGuide.setupTitle")}</Text>
      <Text style={styles.subtitle}>{t("aiGuide.setupSubtitle")}</Text>

      <Text style={styles.sectionLabel}>{t("aiGuide.selectLanguage")}</Text>
      <View style={styles.languageGrid}>
        {MINORITY_LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            style={[styles.languageCard, selected === lang.code && styles.languageCardSelected]}
            onPress={() => setSelected(lang.code)}
          >
            <Ionicons
              name="language-outline"
              size={20}
              color={selected === lang.code ? colors.primaryText : colors.navy}
            />
            <Text style={[styles.languageLabel, selected === lang.code && styles.languageLabelSelected]}>
              {lang.name}
            </Text>
            <Text style={[styles.languageRegion, selected === lang.code && styles.languageRegionSelected]}>
              {lang.region}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.noticeCard}>
        <Ionicons name="information-circle-outline" size={16} color={colors.gold} />
        <Text style={styles.noticeText}>
          {selected === BAHNAR_LANGUAGE_CODE ? t("aiGuide.bahnarReadyNotice") : t("aiGuide.backendPendingNotice")}
        </Text>
      </View>

      <Button
        title={t("aiGuide.continueToTranslate")}
        icon="arrow-forward"
        iconPosition="right"
        onPress={() =>
          // Ba Na has a real backend (Ba Na → Vietnamese): its own screen with voice input.
          selected === BAHNAR_LANGUAGE_CODE
            ? router.push("/(tabs)/ai-guide/bahnar")
            : router.push({
                pathname: "/(tabs)/ai-guide/chat",
                params: { languageCode: selected },
              })
        }
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
