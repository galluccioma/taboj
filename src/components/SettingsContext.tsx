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
  aiToken: string;
  setAiToken: (value: string) => void;
  aiModel: string;
  setAiModel: (value: string) => void;
  googleServiceAccountKeyPath: string;
  setGoogleServiceAccountKeyPath: (value: string) => void;
  googleProjectId: string;
  setGoogleProjectId: (value: string) => void;
}

const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

const SETTINGS_KEY = 'app_settings';
const DEFAULT_META_ADS_ACCESS_TOKEN = '';
const DEFAULT_AI_TOKEN = '';
const DEFAULT_AI_MODEL = '';
const DEFAULT_GOOGLE_SERVICE_ACCOUNT_KEY_PATH = '';
const DEFAULT_GOOGLE_PROJECT_ID = '';

function getInitialSettings() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignora errori di parsing JSON e usa i valori di default
      }
    }
  }
  return {
    useProxy: false,
    customProxy: '',
    headless: true,
    metaAdsAccessToken: DEFAULT_META_ADS_ACCESS_TOKEN,
    aiToken: DEFAULT_AI_TOKEN,
    aiModel: DEFAULT_AI_MODEL,
    googleServiceAccountKeyPath: DEFAULT_GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    googleProjectId: DEFAULT_GOOGLE_PROJECT_ID,
  };
}

// Provider del contesto impostazioni
export function SettingsProvider({ children }: { children: ReactNode }) {
  const initial = getInitialSettings();
  const [useProxy, setUseProxy] = useState<boolean>(initial.useProxy);
  const [customProxy, setCustomProxy] = useState<string>(initial.customProxy);
  const [headless, setHeadless] = useState<boolean>(initial.headless);
  const [metaAdsAccessToken, setMetaAdsAccessToken] = useState<string>(initial.metaAdsAccessToken || DEFAULT_META_ADS_ACCESS_TOKEN);
  const [aiToken, setAiToken] = useState<string>(initial.aiToken || DEFAULT_AI_TOKEN);
  const [aiModel, setAiModel] = useState<string>(initial.aiModel || DEFAULT_AI_MODEL);
  const [googleServiceAccountKeyPath, setGoogleServiceAccountKeyPath] = useState<string>(initial.googleServiceAccountKeyPath || DEFAULT_GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
  const [googleProjectId, setGoogleProjectId] = useState<string>(initial.googleProjectId || DEFAULT_GOOGLE_PROJECT_ID);

  // Salva le impostazioni su localStorage ad ogni modifica
  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        useProxy,
        customProxy,
        headless,
        metaAdsAccessToken,
        aiToken,
        aiModel,
        googleServiceAccountKeyPath,
        googleProjectId,
      })
    );
  }, [useProxy, customProxy, headless, metaAdsAccessToken, aiToken, aiModel, googleServiceAccountKeyPath, googleProjectId]);

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
      aiToken,
      setAiToken,
      aiModel,
      setAiModel,
      googleServiceAccountKeyPath,
      setGoogleServiceAccountKeyPath,
      googleProjectId,
      setGoogleProjectId,
    }),
    [useProxy, setUseProxy, customProxy, setCustomProxy, headless, setHeadless, metaAdsAccessToken, setMetaAdsAccessToken, aiToken, setAiToken, aiModel, setAiModel, googleServiceAccountKeyPath, setGoogleServiceAccountKeyPath, googleProjectId, setGoogleProjectId]
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