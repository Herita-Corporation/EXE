import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "@/api/endpoints/auth";
import { ApiError } from "@/api/http";
import type { AuthUser, MeResponse, RegisterResponse } from "@/types/auth";
import { decodeJwt } from "@/utils/jwt";
import {
  clearTokens,
  getRefreshToken,
  loadTokens,
  saveTokens,
} from "@/utils/tokenStore";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    phoneNumber: string
  ) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function userFromToken(accessToken: string, knownUsername = ""): AuthUser | null {
  const payload = decodeJwt(accessToken);
  if (!payload?.sub) return null;
  const emailClaim =
    (payload[
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    ] as string | undefined) ?? "";
  const rawRoles =
    payload[
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role"
    ];
  const roles = Array.isArray(rawRoles)
    ? (rawRoles as string[])
    : rawRoles
    ? [rawRoles as string]
    : [];
  return {
    id: payload.sub,
    // The JWT carries no username claim — seeded from the login form when
    // available, else left blank until the /me call below fills it in.
    username: knownUsername,
    email: emailClaim,
    phoneNumber: null,
    isEmailVerified: false,
    isPhoneVerified: false,
    avatarUrl: null,
    roles,
  };
}

function meFields(me: MeResponse) {
  return {
    username: me.username,
    email: me.email,
    phoneNumber: me.phoneNumber,
    isEmailVerified: me.isEmailVerified,
    isPhoneVerified: me.isPhoneVerified,
    avatarUrl: me.avatarUrl,
    roles: me.roles,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { accessToken } = await loadTokens();
      if (accessToken) {
        setUser(userFromToken(accessToken));
        // Best-effort: confirm the token is still accepted and enrich email.
        try {
          const me = await authApi.me();
          setUser((prev) => (prev ? { ...prev, ...meFields(me) } : prev));
        } catch {
          // Token invalid/expired and refresh failed inside the http layer.
          if (!getRefreshToken()) {
            await clearTokens();
            setUser(null);
          }
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    await saveTokens({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
    });
    setUser(userFromToken(res.accessToken, username));
    try {
      const me = await authApi.me();
      setUser((prev) => (prev ? { ...prev, ...meFields(me) } : prev));
    } catch {
      // Non-fatal — we already have a usable session from the JWT itself.
    }
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string, phoneNumber: string) => {
      return authApi.register({ username, email, password, phoneNumber });
    },
    []
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await authApi.logout({ refreshToken });
    } catch (err) {
      // Ignore — e.g. IAMService unreachable. We still clear local state.
      if (!(err instanceof ApiError)) throw err;
    } finally {
      await clearTokens();
      setUser(null);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await authApi.me();
    setUser((prev) => (prev ? { ...prev, ...meFields(me) } : prev));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshMe,
    }),
    [user, isLoading, login, register, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
