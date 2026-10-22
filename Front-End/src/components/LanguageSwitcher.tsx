import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/i18n/LocaleContext";
import { Button } from "@/components/Button";
import { colors, radius, spacing } from "@/theme/colors";

export function LanguagePickerModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t, locale, setLocale } = useLocale();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{t("settings.selectLanguage")}</Text>
          {(["en", "vi"] as const).map((code) => (
            <Pressable
              key={code}
              style={styles.modalRow}
              onPress={() => {
                setLocale(code);
                onClose();
              }}
            >
              <Text style={styles.modalRowText}>
                {code === "en" ? t("settings.languageEnglish") : t("settings.languageVietnamese")}
              </Text>
              {locale === code ? <Ionicons name="checkmark" size={18} color={colors.navy} /> : null}
            </Pressable>
          ))}
          <Button title={t("common.cancel")} variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

// Compact "EN"/"VI" pill used on screens outside the authenticated tabs
// (Login/Register) where Settings isn't reachable to change language.
export function LanguageSwitcherButton({ style }: { style?: object }) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={[styles.trigger, style]} onPress={() => setOpen(true)} hitSlop={8}>
        <Ionicons name="globe-outline" size={14} color={colors.navy} />
        <Text style={styles.triggerText}>{locale.toUpperCase()}</Text>
      </Pressable>
      <LanguagePickerModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  triggerText: { fontSize: 12, fontWeight: "700", color: colors.navy },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing(2.5),
    gap: spacing(1),
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
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
