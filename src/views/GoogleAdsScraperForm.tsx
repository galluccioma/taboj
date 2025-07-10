import React, { useEffect, useState, useRef } from 'react';
import Footer from '../components/Footer';
import CsvFileList from './CsvFileList';
import ChooseFolder from '../components/ChoseFolder';
import { useSettings } from '../components/SettingsContext';
import GoogleAdsDashboard from './GoogleAdsDashboard';
import Buttons from '../components/Buttons';

function GoogleAdsScraperForm({ viewMode = 'scraping' }) {
  const [username, setUsername] = useState('Utente');
  const [folderPath, setFolderPath] = useState(() => localStorage.getItem('googleads_folderPath') || '');
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const statusRef = useRef<HTMLDivElement>(null);
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const { useProxy, customProxy, headless, googleAdsAdvertiser, setGoogleAdsAdvertiser, googleAdsClientId, googleAdsClientSecret, googleAdsRedirectUri, metaAdsAccessToken, setMetaAdsAccessToken } = useSettings();
  const [adType, setAdType] = useState<'google' | 'meta'>('google');
  // Meta Page ID state, persisted in localStorage
  const [metaPageId, setMetaPageId] = useState(() => localStorage.getItem('metaads_pageId') || '');
  // Google Service Account Key File Path, persisted in localStorage
  const [googleKeyFilePath, setGoogleKeyFilePath] = useState(() => localStorage.getItem('googleads_keyFilePath') || '');
  // Local state for advertiser name
  const [advertiser, setAdvertiser] = useState(() => localStorage.getItem('googleads_advertiser') || '');

  const handleChooseKeyFile = async () => {
    if (window.electron && window.electron.chooseFile) {
      const filePath = await window.electron.chooseFile({ filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (filePath) setGoogleKeyFilePath(filePath);
    }
  };

  // Persist metaPageId to localStorage on change
  useEffect(() => {
    localStorage.setItem('metaads_pageId', metaPageId);
  }, [metaPageId]);

  useEffect(() => {
    localStorage.setItem('googleads_keyFilePath', googleKeyFilePath);
  }, [googleKeyFilePath]);
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
          googleKeyFilePath // Only pass the key file path
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
          <h1 className="text-2xl font-bold mb-2">🟦 Meta and Google Ads Scraper</h1>
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
              <h2 className="text-lg mb-4">Avvia la raccolta dati dagli annunci Google Ads Transparency Center. I risultati saranno salvati in CSV.</h2>
              <div className="mb-4">
                <label className="block text-sm mb-1" htmlFor="advertiser-input">Nome Inserzionista</label>
                <input
                  id="advertiser-input"
                  type="text"
                  className="input w-full px-3 py-2 border rounded text-black"
                  value={advertiser}
                  onChange={e => setAdvertiser(e.target.value)}
                  placeholder="Nome inserzionista"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1" htmlFor="google-keyfile-input">Percorso file chiave Google Service Account (JSON)</label>
                <div className="flex items-center gap-2">
                  <input
                    id="google-keyfile-input"
                    type="text"
                    className="input flex-1 px-3 py-2 border rounded text-black"
                    value={googleKeyFilePath}
                    readOnly
                  />
                  <button
                    className="btn px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
                    onClick={handleChooseKeyFile}
                    type="button"
                  >
                    Scegli File
                  </button>
                </div>
              </div>
            </>
          )}
          {adType === 'meta' && (
            <>
              <h2 className="text-lg mb-4">Avvia la raccolta dati dagli annunci Meta Ad Library. I risultati saranno salvati in CSV.</h2>
              <div className="mb-4">
                <label className="block text-sm mb-1" htmlFor="meta-page-id-input">ID Pagina Facebook</label>
                <input
                  id="meta-page-id-input"
                  type="text"
                  className="input w-full px-3 py-2 border rounded text-black"
                  value={metaPageId}
                  onChange={e => setMetaPageId(e.target.value)}
                  placeholder="ID Pagina Facebook"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1" htmlFor="meta-api-key-input">Meta API Key</label>
                <input
                  id="meta-api-key-input"
                  type="text"
                  className="input w-full px-3 py-2 border rounded text-black"
                  value={metaAdsAccessToken}
                  onChange={e => setMetaAdsAccessToken(e.target.value)}
                  placeholder="Meta API Key"
                />
              </div>
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
          <div className="flex justify-between items-center mb-4">
            <button
              className="px-3 py-1 bg-yellow-700 hover:bg-yellow-800 text-white rounded"
              onClick={() => setSelectedPage(null)}
            >
              Torna alla lista
            </button>
            <button
              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
              onClick={() => setShowRaw((r) => !r)}
            >
              {showRaw ? 'Vista Formattata' : 'Vista JSON'}
            </button>
          </div>
          {showRaw ? (
            <pre className="bg-slate-900 text-white p-4 rounded overflow-x-auto">
              {JSON.stringify(selectedPage, null, 2)}
            </pre>
          ) : (
            <GoogleAdsDashboard data={Array.isArray(selectedPage) ? selectedPage : [selectedPage]} />
          )}
        </section>
      )}
      {viewMode === 'scraping' && (
        <Footer statusRef={statusRef} statusMessages={statusMessages} handleContinueCaptcha={handleContinueCaptcha} />
      )}
    </main>
  );
}

export default GoogleAdsScraperForm; 