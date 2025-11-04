import React, { useEffect, useState, useRef } from 'react';
import Footer from '../components/Footer';
import Dashboard from './Dashboard';
import CsvFileList from './CsvFileList';
import ChooseFolder from '../components/ChoseFolder';
import { useSettings } from '../components/SettingsContext';
import Buttons from '../components/Buttons';
import { useScraping } from '../components/ScrapingContext';

function AskScraperForm({ viewMode = 'scraping' }) {
  const [username, setUsername] = useState('Utente');
  const [searchString, setSearchString] = useState(() => localStorage.getItem('ask_searchString') || '');
  const [folderPath, setFolderPath] = useState(() => localStorage.getItem('ask_folderPath') || '');
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const statusRef = useRef<HTMLDivElement>(null);
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [backupPages, setBackupPages] = useState<any[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [currentCsvPath, setCurrentCsvPath] = useState<string>('');
  const [maxToProcess, setMaxToProcess] = useState(() => {
    const val = localStorage.getItem('ask_maxToProcess');
    return val ? Number(val) : 50;
  });
  const [scrapeTypes, setScrapeTypes] = useState(() => {
    const saved = localStorage.getItem('ask_scrapeTypes');
    // Remove 'serp' if present in saved state
    let initial = saved ? JSON.parse(saved) : ['ask'];
    initial = initial.filter((t: string) => t !== 'serp');
    return initial;
  });
  const { useProxy, customProxy, headless } = useSettings();
  const { scraping, setScraping } = useScraping();

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
      // Stop scraping on completion/interruption or CSV saved
      if (
        message.includes('[✅] Dati salvati con successo.') ||
        message.includes('[💾] Dati salvati dopo interruzione.') ||
        message.includes("[STOP] Scraping interrotto dall'utente.") ||
        message.includes('[+] Record salvati nel file CSV')
      ) {
        setScraping(false);
      }
    };
    if (window.electron.onStatus) window.electron.onStatus(onStatus);
    if (window.electron.onResetLogs) window.electron.onResetLogs(() => setStatusMessages([]));
    if (window.electron.onUserActionRequired) {
      window.electron.onUserActionRequired((message: string) => {
        setStatusMessages((prev) => [...prev, `Attenzione: ${message} [CAPTCHA richiesto]`]);
      });
    }
  }, [setScraping]);

  useEffect(() => {
    if (statusRef.current) {
      statusRef.current.scrollTop = statusRef.current.scrollHeight;
    }
  }, [statusMessages]);

  useEffect(() => {
    if (viewMode === 'dashboard' && window.electron && (window.electron as any).invoke) {
      setLoadingFiles(true);
      (window.electron as any).invoke('list-faq-csv-files').then((files: string[]) => {
        setCsvFiles(files);
        setLoadingFiles(false);
      });
    }
  }, [viewMode]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchString(e.target.value);
    localStorage.setItem('ask_searchString', e.target.value);
  };
  const handleFolderChange = (path: string) => {
    setFolderPath(path);
    localStorage.setItem('ask_folderPath', path);
  };
  const handleMaxToProcessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, Math.min(100, Number(e.target.value)));
    setMaxToProcess(value);
    localStorage.setItem('ask_maxToProcess', value.toString());
  };

  const handleScrapeTypeChange = (type: string) => {
    setScrapeTypes((prev: string[]) => {
      let updated;
      if (prev.includes(type)) {
        updated = prev.filter((t) => t !== type);
      } else {
        updated = [...prev, type];
      }
      localStorage.setItem('ask_scrapeTypes', JSON.stringify(updated));
      return updated;
    });
  };

  const handleChooseFolder = async () => {
    if (window.electron && window.electron.chooseFolder) {
      const path = await window.electron.chooseFolder();
      if (path) handleFolderChange(path);
    }
  };

  const handleStartScraping = () => {
    if (!searchString) {
      window.alert('Compila il campo di ricerca.');
      return;
    }
    if (scrapeTypes.length === 0) {
      window.alert('Seleziona almeno un tipo di scraping.');
      return;
    }
    if (window.electron && window.electron.startScraping) {
      setScraping(true);
      window.electron.startScraping(
        searchString,
        'faq',
        folderPath,
        headless,
        scrapeTypes,
        useProxy,
        customProxy,
        maxToProcess,
        undefined,
        undefined
      );
    }
  };

  const handleStopScraping = () => {
    if (window.electron && window.electron.stopScraping) {
      window.electron.stopScraping();
      setScraping(false);
    }
  };

  const handleContinueCaptcha = () => {
    if (window.electron && window.electron.confirmUserAction) {
      window.electron.confirmUserAction();
    }
  };

  const handleViewCsv = async (file: string) => {
    if (window.electron && (window.electron as any).invoke) {
      const data = await (window.electron as any).invoke('read-faq-csv', file);
      setBackupPages(data);
      setSelectedPage(data);
      setCurrentCsvPath(file);
    }
  };

  const handleDeleteCsv = async (file: string) => {
    if (window.electron && (window.electron as any).invoke) {
      await (window.electron as any).invoke('delete-faq-csv-files', [file]);
      setCsvFiles((files) => files.filter((f) => f !== file));
      if (selectedPage && selectedPage.csvPath === file) {
        setSelectedPage(null);
        setBackupPages([]);
      }
    }
  };

  return (
    <main className=" mx-auto p-6">
      {viewMode === 'scraping' && (
        <section className="bg-slate-800 rounded shadow p-6">
          <p className="text-2xl font-bold mb-2">🔍 Ciao {username}</p>
          <h1 className="text-2xl font-bold mb-2">💬 Benvenuto su FAQ & Correlati Scraper</h1>
          <p className="text-lg mb-4">
            Questo strumento permette di cercare e scaricare domande frequenti (FAQ) o Ricerche Correlate dalla SERP di
            Google
          </p>
          <input
            type="text"
            className="input w-full mb-2 px-3 py-2 border rounded text-black"
            placeholder="Inserisci le query di ricerca separate da virgola"
            value={searchString}
            onChange={handleSearchChange}
            disabled={scraping}
          />
          <div className="mb-2 flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={scrapeTypes.includes('ask')}
                onChange={() => handleScrapeTypeChange('ask')}
                disabled={scraping}
              />
              Ask (FAQ)
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={scrapeTypes.includes('ricerche_correlate')}
                onChange={() => handleScrapeTypeChange('ricerche_correlate')}
                disabled={scraping}
              />
              Ricerche correlate
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={scrapeTypes.includes('geo_link')}
                onChange={() => handleScrapeTypeChange('geo_link')}
                disabled={scraping}
              />
              AI Overwiew Links
            </label>
          </div>
          <div className="mb-2">
            <label className="block text-sm mb-1" htmlFor="maxToProcess">
              Numero massimo di domande da processare per query (1-100):
            </label>
            <input
              id="maxToProcess"
              type="number"
              min={1}
              max={100}
              value={maxToProcess}
              onChange={handleMaxToProcessChange}
              className="input w-32 px-2 py-1 border rounded text-black"
              disabled={scraping}
            />
          </div>
          <ChooseFolder folderPath={folderPath} handleChooseFolder={handleChooseFolder} />
          {/* Proxy and headless controls removed, now set in SettingsPage */}
          <Buttons handleStartScraping={handleStartScraping} handleStopScraping={handleStopScraping} />
        </section>
      )}
      {viewMode === 'dashboard' && (
        <section className="bg-slate-700 rounded shadow p-4 mt-6">
          <h2 className="text-xl font-bold mb-2">CSV salvati</h2>
          <CsvFileList files={csvFiles} onView={handleViewCsv} onDelete={handleDeleteCsv} loading={loadingFiles} />
        </section>
      )}
      {selectedPage && viewMode === 'dashboard' && (
        <section className="max-w-6xl bg-slate-800 rounded shadow p-4 mt-6">
          <Dashboard data={selectedPage} csvPath={currentCsvPath} onBack={() => setSelectedPage(null)} />
        </section>
      )}
      {viewMode === 'scraping' && (
        <Footer statusRef={statusRef} statusMessages={statusMessages} handleContinueCaptcha={handleContinueCaptcha} />
      )}
    </main>
  );
}

export default AskScraperForm;
