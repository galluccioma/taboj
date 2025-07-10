import React, { useEffect, useState, useRef } from 'react';
import Footer from '../components/Footer';
import MapsDashboard from './MapsDashboard';
import CsvFileList from './CsvFileList';
import ChooseFolder from '../components/ChoseFolder';
import { useSettings } from '../components/SettingsContext';
import Buttons from '../components/Buttons';

function MapsScraperForm({ viewMode = 'scraping' }) {
  const [username, setUsername] = useState('Utente');
  const [searchString, setSearchString] = useState(() => localStorage.getItem('maps_searchString') || '');
  const [folderPath, setFolderPath] = useState(() => localStorage.getItem('maps_folderPath') || '');
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const statusRef = useRef<HTMLDivElement>(null);
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [backupPages, setBackupPages] = useState<any[]>([]);
  const [showRaw, setShowRaw] = useState(false);
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
      setBackupPages(data);
      setSelectedPage(data);
    }
  };

  const handleDeleteCsv = async (file: string) => {
    if (window.electron && (window.electron as any).invoke) {
      await (window.electron as any).invoke('delete-maps-csv-files', [file]);
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
          <h1 className="text-2xl font-bold mb-2">🔍 Ciao {username}</h1>
          <h2 className="text-lg mb-4">
            Questo strumento consente di cercare e scaricare dati da Google Maps in formato CSV. Inserisci le query di
            ricerca, scegli la cartella di destinazione, configura l'uso di proxy e modalità bot, quindi avvia o
            interrompi la raccolta dati.
          </h2>
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
          <div className="flex justify-between items-center mb-4">
            <button
              className="px-3 py-1 bg-yellow-700 hover:bg-yellow-800 text-white rounded bg-yellow-700 hover:bg-yellow-800"
              onClick={() => setSelectedPage(null)}
            >
              Torna alla lista
            </button>
            <button
              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded "
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
            <MapsDashboard data={selectedPage} />
          )}
        </section>
      )}
      {viewMode === 'scraping' && (
        <Footer statusRef={statusRef} statusMessages={statusMessages} handleContinueCaptcha={handleContinueCaptcha} />
      )}
    </main>
  );
}

export default MapsScraperForm;
