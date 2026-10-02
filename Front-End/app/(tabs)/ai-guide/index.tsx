import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/Button";
import { MINORITY_LANGUAGES } from "@/data/minorityLanguages";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, shadow, spacing } from "@/theme/colors";

// AI Guide's UI has pivoted from a voice-chat assistant to a Vietnamese <->
// ethnic-minority-language translation tool (per product direction). This
// screen picks the target language; the actual translation backend is a
// separate, later effort — see src/api/endpoints/translate.ts.
export default function AiGuideSetupScreen() {
  const { t } = useLocale();
  const [selected, setSelected] = useState(MINORITY_LANGUAGES[0].code);

  return (
    <ScreenContainer avoidTabBar>
      <ScreenHeader title={t("aiGuide.setupTitle")} subtitle={t("aiGuide.setupSubtitle")} />

      <Text style={styles.sectionLabel}>{t("aiGuide.selectLanguage")}</Text>
      <View style={styles.languageGrid}>
        {MINORITY_LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            style={[styles.languageCard, selected === lang.code && styles.languageCardSelected]}
            onPress={() => setSelected(lang.code)}
          >
            {selected === lang.code ? (
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={12} color={colors.onAmber} />
              </View>
            ) : null}
            <View style={[styles.langIcon, selected === lang.code && styles.langIconSelected]}>
              <Ionicons
                name="language"
                size={20}
                color={selected === lang.code ? colors.primaryText : colors.blue}
              />
            </View>
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
        <Ionicons name="information-circle" size={18} color={colors.blue} />
        <Text style={styles.noticeText}>{t("aiGuide.backendPendingNotice")}</Text>
      </View>

      <Button
        title={t("aiGuide.continueToTranslate")}
        icon="arrow-forward"
        iconPosition="right"
        size="lg"
        onPress={() =>
          router.push({
            pathname: "/(tabs)/ai-guide/chat",
            params: { languageCode: selected },
          })
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: spacing(2.25),
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  languageCardSelected: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow },
  langIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing(0.5),
  },
  langIconSelected: { backgroundColor: "rgba(255,255,255,0.14)" },
  checkBadge: {
    position: "absolute",
    top: spacing(1),
    right: spacing(1),
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  languageLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  languageLabelSelected: { color: colors.primaryText },
  languageRegion: { fontSize: 11, color: colors.textMuted },
  languageRegionSelected: { color: "rgba(255,255,255,0.7)" },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(0.75),
    backgroundColor: colors.blueSoft,
    borderRadius: radius.md,
    padding: spacing(1.5),
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.navy },
});
