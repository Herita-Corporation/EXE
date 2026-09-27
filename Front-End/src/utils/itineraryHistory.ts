/**
 * AI-Itinerary has no "list my itineraries" endpoint (only
 * generate / get-by-id / delete-by-id — see AI-Itinerary/app/api/routes/itinerary.py).
 * We keep a small local index of itinerary ids the user generated on this
 * device so the Itinerary tab has something to list. Keyed by user id —
 * previously a single device-wide key, which meant every account on the
 * same device/session saw the same itinerary history.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ItineraryHistoryEntry {
  id: string;
  cities: string[];
  totalCost: number;
  createdAt: string;
  /** Set only once the user explicitly taps "Bắt đầu lộ trình" on the detail
   * screen — absent/null means the itinerary is just saved, not under way.
   * Generating/confirming an itinerary no longer auto-marks it as ongoing. */
  startedAt?: string | null;
}

function storageKey(userId: string) {
  return `disa.itineraryHistory.v1.${userId}`;
}

export async function getItineraryHistory(
  userId: string
): Promise<ItineraryHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as ItineraryHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function addItineraryToHistory(
  userId: string,
  entry: ItineraryHistoryEntry
): Promise<void> {
  const current = await getItineraryHistory(userId);
  const next = [entry, ...current.filter((e) => e.id !== entry.id)].slice(
    0,
    50
  );
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
}

export async function markItineraryStarted(
  userId: string,
  id: string
): Promise<void> {
  const current = await getItineraryHistory(userId);
  const next = current.map((e) =>
    e.id === id ? { ...e, startedAt: new Date().toISOString() } : e
  );
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
}

export async function removeItineraryFromHistory(
  userId: string,
  id: string
): Promise<void> {
  const current = await getItineraryHistory(userId);
  await AsyncStorage.setItem(
    storageKey(userId),
    JSON.stringify(current.filter((e) => e.id !== id))
  );
}
