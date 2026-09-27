import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as vouchersApi from "@/api/endpoints/vouchers";
import { ApiError } from "@/api/http";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

export default function CreateVoucherScreen() {
  const { t } = useLocale();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [discountLabel, setDiscountLabel] = useState("");
  const [location, setLocation] = useState("");
  const [expiresAt, setExpiresAt] = useState(new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [code, setCode] = useState("");
  const [terms, setTerms] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!category.trim() || !title.trim() || !description.trim() || !code.trim() || !pointsCost) {
      setError(t("admin.voucherFieldsRequired"));
      return;
    }
    setLoading(true);
    try {
      await vouchersApi.createVoucher({
        category: category.trim(),
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        pointsCost: Number(pointsCost),
        discountLabel: discountLabel.trim(),
        location: location.trim(),
        expiresAt,
        code: code.trim(),
        terms: terms.split("\n").map((t) => t.trim()).filter(Boolean),
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.voucherSaveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("admin.createVoucher")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Card variant="elevated" style={styles.card}>
        <ErrorBanner message={error} />

        <Input label={t("admin.voucherCategoryLabel")} value={category} onChangeText={setCategory} />
        <Input label={t("admin.voucherTitleLabel")} value={title} onChangeText={setTitle} />
        <Input
          label={t("admin.voucherDescriptionLabel")}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />
        <Input label={t("admin.voucherImageUrlLabel")} value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" />
        <Input
          label={t("admin.voucherPointsCostLabel")}
          value={pointsCost}
          onChangeText={setPointsCost}
          keyboardType="numeric"
        />
        <Input label={t("admin.voucherDiscountLabelLabel")} value={discountLabel} onChangeText={setDiscountLabel} />
        <Input label={t("admin.voucherLocationLabel")} value={location} onChangeText={setLocation} />

        <Text style={styles.label}>{t("admin.voucherExpiresAtLabel")}</Text>
        <Pressable style={styles.selectBox} onPress={() => setShowDatePicker(true)}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.selectText}>{expiresAt}</Text>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            value={new Date(expiresAt)}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) setExpiresAt(date.toISOString().slice(0, 10));
            }}
          />
        ) : null}

        <Input label={t("admin.voucherCodeLabel")} value={code} onChangeText={setCode} autoCapitalize="characters" />
        <Input
          label={t("admin.voucherTermsLabel")}
          value={terms}
          onChangeText={setTerms}
          multiline
          numberOfLines={3}
          placeholder={t("admin.voucherTermsPlaceholder")}
        />

        <Button title={t("admin.createVoucher")} onPress={onSubmit} loading={loading} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", color: colors.navy },
  card: { marginTop: spacing(1.5), gap: spacing(1.5) },
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
});
