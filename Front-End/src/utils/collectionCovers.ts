/**
 * ItineraryResponse has no photo of its own (AI-Itinerary only returns the
 * generated plan), so "My Collection" lets the user pick a representative
 * cover image per itinerary from their device library. Stored locally only
 * — no backend field exists to persist this server-side. Keyed by user id,
 * same reasoning as itineraryHistory.ts.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

function storageKey(userId: string) {
  return `disa.collectionCovers.v1.${userId}`;
}

export async function getCollectionCovers(
  userId: string
): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function setCollectionCover(
  userId: string,
  itineraryId: string,
  uri: string
): Promise<void> {
  const current = await getCollectionCovers(userId);
  current[itineraryId] = uri;
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(current));
}
