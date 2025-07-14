import React, { useEffect, useState } from 'react';
import AppBar from './components/AppBar';
import Sidebar from './components/Sidebar';
import MapsScraperForm from './views/MapsScraperForm';
import DnsScraperForm from './views/DnsScraperForm';
import AskScraperForm from './views/AskScraperForm';
import SiteBackup from './views/SiteBackup';
import SettingsPage from './views/SettingsPage';
import AdsScraperForm from './views/AdsScraperForm';
import Dashboard from './views/Dashboard';
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

  // Stato per mostrare la dashboard dopo lo scraping
  const [dashboardData, setDashboardData] = useState<any[] | null>(null);
  const [dashboardCsvPath, setDashboardCsvPath] = useState<string>('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardQuickActionsState, setDashboardQuickActions] = useState<{ label: string; prompt: string }[]>([]);

  // Rimuovi dashboardQuickActions e scrapingType dal render

  useEffect(() => {
    if (window.Main) {
      window.Main.removeLoading();
    }
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

  // handleScrapingComplete ora accetta anche le quickActions
  const handleScrapingComplete = (data: any[], csvPath: string, quickActions: { label: string; prompt: string }[]) => {
    setDashboardData(data);
    setDashboardCsvPath(csvPath);
    setShowDashboard(true);
    setDashboardQuickActions(quickActions);
  };

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
              {showSettings ? (
                <SettingsPage onBack={handleCloseSettings} />
              ) : showDashboard && dashboardData ? (
                <Dashboard
                  data={dashboardData}
                  csvPath={dashboardCsvPath}
                  quickActions={dashboardQuickActionsState}
                  onBack={() => setShowDashboard(false)}
                />
              ) : (
                // Passa handleScrapingComplete come prop ai tuoi ScraperForm
                React.cloneElement(formComponent as React.ReactElement<any>, { onScrapingComplete: handleScrapingComplete })
              )}
            </main>
          </div>
        </div>
      </ScrapingProvider>
    </SettingsProvider>
  );
}

export default App;
