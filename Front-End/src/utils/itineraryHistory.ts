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
  /** Index into the flattened list of geocoded activities (coordinates !=
   * null) across all days — which waypoint GPS navigation is currently
   * headed to. Survives app restarts. */
  currentWaypointIndex?: number;
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

export async function setItineraryWaypointIndex(
  userId: string,
  id: string,
  index: number
): Promise<void> {
  const current = await getItineraryHistory(userId);
  const next = current.map((e) =>
    e.id === id ? { ...e, currentWaypointIndex: index } : e
  );
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
}

// The most recently generated itinerary, saved or not — its missions must
// survive pruning while the user is still reviewing it before saving.
function lastGeneratedKey(userId: string) {
  return `disa.lastGeneratedItinerary.v1.${userId}`;
}

export async function setLastGeneratedItinerary(userId: string, id: string): Promise<void> {
  await AsyncStorage.setItem(lastGeneratedKey(userId), id);
}

/** Itinerary ids whose missions should be kept: saved ones + the latest generated one. */
export async function getLiveItineraryIds(userId: string): Promise<string[]> {
  const history = await getItineraryHistory(userId);
  const ids = history.map((h) => h.id);
  try {
    const last = await AsyncStorage.getItem(lastGeneratedKey(userId));
    if (last && !ids.includes(last)) ids.push(last);
  } catch {}
  return ids;
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
