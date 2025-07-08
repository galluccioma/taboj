import React, { useEffect, useState } from 'react';
import AppBar from './components/AppBar';
import MapsScraperForm from './views/MapsScraperForm';
import DnsScraperForm from './views/DnsScraperForm';
import AskScraperForm from './views/AskScraperForm';
import SiteBackup from './views/SiteBackup';
import SettingsPage from './views/SettingsPage';
import { SettingsProvider } from './components/SettingsContext';

function App() {
  const [scrapingType, setScrapingType] = useState('maps');
  const [viewMode, setViewMode] = useState<'scraping' | 'dashboard'>('scraping');
  const [showSettings, setShowSettings] = useState(false);
  const [lastScrapingType, setLastScrapingType] = useState(scrapingType);
  const [lastViewMode, setLastViewMode] = useState(viewMode);

  useEffect(() => {
    window.Main && window.Main.removeLoading();
  }, []);

  let formComponent;
  if (scrapingType === 'maps') {
    formComponent = <MapsScraperForm viewMode={viewMode} />;
  } else if (scrapingType === 'dns') {
    formComponent = <DnsScraperForm viewMode={viewMode} />;
  } else if (scrapingType === 'ask') {
    formComponent = <AskScraperForm viewMode={viewMode} />;
  } else if (scrapingType === 'backup') {
    formComponent = <SiteBackup viewMode={viewMode} />;
  }

  const handleOpenSettings = () => {
    setLastScrapingType(scrapingType);
    setLastViewMode(viewMode);
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
    setScrapingType(lastScrapingType);
    setViewMode(lastViewMode);
  };

  const handleChangeType = (type: string) => {
    if (showSettings) {
      setShowSettings(false);
    }
    setScrapingType(type);
  };

  return (
    <SettingsProvider>
      <div className="flex flex-col min-h-screen">
        <AppBar
          selectedType={showSettings ? 'settings' : scrapingType}
          onChangeType={handleChangeType}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          onOpenSettings={handleOpenSettings}
          title={showSettings ? 'Impostazioni' : undefined}
        />
        <div className="flex-1 flex flex-col items-center justify-start pt-8 pb-24">
          <main className="w-full max-w-7xl">
            {showSettings ? (
              <SettingsPage onBack={handleCloseSettings} />
            ) : (
              formComponent
            )}
          </main>
        </div>
      </div>
    </SettingsProvider>
  );
}

export default App;
