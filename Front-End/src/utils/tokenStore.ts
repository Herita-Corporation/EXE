/**
 * In-memory + SecureStore-backed holder for the JWT access/refresh tokens
 * issued by IAMService. Kept as a plain module (not React state) so the
 * axios request helper (src/api/http.ts) can read the current token
 * synchronously without importing React or creating a circular dependency
 * with AuthContext.
 */
import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "disa.accessToken";
const REFRESH_KEY = "disa.refreshToken";

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

/** Load persisted tokens into memory. Call once at app startup. */
export async function loadTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
  refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  return { accessToken, refreshToken };
}

export async function saveTokens(tokens: {
  accessToken: string;
  refreshToken?: string | null;
}): Promise<void> {
  accessToken = tokens.accessToken;
  await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    refreshToken = tokens.refreshToken;
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  }
}

/** Update just the access token (used after a silent refresh). */
export async function setAccessToken(token: string): Promise<void> {
  accessToken = token;
  await SecureStore.setItemAsync(ACCESS_KEY, token);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
