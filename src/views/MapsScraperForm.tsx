import React, { useEffect, useState, useRef } from 'react';
import Footer from '../components/Footer';
import Dashboard from './Dashboard';
import CsvFileList from './CsvFileList';
import ChooseFolder from '../components/ChoseFolder';
import { useSettings } from '../components/SettingsContext';
import Buttons from '../components/Buttons';
import ProgressBar from '../components/ProgressBar';

interface MapsScraperFormProps {
  viewMode?: 'scraping' | 'dashboard';
}

function MapsScraperForm({ viewMode = 'scraping' }: MapsScraperFormProps) {
  const [username, setUsername] = useState('Utente');
  const [searchString, setSearchString] = useState(() => localStorage.getItem('maps_searchString') || '');
  const [folderPath, setFolderPath] = useState(() => localStorage.getItem('maps_folderPath') || '');
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const statusRef = useRef<HTMLDivElement>(null);
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [currentCsvPath, setCurrentCsvPath] = useState<string>('');
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const { useProxy, customProxy, headless } = useSettings();

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
      // Estrai il totale stimato dai risultati
      const totalMatch = message.match(/📊 Risultati totali stimati: (\d+)/);
      if (totalMatch) {
        setProgress((prev) => ({ ...prev, total: parseInt(totalMatch[1], 10) }));
      }
      // Estrai progresso da messaggi tipo: '[+] (current/total) ...'
      const match = message.match(/\[\+\] \((\d+)[/](\d+)\)/);
      if (match) {
        setProgress((prev) => ({ ...prev, current: parseInt(match[1], 10) }));
      }
      // Reset progress a fine scraping
      if (
        message.includes('[✅] Dati salvati con successo.') ||
        message.includes('[💾] Dati salvati dopo interruzione.') ||
        message.includes('[STOP] Scraping interrotto dall\'utente.')
      ) {
        setProgress({ current: 0, total: 0 });
      }
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
      (window.electron as any).invoke('list-maps-csv-files').then((files: string[]) => {
        setCsvFiles(files);
        setLoadingFiles(false);
      });
    }
  }, [viewMode]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchString(e.target.value);
    localStorage.setItem('maps_searchString', e.target.value);
  };
  const handleFolderChange = (path: string) => {
    setFolderPath(path);
    localStorage.setItem('maps_folderPath', path);
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
    if (window.electron && window.electron.startScraping) {
      window.electron.startScraping(
        searchString,
        'maps',
        folderPath,
        headless,
        [],
        false,
        false,
        false,
        useProxy,
        customProxy
      );
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
      const data = await (window.electron as any).invoke('read-maps-csv', file);
      setSelectedPage(data);
      setCurrentCsvPath(file);
    }
  };

  const handleDeleteCsv = async (file: string) => {
    if (window.electron && (window.electron as any).invoke) {
      await (window.electron as any).invoke('delete-maps-csv-files', [file]);
      setCsvFiles((files) => files.filter((f) => f !== file));
      if (selectedPage && selectedPage.csvPath === file) {
        setSelectedPage(null);
      }
    }
  };

  return (
    <main className=" mx-auto p-6">
      {viewMode === 'scraping' && (
        <section className="bg-slate-800 rounded shadow p-6">
          <p className="text-2xl font-bold mb-2">🔍 Ciao {username}</p>
          <h1 className="text-2xl font-bold mb-2">🗺️ Benvenuto su Maps Lead Scraper</h1>
          <p className="text-lg mb-4">
            Questo strumento consente di cercare e scaricare dati dei Lead da Google Maps. 
          </p>
          {/* Barra di progresso */}
          {progress.total > 0 && (
            <ProgressBar current={progress.current} total={progress.total} />
          )}
          <input
            type="text"
            className="input w-full mb-2 px-3 py-2 border rounded text-black"
            placeholder="Inserisci le query di ricerca separate da virgola"
            value={searchString}
            onChange={handleSearchChange}
          />
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
        <section className="bg-slate-800 rounded shadow p-4 mt-6">
          <Dashboard
            data={selectedPage}
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

export default MapsScraperForm;
