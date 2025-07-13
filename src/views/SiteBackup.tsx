import { ChevronLeft } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import Footer from '../components/Footer';
import SiteBackupDashboard from './SiteBackupDashboard';
import ChooseFolder from '../components/ChoseFolder';
import { useSettings } from '../components/SettingsContext';
import Buttons from '../components/Buttons';
import { useScraping } from '../components/ScrapingContext';

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
                className="px-3 py-1 hover:bg-slate-800 text-white rounded"
                onClick={() => onOpen(folder.folderPath)}
              >
                Apri cartella
              </button>
              <button
                className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded "
                onClick={() => onView(`${folder.folderPath}/${globalCsv}`)}
              >
                Vedi
              </button>
              <button
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
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
  const [searchString, setSearchString] = useState(() => localStorage.getItem('backup_searchString') || '');
  const [folderPath, setFolderPath] = useState(() => localStorage.getItem('backup_folderPath') || '');
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [fullBackup, setFullBackup] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  // const [backupPages, setBackupPages] = useState<any[]>([]); // Removed unused state
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [backupFolders, setBackupFolders] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [downloadMedia, setDownloadMedia] = useState(false);
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
        message.includes('[STOP] Scraping interrotto dall\'utente.') ||
        message.includes('🧾 CSV globale salvato:') ||
        message.includes('📄 CSV salvato:')
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
    if (window.electron && window.electron.on) {
      window.electron.on('backup-data', () => {
        // setBackupPages(data); // Removed unused state
        setSelectedPage(null);
      });
    }
  }, [setScraping]);

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchString(e.target.value);
    localStorage.setItem('backup_searchString', e.target.value);
  };
  const handleFolderChange = (path: string) => {
    setFolderPath(path);
    localStorage.setItem('backup_folderPath', path);
  };

  const handleChooseFolder = async () => {
    if (window.electron && window.electron.chooseFolder) {
      const path = await window.electron.chooseFolder();
      if (path) handleFolderChange(path);
    }
  };

  const handleStartScraping = () => {
    if (!searchString) {
      window.alert('Compila il campo URL o sitemap.');
      return;
    }
    if (window.electron && window.electron.startBackupScraping) {
      setScraping(true);
      window.electron.startBackupScraping(
        searchString,
        folderPath,
        headless,
        useProxy,
        customProxy,
        fullBackup,
        downloadMedia
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
    if (window.electron && window.electron.invoke) {
      const data = await window.electron.invoke('read-backup-csv', file);
      // setBackupPages([data]); // Removed unused state
      setSelectedPage(data);
    }
  };

  return (
    <main className=" mx-auto p-6">
      {viewMode === 'scraping' && (
        <section className="bg-slate-800 rounded shadow p-6">
          <p className="text-2xl font-bold mb-2">🔍 Ciao {username}</p>
          <h1 className="text-2xl font-bold mb-2">💾 Benvenuto su SEO Backup</h1>
          <p className="text-lg mb-4">
            Questo strumento consente di effettuare un backup della SEO e visivo di siti web o singole pagine.
            É possibile inserire l&apos;url di una pagina, di più pagine separate da virgola o di un&apos;intera sitemap, il sistema scaricherà (se selezionati):
            <li>- un csv riepilogativo del contenuto seo e testuale dell&apos;intero sito o delle pagine selezionate.</li>
           <li> - un csv per ogni pagina analizzata</li>
           <li> - uno screenshot per la versione desktop e uno per la versione mobile di ogni pagina analizzata.</li>
          </p>
          <input
            type="text"
            className="input w-full mb-2 px-3 py-2 border rounded text-black"
            placeholder="Url della sitemap o delle pagine separati da virgola"
            value={searchString}
            onChange={handleSearchChange}
            disabled={scraping}
          />
          <ChooseFolder folderPath={folderPath} handleChooseFolder={handleChooseFolder} />
          {/* Proxy and headless controls removed, now set in SettingsPage */}
          <div className="mb-2">
            <label htmlFor="fullBackupCheckbox" className="ml-2 text-zinc-200">
              <input
                type="checkbox"
                id="fullBackupCheckbox"
                checked={fullBackup}
                onChange={(e) => setFullBackup(e.target.checked)}
                className="mr-2"
                disabled={scraping}
              />
              Scarica gli screeshot delle pagine e i CSV singoli
            </label>
          </div>
          <div className="mb-2">
            <label htmlFor="downloadMediaCheckbox" className="ml-2 text-zinc-200">
              <input
                type="checkbox"
                id="downloadMediaCheckbox"
                checked={downloadMedia}
                onChange={(e) => setDownloadMedia(e.target.checked)}
                className="mr-2"
                disabled={scraping}
              />
              Scarica tutti i media (immagini, video)
            </label>
          </div>
          <Buttons handleStartScraping={handleStartScraping} handleStopScraping={handleStopScraping} />
        </section>
      )}
      {viewMode === 'dashboard' && (
        <section className="bg-slate-700 rounded shadow p-4 mt-6">
          <h2 className="text-xl font-bold mb-2">Backup salvati</h2>
          <BackupFolderList
            folders={backupFolders}
            loading={loadingFiles}
            onView={handleViewCsv}
            onDelete={async (folderPathToDelete: string) => {
              if (window.electron && window.electron.invoke) {
                await window.electron.invoke('delete-backup-folder', folderPathToDelete);
                setBackupFolders((folders) => folders.filter((f) => f.folderPath !== folderPathToDelete));
              }
            }}
            onOpen={async (folderPathToOpen: string) => {
              if (window.electron && window.electron.invoke) {
                await window.electron.invoke('open-backup-folder', folderPathToOpen);
              }
            }}
          />
        </section>
      )}
      {selectedPage && viewMode === 'dashboard' && (
        <div>
          <div className="flex justify-between items-center mb-4">
          <button
              className="flex px-3 py-1 hover:bg-slate-900 text-white rounded"
              onClick={() => setSelectedPage(null)}
            >
              <ChevronLeft/>
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
            <pre className="break-words whitespace-pre-wrap bg-slate-900 text-white p-4 rounded overflow-x-auto">
              {JSON.stringify(selectedPage, null, 2)}
            </pre>
          ) : (
            <SiteBackupDashboard data={selectedPage} />
          )}
        </div>
      )}
      {viewMode === 'scraping' && (
        <Footer statusRef={statusRef} statusMessages={statusMessages} handleContinueCaptcha={handleContinueCaptcha} />
      )}
    </main>
  );
}

export default SiteBackup;
