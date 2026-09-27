/**
 * Thin request helper shared by all three backend services.
 *
 * Deliberately NOT three separate `axios.create()` instances: the base URL
 * for each service can change at runtime (API Settings screen), so the
 * target host is resolved from `apiConfigStore` on every call instead of
 * being baked into an instance at creation time.
 */
import axios, { AxiosRequestConfig } from "axios";
import { getApiConfig, ServiceKey } from "@/utils/apiConfigStore";
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from "@/utils/tokenStore";

export class ApiError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** Attach the Bearer token. Default true. */
  auth?: boolean;
  /** ms. Itinerary generation calls GPT and can take up to ~30s. */
  timeoutMs?: number;
}

async function doRequest<T>(
  service: ServiceKey,
  path: string,
  opts: RequestOptions
): Promise<T> {
  const base = getApiConfig()[service];
  const token = getAccessToken();

  const config: AxiosRequestConfig = {
    url: `${base}${path}`,
    method: opts.method ?? "GET",
    data: opts.data,
    params: opts.params,
    timeout: opts.timeoutMs ?? (service === "aiTour" ? 45000 : 15000),
    headers: {
      Accept: "application/json",
      ...opts.headers,
      ...(opts.auth !== false && token
        ? { Authorization: `Bearer ${token}` }
        : {}),
    },
  };

  try {
    const res = await axios.request<T>(config);
    return res.data;
  } catch (err) {
    throw toApiError(err);
  }
}

/** One-shot silent refresh using IAMService's /api/auth/refresh-token. */
async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const base = getApiConfig().iam;
    const res = await axios.post<{ accessToken?: string }>(
      `${base}/api/auth/refresh-token`,
      { refreshToken },
      { timeout: 10000 }
    );
    if (!res.data?.accessToken) return false;
    await setAccessToken(res.data.accessToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Main entry point used by every endpoint module. Retries exactly once,
 * after a silent token refresh, when the server answers 401.
 */
export async function request<T = unknown>(
  service: ServiceKey,
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  try {
    return await doRequest<T>(service, path, opts);
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 401 &&
      opts.auth !== false
    ) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return await doRequest<T>(service, path, opts);
      }
    }
    throw err;
  }
}

function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const body = err.response?.data as
      | { message?: string; error_code?: string; title?: string }
      | string
      | undefined;

    if (!err.response) {
      return new ApiError(
        "Không thể kết nối tới máy chủ. Kiểm tra API Settings và mạng Wi-Fi.",
        undefined,
        "NETWORK_ERROR"
      );
    }

    const message =
      (typeof body === "string" ? body : body?.message ?? body?.title) ??
      err.message;
    const code = typeof body === "object" ? body?.error_code : undefined;
    return new ApiError(message, status, code);
  }
  return new ApiError(
    err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định."
  );
}
