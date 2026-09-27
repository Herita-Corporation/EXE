/**
 * Runtime-overridable API base URLs for each backend microservice.
 *
 * Defaults come from EXPO_PUBLIC_* env vars (baked in at build time via
 * `.env`). They can be overridden at runtime from the "API Settings" screen
 * (see app/settings.tsx) — this is what makes the app usable in Expo Go on a
 * physical phone without rebuilding, since the right LAN IP is only known
 * once the app is actually running on the device's network.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ServiceKey = "iam" | "aiTour" | "task";

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  iam: "IAMService (auth)",
  aiTour: "AITourService (itinerary)",
  task: "Task.Presentation (missions)",
};

export const DEFAULT_URLS: Record<ServiceKey, string> = {
  iam: process.env.EXPO_PUBLIC_IAM_API_URL ?? "http://localhost:5195",
  aiTour: process.env.EXPO_PUBLIC_AITOUR_API_URL ?? "http://localhost:5289",
  task: process.env.EXPO_PUBLIC_TASK_API_URL ?? "http://localhost:5020",
};

const STORAGE_KEY = "disa.apiConfig.v1";

let current: Record<ServiceKey, string> = { ...DEFAULT_URLS };
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Must be awaited once at app startup (see AppProviders) before any request fires. */
export async function loadApiConfig(): Promise<Record<ServiceKey, string>> {
  if (loaded) return current;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) current = { ...DEFAULT_URLS, ...JSON.parse(raw) };
  } catch {
    // Corrupt storage — fall back to defaults silently.
  }
  loaded = true;
  notify();
  return current;
}

export function getApiConfig(): Record<ServiceKey, string> {
  return current;
}

export async function setApiConfig(
  partial: Partial<Record<ServiceKey, string>>
): Promise<void> {
  current = { ...current, ...partial };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  notify();
}

export async function resetApiConfig(): Promise<void> {
  current = { ...DEFAULT_URLS };
  await AsyncStorage.removeItem(STORAGE_KEY);
  notify();
}

export function subscribeApiConfig(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
