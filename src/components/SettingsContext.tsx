import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SettingsContextProps {
  useProxy: boolean;
  setUseProxy: (value: boolean) => void;
  customProxy: string;
  setCustomProxy: (value: string) => void;
  headless: boolean;
  setHeadless: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

const SETTINGS_KEY = 'app_settings';

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
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [useProxy, setUseProxy] = useState<boolean>(getInitialSettings().useProxy);
  const [customProxy, setCustomProxy] = useState<string>(getInitialSettings().customProxy);
  const [headless, setHeadless] = useState<boolean>(getInitialSettings().headless);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ useProxy, customProxy, headless })
    );
  }, [useProxy, customProxy, headless]);

  const contextValue = React.useMemo(
    () => ({
      useProxy,
      setUseProxy,
      customProxy,
      setCustomProxy,
      headless,
      setHeadless,
    }),
    [useProxy, setUseProxy, customProxy, setCustomProxy, headless, setHeadless]
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