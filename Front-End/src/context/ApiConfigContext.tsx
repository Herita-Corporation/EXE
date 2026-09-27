import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DEFAULT_URLS,
  getApiConfig,
  loadApiConfig,
  resetApiConfig,
  ServiceKey,
  setApiConfig,
  subscribeApiConfig,
} from "@/utils/apiConfigStore";

interface ApiConfigContextValue {
  config: Record<ServiceKey, string>;
  defaults: Record<ServiceKey, string>;
  isReady: boolean;
  update: (partial: Partial<Record<ServiceKey, string>>) => Promise<void>;
  reset: () => Promise<void>;
}

const ApiConfigContext = createContext<ApiConfigContextValue | undefined>(
  undefined
);

export function ApiConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState(getApiConfig());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadApiConfig().then((loaded) => {
      setConfig(loaded);
      setIsReady(true);
    });
    return subscribeApiConfig(() => setConfig(getApiConfig()));
  }, []);

  const update = useCallback(
    (partial: Partial<Record<ServiceKey, string>>) => setApiConfig(partial),
    []
  );
  const reset = useCallback(() => resetApiConfig(), []);

  return (
    <ApiConfigContext.Provider
      value={{ config, defaults: DEFAULT_URLS, isReady, update, reset }}
    >
      {children}
    </ApiConfigContext.Provider>
  );
}

export function useApiConfig(): ApiConfigContextValue {
  const ctx = useContext(ApiConfigContext);
  if (!ctx)
    throw new Error("useApiConfig must be used within an ApiConfigProvider");
  return ctx;
}
