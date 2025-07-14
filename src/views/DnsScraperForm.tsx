import React, { useEffect, useState, useRef } from 'react';
import Footer from '../components/Footer';
import Dashboard from './Dashboard';
import CsvFileList from './CsvFileList';
import ChooseFolder from '../components/ChoseFolder';
import { useSettings } from '../components/SettingsContext';
import Buttons from '../components/Buttons';
import { useScraping } from '../components/ScrapingContext';

function DnsScraperForm({ viewMode = 'scraping' }) {
  const [username, setUsername] = useState('Utente');
  const [searchString, setSearchString] = useState(() => localStorage.getItem('dns_searchString') || '');
  const [folderPath, setFolderPath] = useState(() => localStorage.getItem('dns_folderPath') || '');
  const [dnsRecordTypes, setDnsRecordTypes] = useState<string[]>(['A', 'NS', 'MX', 'TXT', 'CNAME', 'AAAA']);
  const [doAMail, setDoAMail] = useState(true);
  const [doLighthouse, setDoLighthouse] = useState(false);
  const [doWayback, setDoWayback] = useState(false);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const statusRef = useRef<HTMLDivElement>(null);
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [backupPages, setBackupPages] = useState<any[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [currentCsvPath, setCurrentCsvPath] = useState<string>('');
  const { useProxy, customProxy, headless } = useSettings();
  const { scraping, setScraping } = useScraping();

  const dnsTypes = ['A', 'NS', 'MX', 'TXT', 'CNAME', 'AAAA'];

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
        message.includes('[+] Record salvati nel file CSV') ||
        message.includes('[log] CSV DNS salvato:')
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
      (window.electron as any).invoke('list-dns-csv-files').then((files: string[]) => {
        setCsvFiles(files);
        setLoadingFiles(false);
      });
    }
  }, [viewMode]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchString(e.target.value);
    localStorage.setItem('dns_searchString', e.target.value);
  };
  const handleFolderChange = (path: string) => {
    setFolderPath(path);
    localStorage.setItem('dns_folderPath', path);
  };

  const handleChooseFolder = async () => {
    if (window.electron && window.electron.chooseFolder) {
      const path = await window.electron.chooseFolder();
      if (path) handleFolderChange(path);
    }
  };

  const handleDnsTypeChange = (type: string) => {
    setDnsRecordTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const handleAMailChange = (checked: boolean) => {
    setDoAMail(checked);
  };

  const handleStartScraping = () => {
    if (!searchString) {
      window.alert('Compila il campo domini.');
      return;
    }
    if (dnsRecordTypes.length === 0 && !doAMail) {
      window.alert('Seleziona almeno un tipo di record DNS.');
      return;
    }
    if (window.electron && window.electron.startScraping) {
      setScraping(true);
      window.electron.startScraping(
        searchString,
        'dns',
        folderPath,
        headless,
        dnsRecordTypes, // dnsRecordTypes
        doAMail,
        doLighthouse,
        doWayback,
        useProxy,
        customProxy
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
      const data = await (window.electron as any).invoke('read-dns-csv', file);
      setBackupPages([data]);
      setSelectedPage(data);
      setCurrentCsvPath(file);
    }
  };

  const handleDeleteCsv = async (file: string) => {
    if (window.electron && (window.electron as any).invoke) {
      await (window.electron as any).invoke('delete-dns-csv-files', [file]);
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
          <h1 className="text-2xl font-bold mb-2">🌐 Benvenuto su Bulk Domain Scraper</h1>
          <p className="text-lg mb-4">
            Questo strumento consente di analizzare domini e ottenere record DNS (A, NS, MX, TXT, CNAME, AAAA),
            effettuare audit Lighthouse, consultare la Wayback Machine e consultare la risposta HTTP (eventuali errori) e lo stato del certificato SSL. 
            Inserisci i domini, seleziona i record e le impostazioni che ti interessano e le
            opzioni desiderate
          </p>
          <input
            type="text"
            className="input w-full mb-2 px-3 py-2 border rounded text-black"
            placeholder="Inserisci i domini separati da virgola (non includere https://)"
            value={searchString}
            onChange={handleSearchChange}
            disabled={scraping}
          />
          <div className="mb-4 space-y-2">
            <div>
              {dnsTypes.map((type) => (
                <label key={type} className="mr-2" htmlFor={`dns-type-${type}`}>
                  <input
                    type="checkbox"
                    className="dns-record-type mr-1"
                    value={type}
                    id={`dns-type-${type}`}
                    checked={dnsRecordTypes.includes(type)}
                    onChange={() => handleDnsTypeChange(type)}
                    disabled={scraping}
                  />
                  {type}
                </label>
              ))}
              <label className="ml-2 text-zinc-600" htmlFor="aMailCheckbox">
                <input
                  type="checkbox"
                  id="aMailCheckbox"
                  checked={doAMail}
                  onChange={(e) => handleAMailChange(e.target.checked)}
                  disabled={scraping}
                />{' '}
                A (mail.dominio)
              </label>
            </div>

            <div className="mt-2 space-x-4">
              <label className="text-zinc-200" htmlFor="lighthouseCheckbox">
                <input
                  type="checkbox"
                  id="lighthouseCheckbox"
                  checked={doLighthouse}
                  onChange={(e) => setDoLighthouse(e.target.checked)}
                  disabled={scraping}
                />{' '}
                Lighthouse Audit 🌐
              </label>
              <label className="text-zinc-200" htmlFor="waybackCheckbox">
                <input
                  type="checkbox"
                  id="waybackCheckbox"
                  checked={doWayback}
                  onChange={(e) => setDoWayback(e.target.checked)}
                  disabled={scraping}
                />{' '}
                Wayback Machine 🕰️
              </label>
            </div>
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
        <section className="bg-slate-800 rounded shadow p-4 mt-6">
          <Dashboard
            data={selectedPage}
            csvPath={currentCsvPath}
            onBack={() => setSelectedPage(null)}
            quickActions={[
              { label: 'Trova domini con errori', prompt: 'Quali domini presentano errori DNS?' },
              { label: 'Riepilogo DNS', prompt: 'Fornisci un riepilogo dei record DNS.' }
            ]}
          />
        </section>
      )}
      {viewMode === 'scraping' && (
        <Footer statusRef={statusRef} statusMessages={statusMessages} handleContinueCaptcha={handleContinueCaptcha} />
      )}
    </main>
  );
}

export default DnsScraperForm;
