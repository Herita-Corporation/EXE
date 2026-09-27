/**
 * Minimal, dependency-free JWT payload decoder.
 *
 * React Native / Hermes has no built-in `atob`, so this ships its own tiny
 * base64 decoder instead of pulling in a library just to read a token's
 * claims client-side (we never trust this for security — it's only used to
 * read the `sub` (user id) claim for convenience; the server always
 * re-validates the signature).
 */
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Decode(input: string): string {
  const str = input.replace(/=+$/, "");
  let output = "";
  let buffer = 0;
  let bitsCollected = 0;

  for (let i = 0; i < str.length; i++) {
    const value = BASE64_CHARS.indexOf(str[i]);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      output += String.fromCharCode((buffer >> bitsCollected) & 0xff);
    }
  }
  return output;
}

/** Known claim keys the IAMService JwtTokenGenerator embeds. */
export interface DisaJwtPayload {
  sub: string; // user id (GUID)
  jti?: string;
  exp?: number;
  iss?: string;
  aud?: string;
  [claimUri: string]: unknown; // Email/Role claims use long ClaimTypes URIs
}

export function decodeJwt(token: string): DisaJwtPayload | null {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = base64Decode(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return false;
  return Date.now() >= payload.exp * 1000;
}
