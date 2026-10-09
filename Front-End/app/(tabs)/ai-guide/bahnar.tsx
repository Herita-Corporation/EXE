import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Speech from "expo-speech";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "@/components/IconButton";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  BAHNAR_MAX_RECORDING_MS,
  BAHNAR_MAX_TEXT_LENGTH,
  getTranslationStatus,
  translateBahnarSpeech,
  translateBahnarText,
} from "@/api/endpoints/translate";
import type { SpeechTranslationResult, TextTranslationResult } from "@/types/translate";
import { useLocale } from "@/i18n/LocaleContext";
import { colors, radius, spacing } from "@/theme/colors";

// Ba Na → Vietnamese (the direction the model was trained for). Speech is recorded on-device with
// expo-audio (.m4a), uploaded to AITourService (/api/v1/translate/speech, JWT) which forwards it to the
// Bahnar-Translator service. Other languages keep using the stub flow in ./chat.tsx.
//
// The Vietnamese translation is read aloud with the phone's own text-to-speech (expo-speech, vi-VN):
// automatically after a voice translation, and on demand via "Listen" — so people who can't read
// still understand it. No server TTS needed; works with poor connectivity.

const VI_SPEECH: Speech.SpeechOptions = { language: "vi-VN", rate: 0.9 };

type Result =
  | { kind: "speech"; data: SpeechTranslationResult }
  | { kind: "text"; data: TextTranslationResult };

function audioFileInfo(uri: string) {
  const ext = (uri.split("?")[0].split(".").pop() ?? "m4a").toLowerCase();
  const mimeType = ext === "wav" ? "audio/wav" : ext === "webm" ? "audio/webm" : ext === "caf" ? "audio/x-caf" : "audio/m4a";
  return { name: `bahnar-${Date.now()}.${ext}`, mimeType };
}

export default function BahnarTranslateScreen() {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0)).current;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const stoppingRef = useRef(false);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"speech" | "text" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstRunHint, setFirstRunHint] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [missingViVoice, setMissingViVoice] = useState(false);

  // Warn only when the phone reports voices but none is Vietnamese (an empty list just means the
  // engine hasn't initialised yet — common on Android — so don't raise a false alarm).
  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (voices.length > 0) {
          setMissingViVoice(!voices.some((v) => v.language?.toLowerCase().startsWith("vi")));
        }
      })
      .catch(() => {});
    return () => {
      Speech.stop().catch(() => {});
    };
  }, []);

  async function speakVietnamese(textVi: string) {
    if (!textVi.trim()) return;
    await Speech.stop().catch(() => {});
    // Loudspeaker (not the earpiece used while recording) and audible even with the iOS silent switch on.
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    Speech.speak(textVi, {
      ...VI_SPEECH,
      onStart: () => setSpeaking(true),
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }

  function stopSpeaking() {
    Speech.stop().catch(() => {});
    setSpeaking(false);
  }

  // Tell the user up-front if the server hasn't loaded the models yet, or the feature is off.
  useEffect(() => {
    let alive = true;
    getTranslationStatus()
      .then((s) => {
        if (!alive) return;
        if (!s.available) setError(s.message);
        else setFirstRunHint(!s.models_loaded);
      })
      .catch(() => {}); // a real call will surface network errors with a proper message
    return () => {
      alive = false;
    };
  }, []);

  const isRecording = recorderState.isRecording;
  const seconds = Math.floor((recorderState.durationMillis ?? 0) / 1000);

  // Expanding ring behind the mic while recording — makes "it's listening"
  // obvious at a glance.
  useEffect(() => {
    if (!isRecording) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  // Hard stop at the server's 30 s limit.
  useEffect(() => {
    if (isRecording && (recorderState.durationMillis ?? 0) >= BAHNAR_MAX_RECORDING_MS) {
      void stopAndTranslate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, recorderState.durationMillis]);

  function toMessage(err: unknown) {
    return err instanceof Error && err.message ? err.message : t("aiGuide.recordFailed");
  }

  async function startRecording() {
    if (busy) return;
    stopSpeaking();
    setError(null);
    setResult(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError(t("aiGuide.micPermissionDenied"));
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      stoppingRef.current = false;
      recorder.record();
    } catch {
      setError(t("aiGuide.recordFailed"));
    }
  }

  async function stopAndTranslate() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      await recorder.stop();
    } catch {
      setError(t("aiGuide.recordFailed"));
      return;
    } finally {
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }

    const uri = recorder.uri;
    if (!uri) {
      setError(t("aiGuide.recordFailed"));
      return;
    }
    setBusy("speech");
    try {
      const data = await translateBahnarSpeech({ uri, ...audioFileInfo(uri) });
      setResult({ kind: "speech", data });
      setFirstRunHint(false);
      // Voice in → voice out: read the translation aloud right away for listeners who can't read.
      if (!data.rejected) void speakVietnamese(data.translation_vi);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function onTranslateText() {
    const value = text.trim();
    if (!value || busy || isRecording) return;
    stopSpeaking();
    setBusy("text");
    setError(null);
    setResult(null);
    try {
      const data = await translateBahnarText(value);
      setResult({ kind: "text", data });
      setFirstRunHint(false);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const speech = result?.kind === "speech" ? result.data : null;
  const translation = result?.data.translation_vi ?? "";
  const rejected = speech?.rejected ?? false;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.headerRow, { paddingTop: insets.top + spacing(1) }]}>
        <IconButton icon="arrow-back" onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>{t("aiGuide.bahnarDirection")}</Text>
          <Text style={styles.subtitle}>Ba Na</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing(3) }]}
        keyboardShouldPersistTaps="handled"
      >
        {firstRunHint && !error ? (
          <View style={styles.hintCard}>
            <Ionicons name="time-outline" size={16} color={colors.navyDeep} />
            <Text style={styles.hintText}>{t("aiGuide.firstRunNotice")}</Text>
          </View>
        ) : null}
        <ErrorBanner message={error} />

        {/* ── Speak ─────────────────────────────────────────────── */}
        <View style={styles.micWrap}>
          {isRecording ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.micPulse,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                },
              ]}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isRecording ? t("aiGuide.stopRecording") : t("aiGuide.speakBahnar")}
            onPress={isRecording ? stopAndTranslate : startRecording}
            disabled={busy !== null}
            style={({ pressed }) => [
              styles.micButton,
              isRecording && styles.micButtonRecording,
              (pressed || busy !== null) && { opacity: 0.7 },
            ]}
          >
            {busy === "speech" ? (
              <ActivityIndicator color={colors.primaryText} size="large" />
            ) : (
              <Ionicons name={isRecording ? "stop" : "mic"} size={40} color={colors.primaryText} />
            )}
          </Pressable>
          <Text style={styles.micLabel}>
            {busy === "speech"
              ? t("aiGuide.translatingSpeech")
              : isRecording
                ? t("aiGuide.recordingProgress", { seconds, max: BAHNAR_MAX_RECORDING_MS / 1000 })
                : t("aiGuide.speakBahnar")}
          </Text>
        </View>

        {/* ── Or type ───────────────────────────────────────────── */}
        <Text style={styles.label}>{t("aiGuide.orTypeBahnar")}</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={4}
          maxLength={BAHNAR_MAX_TEXT_LENGTH}
          placeholder={t("aiGuide.bahnarTextPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button
          title={t("aiGuide.translateButton")}
          icon="swap-horizontal"
          loading={busy === "text"}
          disabled={!text.trim() || busy !== null || isRecording}
          onPress={onTranslateText}
        />

        {/* ── Result ────────────────────────────────────────────── */}
        {result ? (
          <View style={styles.resultCard}>
            {speech && (speech.transcript_bdq || !rejected) ? (
              <>
                <Text style={styles.label}>{t("aiGuide.recognizedBahnar")}</Text>
                <Text style={styles.transcript}>{speech.transcript_bdq || "—"}</Text>
              </>
            ) : null}

            {rejected ? (
              <View style={styles.rejectRow}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                <Text style={styles.rejectText}>{speech?.message}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>{t("aiGuide.translationVi")}</Text>
                <Text style={styles.translation}>{translation}</Text>
                <Button
                  title={speaking ? t("aiGuide.stopListening") : t("aiGuide.listenTranslation")}
                  icon={speaking ? "stop-circle-outline" : "volume-high"}
                  variant={speaking ? "secondary" : "primary"}
                  onPress={speaking ? stopSpeaking : () => void speakVietnamese(translation)}
                />
                {missingViVoice ? <Text style={styles.voiceHint}>{t("aiGuide.noVietnameseVoice")}</Text> : null}
              </>
            )}

            {rejected ? (
              <Button title={t("aiGuide.speakAgain")} icon="mic" variant="outline" onPress={startRecording} />
            ) : null}
            <Text style={styles.disclaimer}>{result.data.disclaimer}</Text>
          </View>
        ) : null}

        {/* Attribution required by the dataset licence (CC BY-NC 4.0). */}
        <Text style={styles.credit}>{t("aiGuide.dataCredit")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
  hintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(0.75),
    backgroundColor: colors.goldMuted,
    borderRadius: radius.md,
    padding: spacing(1.25),
  },
  hintText: { flex: 1, fontSize: 12, color: colors.navyDeep },
  micWrap: { alignItems: "center", gap: spacing(1), paddingVertical: spacing(2) },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonRecording: { backgroundColor: colors.danger },
  // Same footprint as micButton, centered on it (micWrap paddingTop = spacing(2)).
  micPulse: {
    position: "absolute",
    top: spacing(2),
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.danger,
  },
  micLabel: { fontSize: 13, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  textArea: {
    minHeight: 96,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(1.5),
    color: colors.text,
    textAlignVertical: "top",
  },
  resultCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing(1.75),
    gap: spacing(0.75),
  },
  transcript: { fontSize: 14, color: colors.text, fontStyle: "italic", lineHeight: 20 },
  translation: { fontSize: 18, fontWeight: "600", color: colors.navyDeep, lineHeight: 26 },
  rejectRow: { flexDirection: "row", alignItems: "center", gap: spacing(0.75) },
  rejectText: { flex: 1, fontSize: 14, color: colors.text },
  disclaimer: { fontSize: 11, color: colors.textMuted, marginTop: spacing(0.5) },
  voiceHint: { fontSize: 11, color: colors.warning },
  credit: { fontSize: 10, color: colors.textMuted, textAlign: "center", marginTop: spacing(1) },
});
