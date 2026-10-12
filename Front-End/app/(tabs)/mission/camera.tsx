import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { setPendingCapturedPhoto } from "@/utils/pendingCapture";
import { useLocale } from "@/i18n/LocaleContext";
import { haptics } from "@/utils/haptics";
import { colors, spacing } from "@/theme/colors";

// Real capture flow — backs mission/[id].tsx's evidence submission
// (submitMission() multipart photo upload).
const ZOOM_LEVELS = [
  { label: ".5x", value: 0 },
  { label: "1x", value: 0.15 },
  { label: "2x", value: 0.3 },
];

export default function MissionCameraScreen() {
  const { missionTitle } = useLocalSearchParams<{ missionTitle?: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashOn, setFlashOn] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.permissionWrap]}>
        <Ionicons name="camera-outline" size={40} color="#FFFFFF" />
        <Text style={styles.permissionText}>{t("capture.cameraPermission")}</Text>
        <Button title={t("capture.grant")} onPress={requestPermission} />
        <Button title={t("capture.back")} variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  async function onCapture() {
    if (capturing) return;
    setCapturing(true);
    haptics.tap();
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        setPendingCapturedPhoto(photo.uri);
        router.back();
      }
    } finally {
      setCapturing(false);
    }
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={flashOn}
        zoom={ZOOM_LEVELS[zoomIndex].value}
      />

      <View style={[styles.topRow, { top: insets.top + spacing(1.5) }]}>
        <IconButton icon="close" variant="glass" onPress={() => router.back()} />
        <View style={styles.missionPill}>
          <Ionicons name="compass" size={14} color={colors.goldMuted} />
          <Text style={styles.missionPillText} numberOfLines={1}>
            {t("capture.missionPrefix", { title: missionTitle ?? t("capture.evidence") })}
          </Text>
        </View>
        <IconButton
          icon={flashOn ? "flash" : "flash-off"}
          variant="glass"
          onPress={() => setFlashOn((f) => !f)}
        />
      </View>

      <View style={[styles.bottomRow, { bottom: insets.bottom + spacing(4) }]}>
        <View style={styles.zoomRow}>
          {ZOOM_LEVELS.map((z, idx) => (
            <Pressable
              key={z.label}
              onPress={() => setZoomIndex(idx)}
              style={[styles.zoomPill, idx === zoomIndex && styles.zoomPillActive]}
            >
              <Text style={[styles.zoomText, idx === zoomIndex && styles.zoomTextActive]}>
                {z.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.shutterOuter} onPress={onCapture} disabled={capturing}>
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  permissionWrap: { alignItems: "center", justifyContent: "center", gap: spacing(1.5), padding: spacing(3) },
  permissionText: { color: "#FFFFFF", textAlign: "center" },
  topRow: {
    position: "absolute",
    left: spacing(2),
    right: spacing(2),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(1),
  },
  missionPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 999,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
  },
  missionPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600", flexShrink: 1 },
  bottomRow: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: spacing(2),
  },
  zoomRow: { flexDirection: "row", gap: spacing(1) },
  zoomPill: {
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  zoomPillActive: { backgroundColor: "#FFFFFF" },
  zoomText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  zoomTextActive: { color: "#000" },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFFFFF" },
});
