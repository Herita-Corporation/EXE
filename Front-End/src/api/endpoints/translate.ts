import { request } from "@/api/http";
import type {
  RecordedAudio,
  SpeechTranslationResult,
  TextTranslationResult,
  TranslationStatus,
} from "@/types/translate";

// Base: <EXPO_PUBLIC_AITOUR_API_URL>/api/v1/translate
// (AITour.Presentation/Controllers/TranslationController.cs — requires the user's JWT and proxies to
// the Bahnar-Translator Python service with a server-side key; the app never talks to it directly).
//
// Only Ba Na → Vietnamese exists today (the trained model's direction). Other languages in
// src/data/minorityLanguages.ts still go through the `translateText` stub below.

/** Language code (src/data/minorityLanguages.ts) that has a real backend. */
export const BAHNAR_LANGUAGE_CODE = "bana";

/** Server limits (TranslationController / translator): keep the UI in sync with them. */
export const BAHNAR_MAX_TEXT_LENGTH = 1000;
export const BAHNAR_MAX_RECORDING_MS = 30_000;

export function getTranslationStatus() {
  return request<TranslationStatus>("aiTour", "/api/v1/translate/status", {
    timeoutMs: 15000,
  });
}

/** Ba Na text → Vietnamese. The very first call after a server restart loads the models (~15–30 s). */
export function translateBahnarText(text: string, synthesize = false) {
  return request<TextTranslationResult>("aiTour", "/api/v1/translate/text", {
    method: "POST",
    data: { text, synthesize },
    timeoutMs: 60000,
  });
}

/** Recorded Ba Na speech → recognised Ba Na text + Vietnamese translation. */
export function translateBahnarSpeech(audio: RecordedAudio, synthesize = false) {
  const form = new FormData();
  // Same { uri, name, type } shape as uploadAvatar/createEvent — bound as IFormFile server-side.
  form.append("audio", {
    uri: audio.uri,
    name: audio.name,
    type: audio.mimeType,
  } as unknown as Blob);
  form.append("synthesize", String(synthesize));

  return request<SpeechTranslationResult>("aiTour", "/api/v1/translate/speech", {
    method: "POST",
    data: form,
    headers: { "Content-Type": "multipart/form-data" },
    timeoutMs: 90000, // upload + speech recognition + translation on a CPU server
  });
}

// ── Stub for languages without a backend yet (Vietnamese → other minority languages) ──────────

export interface TranslateRequest {
  text: string;
  targetLanguageCode: string;
}

export interface TranslateResult {
  translatedText: string;
}

export async function translateText(_request: TranslateRequest): Promise<TranslateResult> {
  // Simulated latency so the loading state is visible/testable in the UI.
  await new Promise((resolve) => setTimeout(resolve, 600));
  throw new Error("STUB_NOT_IMPLEMENTED");
}
