import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/Button";
import { translateText } from "@/api/endpoints/translate";
import { MINORITY_LANGUAGES } from "@/data/minorityLanguages";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

// Translation UI only — src/api/endpoints/translate.ts currently stubs the
// call (the Python translation backend is a separate, later effort). This
// screen stays fully usable/demoable while making that gap explicit instead
// of pretending the translation is real.
export default function AiGuideTranslateScreen() {
  const { languageCode } = useLocalSearchParams<{ languageCode?: string }>();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const language =
    MINORITY_LANGUAGES.find((l) => l.code === languageCode) ?? MINORITY_LANGUAGES[0];

  const [sourceText, setSourceText] = useState("");
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onTranslate() {
    if (!sourceText.trim() || translating) return;
    setTranslating(true);
    setNotice(null);
    setTranslated(null);
    try {
      const result = await translateText({ text: sourceText.trim(), targetLanguageCode: language.code });
      setTranslated(result.translatedText);
    } catch {
      setNotice(t("aiGuide.translateStubNotice"));
    } finally {
      setTranslating(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, { paddingTop: insets.top + spacing(1) }]}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>{t("aiGuide.translateTo")}</Text>
          <Text style={styles.subtitle}>{language.name}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>{t("aiGuide.vietnameseText")}</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={5}
          placeholder={t("aiGuide.vietnameseTextPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={sourceText}
          onChangeText={setSourceText}
        />

        <Button
          title={t("aiGuide.translateButton")}
          icon="swap-horizontal"
          loading={translating}
          disabled={!sourceText.trim()}
          onPress={onTranslate}
        />

        <Text style={styles.label}>{language.name}</Text>
        <View style={styles.resultBox}>
          {notice ? (
            <View style={styles.noticeRow}>
              <Ionicons name="construct-outline" size={16} color={colors.gold} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : (
            <Text style={[styles.resultText, !translated && styles.resultPlaceholder]}>
              {translated ?? t("aiGuide.resultPlaceholder")}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(2),
    paddingBottom: spacing(1),
  },
  title: { fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 },
  subtitle: { fontSize: 18, fontWeight: "700", color: colors.navy },
  body: { padding: spacing(2.5), gap: spacing(1.25) },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  textArea: {
    minHeight: 110,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(1.5),
    color: colors.text,
    textAlignVertical: "top",
  },
  resultBox: {
    minHeight: 110,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing(1.5),
    justifyContent: "center",
  },
  resultText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  resultPlaceholder: { color: colors.textMuted },
  noticeRow: { flexDirection: "row", alignItems: "center", gap: spacing(0.75) },
  noticeText: { flex: 1, fontSize: 12, color: colors.textMuted },
});
