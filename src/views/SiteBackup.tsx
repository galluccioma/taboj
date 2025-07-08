import React, { useEffect, useState, useRef } from 'react';
import Footer from '../components/Footer';
import SiteBackupDashboard from './SiteBackupDashboard';
import ChooseFolder from '../components/ChoseFolder';
import { useSettings } from '../components/SettingsContext';

interface SiteBackupProps {
  viewMode?: 'scraping' | 'dashboard';
}

function BackupFolderList({ folders, onView, onDelete, onOpen, loading }: any) {
  if (loading) return <div>Caricamento cartelle...</div>;
  return (
    <ul className="divide-y divide-slate-600">
      {folders.map((folder: any) => {
        const globalCsv = folder.files.find((f: string) => f.endsWith('+seo_backup.csv'));
        if (!globalCsv) return null;
        return (
          <li key={folder.folder} className="py-2 flex items-center justify-between">
            <span className="truncate max-w-xs font-semibold">{folder.folder}</span>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-400"
                onClick={() => onView(`${folder.folderPath}/${globalCsv}`)}
              >
                Vedi
              </button>
              <button
                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-400"
                onClick={() => onOpen(folder.folderPath)}
              >
                Apri cartella
              </button>
              <button
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-400"
                onClick={() => onDelete(folder.folderPath)}
              >
                Elimina cartella
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SiteBackup({ viewMode = 'scraping' }: SiteBackupProps) {
  const [username, setUsername] = useState('Utente');
  const [searchString, setSearchString] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [fullBackup, setFullBackup] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const [backupPages, setBackupPages] = useState<any[]>([]);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [backupFolders, setBackupFolders] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
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
    if (window.electron && window.electron.on) {
      window.electron.on('backup-data', (data: any[]) => {
        setBackupPages(data);
        setSelectedPage(null);
      });
    }
  }, []);

  useEffect(() => {
    if (statusRef.current) {
      statusRef.current.scrollTop = statusRef.current.scrollHeight;
    }
  }, [statusMessages]);

  useEffect(() => {
    if (viewMode === 'dashboard' && window.electron && window.electron.invoke) {
      setLoadingFiles(true);
      window.electron.invoke('list-backup-folders').then((folders: any[]) => {
        setBackupFolders(folders);
        setLoadingFiles(false);
      });
    }
  }, [viewMode]);

  const handleChooseFolder = async () => {
    if (window.electron && window.electron.chooseFolder) {
      const path = await window.electron.chooseFolder();
      if (path) setFolderPath(path);
    }
  };

  const handleStartScraping = () => {
    if (!searchString) {
      window.alert('Compila il campo URL o sitemap.');
      return;
    }
    if (window.electron && window.electron.startBackupScraping) {
      window.electron.startBackupScraping(
        searchString,
        folderPath,
        headless,
        useProxy,
        customProxy,
        fullBackup
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
    if (window.electron && window.electron.invoke) {
      const data = await window.electron.invoke('read-backup-csv', file);
      setBackupPages([data]);
      setSelectedPage(data);
    }
  };

  const handleDeleteCsv = async (file: string) => {
    if (window.electron && window.electron.invoke) {
      await window.electron.invoke('delete-backup-files', [file]);
      setBackupFolders(folders => folders.map(f => f.folder === folder.folder ? { ...f, files: f.files.filter((fName: string) => fName !== file) } : f));
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
            Questo strumento consente di effettuare il backup di siti web o sitemap, salvando i dati in formato CSV e screenshot delle pagine. Inserisci l'URL o la sitemap, scegli la cartella di destinazione, configura le opzioni di backup, proxy e modalità bot, quindi avvia o interrompi la raccolta dati.
          </h2>
          <input
            type="text"
            className="input w-full mb-2 px-3 py-2 border rounded text-black"
            placeholder="Url della sitemap o delle pagine separati da virgola"
            value={searchString}
            onChange={(e) => setSearchString(e.target.value)}
          />
           <ChooseFolder folderPath={folderPath} handleChooseFolder={handleChooseFolder} />
          {/* Proxy and headless controls removed, now set in SettingsPage */}
          <div className="mb-2">
            <label htmlFor="fullBackupCheckbox" className="ml-2 text-zinc-200">
              <input
                type="checkbox"
                id="fullBackupCheckbox"
                checked={fullBackup}
                onChange={e => setFullBackup(e.target.checked)}
                className="mr-2"
              />
              Backup completo (tutti i CSV e screenshot per pagina)
            </label>
          </div>
          <div className="flex mb-4 space-x-2">
            <button
              className="btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-400"
              onClick={handleStartScraping}
            >
              Scarica i dati ora 📑
            </button>
            <button
              className="btn btn-stop px-4 py-2 bg-red-500 text-white rounded hover:bg-red-400"
              onClick={handleStopScraping}
            >
              Stop
            </button>
          </div>
        </section>
      )}
      {viewMode === 'dashboard' && (
        <section className="bg-slate-700 rounded shadow p-4 mt-6">
          <h2 className="text-xl font-bold mb-2">Backup salvati</h2>
          <BackupFolderList
            folders={backupFolders}
            loading={loadingFiles}
            onView={handleViewCsv}
            onDelete={async (folderPath: string) => {
              if (window.electron && window.electron.invoke) {
                await window.electron.invoke('delete-backup-folder', folderPath);
                setBackupFolders(folders => folders.filter(f => f.folderPath !== folderPath));
              }
            }}
            onOpen={async (folderPath: string) => {
              if (window.electron && window.electron.invoke) {
                await window.electron.invoke('open-backup-folder', folderPath);
              }
            }}
          />
        </section>
      )}
      {selectedPage && viewMode === 'dashboard' && (
        <section className="bg-slate-800 rounded shadow p-4 mt-6">
          <div className="flex justify-between items-center mb-4">
            <button
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-400"
              onClick={() => setSelectedPage(null)}
            >
              Torna alla lista
            </button>
            <button
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-400"
              onClick={() => setShowRaw(r => !r)}
            >
              {showRaw ? 'Vista Formattata' : 'Vista JSON'}
            </button>
          </div>
          {showRaw ? (
            <pre className="bg-slate-900 text-white p-4 rounded overflow-x-auto">{JSON.stringify(selectedPage, null, 2)}</pre>
          ) : (
            <SiteBackupDashboard data={selectedPage} />
          )}
        </section>
      )}
      {viewMode === 'scraping' && (
        <Footer statusRef={statusRef} statusMessages={statusMessages} handleContinueCaptcha={handleContinueCaptcha} />
      )}
    </main>
  );
}

export default SiteBackup;
