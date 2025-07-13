import React, { useEffect, useState } from 'react';
import AppBar from './components/AppBar';
import Sidebar from './components/Sidebar';
import MapsScraperForm from './views/MapsScraperForm';
import DnsScraperForm from './views/DnsScraperForm';
import AskScraperForm from './views/AskScraperForm';
import SiteBackup from './views/SiteBackup';
import SettingsPage from './views/SettingsPage';
import AdsScraperForm from './views/AdsScraperForm';
import { SettingsProvider } from './components/SettingsContext';
import { ScrapingProvider } from './components/ScrapingContext';

function App() {
  const [scrapingType, setScrapingType] = useState('maps');
  const [viewMode, setViewMode] = useState<'scraping' | 'dashboard'>('scraping');
  const [showSettings, setShowSettings] = useState(false);
  const [lastScrapingType, setLastScrapingType] = useState(scrapingType);
  const [lastViewMode, setLastViewMode] = useState(viewMode);
  // Sidebar open state for desktop layout
  // (Sidebar manages its own open state, but we need to add left padding to content)

  useEffect(() => {
    if (window.Main) {
      window.Main.removeLoading();
    }
  }, []);

  // Notifiche aggiornamento app (autoUpdater)
  useEffect(() => {
    if (!window.electron || !window.electron.on) return;
    // Aggiornamento disponibile
    window.electron.on('update-available', (url) => {
      window.alert('È disponibile una nuova versione di Taboj!\nVai su:\n' + url);
    });
    // Aggiornamento scaricato
    window.electron.on('update-downloaded', () => {
      window.alert('Aggiornamento scaricato! Riavvia l\'app per applicare l\'aggiornamento.');
    });
    // Errore aggiornamento
    window.electron.on('update-error', (err) => {
      window.alert('Errore durante la ricerca aggiornamenti: ' + err);
    });
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
  } else if (scrapingType === 'googleads') {
    formComponent = <AdsScraperForm viewMode={viewMode} />;
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
      <ScrapingProvider>
        <div className="flex min-h-screen bg-slate-900">
          {/* Sidebar overlays content on mobile, is fixed on desktop */}
          <AppBar
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            title={showSettings ? 'Impostazioni' : undefined}
          />

          {/* Main content, add left margin for sidebar on desktop */}
          <div className="flex-1 flex items-center justify-start transition-all duration-300">
            <Sidebar selectedType={showSettings ? 'settings' : scrapingType} onChangeType={handleChangeType} onOpenSettings={handleOpenSettings}
            />
            <main className="w-full sm:max-w-3xl max-w-5xl xl:max-w-7xl p-16 mx-auto h-full ">
              {showSettings ? <SettingsPage onBack={handleCloseSettings} /> : formComponent}
            </main>
          </div>
        </div>
      </ScrapingProvider>
    </SettingsProvider>
  );
}

export default App;
