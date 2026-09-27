import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Toggle } from "@/components/Toggle";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as vouchersApi from "@/api/endpoints/vouchers";
import { ApiError } from "@/api/http";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

export default function EditVoucherScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
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
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setLoading(true);
      setError(null);
      vouchersApi
        .getVoucher(id)
        .then((v) => {
          setCategory(v.category);
          setTitle(v.title);
          setDescription(v.description);
          setImageUrl(v.imageUrl);
          setPointsCost(String(v.pointsCost));
          setDiscountLabel(v.discountLabel);
          setLocation(v.location);
          setExpiresAt(v.expiresAt.slice(0, 10));
          setCode(v.code);
          setTerms(v.terms.join("\n"));
          setIsActive(v.isActive);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : t("voucher.loadFailed")))
        .finally(() => setLoading(false));
    }, [id, t])
  );

  async function onSave() {
    if (!id) return;
    setError(null);
    if (!category.trim() || !title.trim() || !description.trim() || !code.trim() || !pointsCost) {
      setError(t("admin.voucherFieldsRequired"));
      return;
    }
    setSaving(true);
    try {
      await vouchersApi.updateVoucher(id, {
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
        isActive,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.voucherSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (!id) return;
    Alert.alert(t("admin.deleteVoucherConfirmTitle"), t("admin.deleteVoucherConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.delete"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await vouchersApi.deleteVoucher(id);
            router.back();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : t("admin.voucherDeleteFailed"));
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("admin.editVoucher")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: spacing(3) }} />
      ) : (
        <>
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

            <Toggle label={t("admin.eventActiveLabel")} value={isActive} onValueChange={setIsActive} />

            <Button title={t("admin.saveChanges")} onPress={onSave} loading={saving} />
          </Card>

          <Card style={styles.card}>
            <Button title={t("admin.delete")} variant="danger" onPress={onDelete} loading={deleting} />
          </Card>
        </>
      )}
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
