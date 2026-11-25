import { getAccessToken } from "@/utils/tokenStore";
import { getApiConfig } from "@/utils/apiConfigStore";
import { decodeJwt } from "@/utils/jwt";

export function evidenceImage(uri: string) {
  try {
    const base = new URL(getApiConfig().task);
    const url = new URL(uri, base);
    if (url.origin === base.origin && url.pathname.startsWith("/api/mission-media/")) {
      const token = getAccessToken();
      return { uri: url.href, headers: token ? { Authorization: `Bearer ${token}` } : undefined, cacheKey: url.href + "#account=" + (token ? decodeJwt(token)?.sub ?? "unknown" : "guest") };
    }
  } catch { /* local camera file or legacy image */ }
  return { uri };
}
