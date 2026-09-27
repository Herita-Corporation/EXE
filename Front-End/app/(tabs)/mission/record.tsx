import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { setPendingCapturedVideo } from "@/utils/pendingCapture";
import { colors, spacing } from "@/theme/colors";

// Real capture flow — backs mission/[id].tsx's evidence submission
// (submitMission() multipart Video upload).
const MAX_SECONDS = 15;

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MissionRecordScreen() {
  const { missionTitle, minSeconds } = useLocalSearchParams<{
    missionTitle?: string;
    minSeconds?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const secondsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!cameraPermission || !micPermission) {
    return <View style={styles.root} />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={[styles.root, styles.permissionWrap]}>
        <Ionicons name="videocam-outline" size={40} color="#FFFFFF" />
        <Text style={styles.permissionText}>Cần quyền camera và micro để quay video minh chứng.</Text>
        <Button
          title="Cấp quyền"
          onPress={async () => {
            await requestCameraPermission();
            await requestMicPermission();
          }}
        />
        <Button title="Quay lại" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  async function onPressIn() {
    if (recording) return;
    secondsRef.current = 0;
    setSeconds(0);
    setRecording(true);
    intervalRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);

    try {
      const video = await cameraRef.current?.recordAsync({ maxDuration: MAX_SECONDS });
      if (video?.uri) {
        setPendingCapturedVideo(video.uri, secondsRef.current);
        router.back();
      }
    } finally {
      setRecording(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }

  function onPressOut() {
    if (!recording) return;
    cameraRef.current?.stopRecording();
  }

  const min = minSeconds ? Number(minSeconds) : null;

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="video" />

      <View style={[styles.topRow, { top: insets.top + spacing(1.5) }]}>
        <IconButton icon="close" variant="glass" onPress={() => router.back()} />
        <View style={styles.missionPill}>
          <Ionicons name="compass" size={14} color={colors.goldMuted} />
          <Text style={styles.missionPillText} numberOfLines={1}>
            Mission: {missionTitle ?? "Evidence"}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.center}>
        <Text style={styles.timer}>{formatTime(seconds)}</Text>
        <Text style={styles.status}>
          {recording ? "Đang quay..." : min ? `Giữ để quay (tối thiểu ${min}s)` : "Giữ nút để quay"}
        </Text>
      </View>

      <View style={styles.bottomRow}>
        <Pressable
          style={[styles.shutterOuter, recording && styles.shutterOuterActive]}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
        >
          <View style={[styles.shutterInner, recording && styles.shutterInnerActive]} />
        </Pressable>
        <Text style={styles.hint}>Giữ để quay, thả ra để dừng</Text>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing(1) },
  timer: { fontSize: 40, fontWeight: "800", color: "#FFFFFF" },
  status: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  bottomRow: {
    position: "absolute",
    bottom: spacing(4),
    left: 0,
    right: 0,
    alignItems: "center",
    gap: spacing(1.5),
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterOuterActive: { borderColor: colors.danger },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFFFFF" },
  shutterInnerActive: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.danger },
  hint: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
});
