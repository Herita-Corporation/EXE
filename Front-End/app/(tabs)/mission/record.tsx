import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { setPendingCapturedVideo } from "@/utils/pendingCapture";
import { useLocale } from "@/i18n/LocaleContext";
import { useToast } from "@/context/ToastContext";
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
  const { t } = useLocale();
  const { showToast } = useToast();
  const min = minSeconds ? Number(minSeconds) : null;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef(false);
  const secondsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (recordingRef.current) {
        try {
          cameraRef.current?.stopRecording();
        } catch {}
      }
    };
  }, []);

  if (!cameraPermission || !micPermission) {
    return <View style={styles.root} />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={[styles.root, styles.permissionWrap]}>
        <Ionicons name="videocam-outline" size={40} color="#FFFFFF" />
        <Text style={styles.permissionText}>{t("capture.videoPermission")}</Text>
        <Button
          title={t("capture.grant")}
          onPress={async () => {
            await requestCameraPermission();
            await requestMicPermission();
          }}
        />
        <Button title={t("capture.back")} variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  async function onPressIn() {
    // React state does not update synchronously, so use a ref as the lock to
    // prevent two native recordAsync calls from a quick/double press.
    if (recordingRef.current) return;
    if (!cameraReady || cameraError || !cameraRef.current) {
      showToast(t("capture.cameraNotReady"), "error");
      return;
    }

    recordingRef.current = true;
    secondsRef.current = 0;
    setSeconds(0);
    setRecording(true);
    intervalRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);

    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: MAX_SECONDS });
      if (video?.uri) {
        // Server rejects evidence shorter than the template's minimum — catch
        // it here so the user can simply hold the button again.
        if (min && secondsRef.current < min) {
          showToast(t("capture.tooShort", { min }), "error");
          return;
        }
        setPendingCapturedVideo(video.uri, secondsRef.current);
        router.back();
      }
    } catch {
      // recordAsync rejects on Android when the camera session is not ready,
      // is interrupted, or the recorder cannot start. Pressable does not await
      // this handler, so the error must be consumed here to avoid an unhandled
      // promise/RedBox.
      setCameraReady(false);
      setCameraKey((key) => key + 1); // rebuild a potentially broken native session
      showToast(t("capture.recordFailed"), "error");
    } finally {
      recordingRef.current = false;
      setRecording(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }

  function onPressOut() {
    if (!recordingRef.current) return;
    try {
      cameraRef.current?.stopRecording();
    } catch {
      // recordAsync owns the user-visible error path. Some Android camera
      // implementations throw here as the recording session is torn down.
    }
  }

  return (
    <View style={styles.root}>
      <CameraView
        key={cameraKey}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="video"
        videoQuality="480p"
        onCameraReady={() => {
          setCameraError(false);
          setCameraReady(true);
        }}
        onMountError={() => {
          setCameraReady(false);
          setCameraError(true);
          showToast(t("capture.cameraUnavailable"), "error");
        }}
      />

      <View style={[styles.topRow, { top: insets.top + spacing(1.5) }]}>
        <IconButton icon="close" variant="glass" onPress={() => router.back()} />
        <View style={styles.missionPill}>
          <Ionicons name="compass" size={14} color={colors.goldMuted} />
          <Text style={styles.missionPillText} numberOfLines={1}>
            {t("capture.missionPrefix", { title: missionTitle ?? t("capture.evidence") })}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.center}>
        <Text style={styles.timer}>
          {formatTime(seconds)}
          <Text style={styles.timerMax}> / {formatTime(MAX_SECONDS)}</Text>
        </Text>
        <Text style={styles.status}>
          {recording
            ? t("capture.recording", { max: MAX_SECONDS })
            : min
              ? t("capture.holdToRecordMin", { min, max: MAX_SECONDS })
              : t("capture.holdToRecord", { max: MAX_SECONDS })}
        </Text>
      </View>

      <View style={[styles.bottomRow, { bottom: insets.bottom + spacing(4) }]}>
        <Pressable
          style={[styles.shutterOuter, recording && styles.shutterOuterActive]}
          disabled={!cameraReady || cameraError}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
        >
          <View style={[styles.shutterInner, recording && styles.shutterInnerActive]} />
        </Pressable>
        <Text style={styles.hint}>{t("capture.hint")}</Text>
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
  timerMax: { fontSize: 20, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  status: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  bottomRow: {
    position: "absolute",
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
