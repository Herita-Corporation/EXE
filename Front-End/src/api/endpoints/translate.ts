// STUB — no translation backend exists yet. The AI Guide's Python service
// will eventually expose something like POST /api/v1/translate on the
// AI-Itinerary stack; this function is the single place that call will be
// wired in later, so screens don't need to change when it lands.

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
