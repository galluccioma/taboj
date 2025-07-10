import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SettingsContextProps {
  useProxy: boolean;
  setUseProxy: (value: boolean) => void;
  customProxy: string;
  setCustomProxy: (value: string) => void;
  headless: boolean;
  setHeadless: (value: boolean) => void;
  metaAdsAccessToken: string;
  setMetaAdsAccessToken: (value: string) => void;
}

const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

const SETTINGS_KEY = 'app_settings';
const DEFAULT_META_ADS_ACCESS_TOKEN = '';

function getInitialSettings() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignore JSON parse errors and use default settings
      }
    }
  }
  return {
    useProxy: false,
    customProxy: '',
    headless: true,
    metaAdsAccessToken: DEFAULT_META_ADS_ACCESS_TOKEN,
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [useProxy, setUseProxy] = useState<boolean>(getInitialSettings().useProxy);
  const [customProxy, setCustomProxy] = useState<string>(getInitialSettings().customProxy);
  const [headless, setHeadless] = useState<boolean>(getInitialSettings().headless);
  const [metaAdsAccessToken, setMetaAdsAccessToken] = useState<string>(getInitialSettings().metaAdsAccessToken || DEFAULT_META_ADS_ACCESS_TOKEN);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ useProxy, customProxy, headless, metaAdsAccessToken })
    );
  }, [useProxy, customProxy, headless, metaAdsAccessToken]);

  const contextValue = React.useMemo(
    () => ({
      useProxy,
      setUseProxy,
      customProxy,
      setCustomProxy,
      headless,
      setHeadless,
      metaAdsAccessToken,
      setMetaAdsAccessToken,
    }),
    [useProxy, setUseProxy, customProxy, setCustomProxy, headless, setHeadless, metaAdsAccessToken, setMetaAdsAccessToken]
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
} 