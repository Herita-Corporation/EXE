// Mirrors AITour.Infrastructure/ExternalServices/Translation/Models/TranslationModels.cs.
// snake_case on purpose — same convention as src/types/itinerary.ts: AITour passes the
// Python translator's JSON through with [JsonPropertyName] snake_case fields.

export interface TranslationStatus {
  available: boolean;
  /** false until the first request warms the models up (~15–30 s). */
  models_loaded: boolean;
  source_language: string;
  target_language: string;
  message: string;
}

export interface TextTranslationResult {
  translation_vi: string;
  confidence: Record<string, number>;
  disclaimer: string;
  audio_vi_wav_base64?: string;
  sample_rate?: number;
  latency_ms: Record<string, number>;
}

export interface SpeechTranslationResult {
  /** Recognised Bahnar text. */
  transcript_bdq: string;
  translation_vi: string;
  audio_vi_wav_base64?: string;
  sample_rate: number | null;
  confidence: Record<string, number>;
  latency_ms: Record<string, number>;
  /** true → no speech / low confidence: show `message`, ask the user to speak again. */
  rejected: boolean;
  message: string;
  disclaimer: string;
}

/** A local recording to upload (expo-audio gives a file:// URI). */
export interface RecordedAudio {
  uri: string;
  /** e.g. "recording.m4a" */
  name: string;
  /** e.g. "audio/m4a" */
  mimeType: string;
}
