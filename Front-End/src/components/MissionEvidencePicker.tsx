import React, { useCallback, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import type { EvidenceFile } from "@/api/endpoints/missions";
import { useToast } from "@/context/ToastContext";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";
import { consumePendingCapturedPhoto, consumePendingCapturedVideo } from "@/utils/pendingCapture";

export function useMissionEvidence(missionTitle: string, minVideoSeconds?: number | null) {
  const { t } = useLocale();
  const { showToast } = useToast();
  const [photo, setPhoto] = useState<EvidenceFile | null>(null);
  const [video, setVideo] = useState<EvidenceFile | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);

  useFocusEffect(useCallback(() => {
    const capturedPhoto = consumePendingCapturedPhoto();
    if (capturedPhoto) setPhoto({ uri: capturedPhoto });
    const capturedVideo = consumePendingCapturedVideo();
    if (capturedVideo) {
      setVideo({ uri: capturedVideo.uri });
      setVideoDuration(capturedVideo.durationSec);
    }
  }, []));

  function openCamera() {
    router.push({
      pathname: "/(tabs)/mission/camera",
      params: { missionTitle },
    });
  }

  function openRecorder() {
    router.push({
      pathname: "/(tabs)/mission/record",
      params: { missionTitle, minSeconds: minVideoSeconds ? String(minVideoSeconds) : undefined },
    });
  }

  async function pickFromLibrary(kind: "images" | "videos") {
    try {
      // Browsers require opening the picker directly in the click handler.
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showToast(t("missionDetail.libraryPermission"), "error");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: [kind],
        quality: 0.7,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const evidence = { uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType, file: asset.file };
      if (kind === "images") {
        setPhoto(evidence);
      } else {
        setVideo(evidence);
        setVideoDuration(Math.round((asset.duration ?? 0) / 1000));
      }
    } catch {
      showToast(t("premium.pickFailed"), "error");
    }
  }

  return { photo, video, videoDuration, openCamera, openRecorder, pickFromLibrary };
}

export function MissionEvidencePicker({
  evidence,
  requiresPhoto,
  requiresVideo,
  allowVideoLibrary = false,
}: {
  evidence: ReturnType<typeof useMissionEvidence>;
  requiresPhoto: boolean;
  requiresVideo: boolean;
  allowVideoLibrary?: boolean;
}) {
  const { t } = useLocale();
  const { photo, video, videoDuration, openCamera, openRecorder, pickFromLibrary } = evidence;
  const isWeb = Platform.OS === "web";

  return (
    <>
      {video ? (
        <View style={styles.videoPreview}>
          <Ionicons name="videocam" size={28} color={colors.navy} />
          <Text style={styles.videoPreviewText}>
            {videoDuration
              ? t("missionDetail.videoRecorded", { seconds: videoDuration })
              : t("premium.videoSelected")}
          </Text>
        </View>
      ) : photo ? (
        <Image source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name={requiresVideo ? "videocam-outline" : "image-outline"} size={26} color={colors.textMuted} />
          <Text style={styles.placeholderText}>{t("missionDetail.evidenceHint")}</Text>
        </View>
      )}

      {requiresPhoto && (
        <View style={styles.buttonRow}>
          <Button title={t("missionDetail.takePhoto")} variant="secondary" icon="camera-outline" onPress={openCamera} style={styles.fill} />
          <Button title={t("missionDetail.pickFromLibrary")} variant="secondary" icon="images-outline" onPress={() => pickFromLibrary("images")} style={styles.fill} />
        </View>
      )}
      {requiresVideo && (
        <View style={styles.buttonRow}>
          {(!isWeb || !allowVideoLibrary) && (
            <Button
              title={video ? t("missionDetail.reRecord") : t("missionDetail.recordVideo")}
              variant="secondary"
              icon="videocam-outline"
              onPress={openRecorder}
              style={styles.fill}
            />
          )}
          {allowVideoLibrary && (
            <Button title={t("premium.pickVideo")} variant="secondary" icon="film-outline" onPress={() => pickFromLibrary("videos")} style={styles.fill} />
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  photoPreview: { width: "100%", height: 180, borderRadius: radius.md },
  videoPreview: {
    height: 100,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(0.75),
  },
  videoPreviewText: { color: colors.navy, fontSize: 13, fontWeight: "700" },
  placeholder: {
    minHeight: 96,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(0.5),
    padding: spacing(1.25),
  },
  placeholderText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", textAlign: "center" },
  buttonRow: { flexDirection: "row", gap: spacing(1) },
  fill: { flex: 1 },
});
