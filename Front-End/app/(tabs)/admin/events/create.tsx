import React, { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { IconButton } from "@/components/IconButton";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import * as eventsApi from "@/api/endpoints/events";
import { ApiError } from "@/api/http";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

export default function CreateEventScreen() {
  const { t } = useLocale();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickCoverImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("admin.missingPermission"), t("admin.missingPermissionMessage"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverImageUri(result.assets[0].uri);
    }
  }

  async function onSubmit() {
    setError(null);
    if (!title.trim() || !description.trim() || !tag.trim() || !city.trim()) {
      setError(t("admin.eventFieldsRequired"));
      return;
    }
    setLoading(true);
    try {
      await eventsApi.createEvent({
        title: title.trim(),
        description: description.trim(),
        tag: tag.trim(),
        city: city.trim(),
        startDate,
        endDate,
        coverImageUri,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.eventSaveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>{t("admin.createEvent")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Card variant="elevated" style={styles.card}>
        <ErrorBanner message={error} />

        <Pressable style={styles.coverPicker} onPress={pickCoverImage}>
          {coverImageUri ? (
            <Image source={{ uri: coverImageUri }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.textMuted} />
              <Text style={styles.coverPlaceholderText}>{t("admin.pickCoverImage")}</Text>
            </View>
          )}
        </Pressable>

        <Input label={t("admin.eventTitleLabel")} value={title} onChangeText={setTitle} />
        <Input
          label={t("admin.eventDescriptionLabel")}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />
        <Input label={t("admin.eventTagLabel")} value={tag} onChangeText={setTag} />
        <Input label={t("admin.eventCityLabel")} value={city} onChangeText={setCity} />

        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t("admin.eventStartDateLabel")}</Text>
            <Pressable style={styles.selectBox} onPress={() => setShowStartPicker(true)}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.selectText}>{startDate}</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t("admin.eventEndDateLabel")}</Text>
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

        <Button title={t("admin.createEvent")} onPress={onSubmit} loading={loading} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", color: colors.navy },
  card: { marginTop: spacing(1.5), gap: spacing(1.5) },
  coverPicker: { borderRadius: radius.md, overflow: "hidden" },
  coverImage: { width: "100%", height: 160 },
  coverPlaceholder: {
    height: 160,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(0.5),
    backgroundColor: colors.surfaceAlt,
  },
  coverPlaceholderText: { color: colors.textMuted, fontSize: 12 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  dateRow: { flexDirection: "row", gap: spacing(1.5) },
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
