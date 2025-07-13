import React, { useEffect, useState, useRef } from 'react';
import Footer from '../components/Footer';
import CsvFileList from './CsvFileList';
import ChooseFolder from '../components/ChoseFolder';
import { useSettings } from '../components/SettingsContext';
import Dashboard from './Dashboard';
import Buttons from '../components/Buttons';
import { ChevronLeft } from 'lucide-react';

function AdsScraperForm({ viewMode = 'scraping' }) {
  const [username, setUsername] = useState('Utente');
  const [folderPath, setFolderPath] = useState(() => localStorage.getItem('googleads_folderPath') || '');
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const statusRef = useRef<HTMLDivElement>(null);
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [currentCsvPath, setCurrentCsvPath] = useState<string>('');
  const { useProxy, customProxy, headless, metaAdsAccessToken, setMetaAdsAccessToken, googleServiceAccountKeyPath, setGoogleServiceAccountKeyPath, googleProjectId, setGoogleProjectId } = useSettings();
  const [adType, setAdType] = useState<'google' | 'meta'>('google');
  // Meta Page ID state, persisted in localStorage
  const [metaPageId, setMetaPageId] = useState(() => localStorage.getItem('metaads_pageId') || '');
  // Local state for advertiser name
  const [advertiser, setAdvertiser] = useState(() => localStorage.getItem('googleads_advertiser') || '');

  // Gestione scelta file Google Service Account (preferisci chooseFile per .json, fallback chooseFolder)
  const handleChooseKeyFile = async () => {
    if (window.electron && window.electron.chooseFile) {
      const filePath = await window.electron.chooseFile({ filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (filePath) setGoogleServiceAccountKeyPath(filePath);
    } else if (window.electron && window.electron.chooseFolder) {
      const path = await window.electron.chooseFolder();
      if (path) setGoogleServiceAccountKeyPath(path);
    }
  };

  // Persist metaPageId to localStorage on change
  useEffect(() => {
    localStorage.setItem('metaads_pageId', metaPageId);
  }, [metaPageId]);

  useEffect(() => {
    localStorage.setItem('googleads_advertiser', advertiser);
  }, [advertiser]);

  useEffect(() => {
    (async () => {
      try {
        if (window.electron && window.electron.getUsername) {
          const name = await window.electron.getUsername();
          setUsername(name);
        }
      } catch (error) {
        setUsername('Utente');
      }
    })();
  }, []);

  useEffect(() => {
    if (!window.electron) return;
    const onStatus = (message: string) => {
      setStatusMessages((prev) => [...prev, message]);
    };
    if (window.electron.onStatus) window.electron.onStatus(onStatus);
    if (window.electron.onResetLogs) window.electron.onResetLogs(() => setStatusMessages([]));
    if (window.electron.onUserActionRequired) {
      window.electron.onUserActionRequired((message: string) => {
        setStatusMessages((prev) => [...prev, `Attenzione: ${message} [CAPTCHA richiesto]`]);
      });
    }
  }, []);

  useEffect(() => {
    if (statusRef.current) {
      statusRef.current.scrollTop = statusRef.current.scrollHeight;
    }
  }, [statusMessages]);

  useEffect(() => {
    if (viewMode === 'dashboard' && window.electron && (window.electron as any).invoke) {
      setLoadingFiles(true);
      (window.electron as any).invoke('list-googleads-csv-files').then((files: string[]) => {
        setCsvFiles(files);
        setLoadingFiles(false);
      });
    }
  }, [viewMode]);

  const handleFolderChange = (path: string) => {
    setFolderPath(path);
    localStorage.setItem('googleads_folderPath', path);
  };

  const handleChooseFolder = async () => {
    if (window.electron && window.electron.chooseFolder) {
      const path = await window.electron.chooseFolder();
      if (path) handleFolderChange(path);
    }
  };

  const handleStartScraping = () => {
    if (window.electron && window.electron.startScraping) {
      if (adType === 'google') {
        window.electron.startScraping(
          advertiser, // local state
          'googleads',
          folderPath,
          headless,
          useProxy,
          customProxy,
          googleServiceAccountKeyPath, // dal context
          googleProjectId // dal context
        );
      } else if (adType === 'meta') {
        window.electron.startScraping(
          metaPageId,
          'metaads',
          folderPath,
          headless,
          useProxy,
          customProxy,
          metaAdsAccessToken
        );
      }
    }
  };

  const handleStopScraping = () => {
    if (window.electron && window.electron.stopScraping) {
      window.electron.stopScraping();
    }
  };

  const handleContinueCaptcha = () => {
    if (window.electron && window.electron.confirmUserAction) {
      window.electron.confirmUserAction();
    }
  };

  const handleViewCsv = async (file: string) => {
    if (window.electron && (window.electron as any).invoke) {
      const data = await (window.electron as any).invoke('read-googleads-csv', file);
      setSelectedPage(data);
      setCurrentCsvPath(file);
    }
  };

  const handleDeleteCsv = async (file: string) => {
    if (window.electron && (window.electron as any).invoke) {
      await (window.electron as any).invoke('delete-googleads-csv-files', [file]);
      setCsvFiles((files) => files.filter((f) => f !== file));
      if (selectedPage && selectedPage.csvPath === file) {
        setSelectedPage(null);
      }
    }
  };

  return (
    <main className="mx-auto p-6">
      {viewMode === 'scraping' && (
        <section className="bg-slate-800 rounded shadow p-6">
          <p className="text-2xl font-bold mb-2">🔍 Ciao {username}</p>
          <h1 className="text-2xl font-bold mb-2">📢 Benvenuto su Meta e Googles Ads Scraper</h1>
           <p className="text-lg mb-4">
            Questo strumento consente, attraverso le api ufficiali di Google Ads Transparency Center e Meta Ad Library di estrapolare
            tutte le campagne attive e passate su Google e su Meta.
          </p>
          <div className="mb-4 flex gap-4">
            <label>
              <input type="radio" checked={adType === 'google'} onChange={() => setAdType('google')} /> Google Ads
            </label>
            <label>
              <input type="radio" checked={adType === 'meta'} onChange={() => setAdType('meta')} /> Meta Ads
            </label>
          </div>
          {adType === 'google' && (
            <>
              <h2 className="text-lg mb-4">
                Avvia la raccolta dati dagli annunci Google Ads Transparency Center. I risultati saranno salvati in CSV.
              </h2>
              <div className="mb-4">
                <label className="block text-sm mb-1" htmlFor="advertiser-input">
                  Nome Inserzionista
                </label>
                <input
                  id="advertiser-input"
                  type="text"
                  className="input w-full px-3 py-2 border rounded text-black"
                  value={advertiser}
                  onChange={(e) => setAdvertiser(e.target.value)}
                  placeholder="Nome inserzionista"
                />
              </div>
              <button className="btn px-4 py-2 bg-yellow-700 hover:bg-yellow-800 text-slate-800 rounded">
              <a href='https://adstransparency.google.com' target='blank'>
                Trova il nome inserzionista Google</a>
              </button>
             
            </>
          )}
          {adType === 'meta' && (
            <>
              <h2 className="text-lg mb-4">
                Avvia la raccolta dati dagli annunci Meta Ad Library. I risultati saranno salvati in CSV.
              </h2>
              <div className="mb-4">
                <label className="block text-sm mb-1" htmlFor="meta-page-id-input">
                  ID Pagina Facebook
                </label>
                <input
                  id="meta-page-id-input"
                  type="text"
                  className="input w-full px-3 py-2 border rounded text-black"
                  value={metaPageId}
                  onChange={(e) => setMetaPageId(e.target.value)}
                  placeholder="ID Pagina Facebook"
                />
              </div>
              <button className="btn px-4 py-2 bg-yellow-700 hover:bg-yellow-800 text-slate-800 rounded">
              <a href='https://www.facebook.com/ads/library' target='blank'>
                Trova l'ID della pagina facebook</a>
              </button>
            </>
          )}
          <ChooseFolder folderPath={folderPath} handleChooseFolder={handleChooseFolder} />
          <Buttons handleStartScraping={handleStartScraping} handleStopScraping={handleStopScraping} />
        </section>
      )}
      {viewMode === 'dashboard' && (
        <section className="bg-slate-700 rounded shadow p-4 mt-6">
          <h2 className="text-xl font-bold mb-2">CSV Google Ads salvati</h2>
          <CsvFileList files={csvFiles} onView={handleViewCsv} onDelete={handleDeleteCsv} loading={loadingFiles} />
        </section>
      )}
      {selectedPage && viewMode === 'dashboard' && (
        <section className="bg-slate-800 rounded shadow p-4 mt-6">
          <Dashboard
            data={Array.isArray(selectedPage) ? selectedPage : [selectedPage]}
            csvPath={currentCsvPath}
            onBack={() => setSelectedPage(null)}
          />
        </section>
      )}
      {viewMode === 'scraping' && (
        <Footer statusRef={statusRef} statusMessages={statusMessages} handleContinueCaptcha={handleContinueCaptcha} />
      )}
    </main>
  );
}

export default AdsScraperForm;
