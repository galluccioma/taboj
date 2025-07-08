import React, { useEffect, useState } from 'react';
import { useSettings } from '../components/SettingsContext';

interface SettingsPageProps {
  onBack?: () => void;
}

function SettingsPage({ onBack }: SettingsPageProps) {
  const [outputFolder, setOutputFolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { useProxy, setUseProxy, customProxy, setCustomProxy, headless, setHeadless } = useSettings();

  useEffect(() => {
    // Fetch current output folder from backend
    (async () => {
      setError('');
      try {
        if (window.electron && (window.electron as any).invoke) {
          const folder = await (window.electron as any).invoke('get-base-output-folder');
          setOutputFolder(folder || '');
        }
      } catch (e) {
        setError('Errore nel recupero della cartella.');
      }
    })();
  }, []);

  const handleChooseFolder = async () => {
    setError('');
    try {
      if (window.electron && (window.electron as any).invoke) {
        const folder = await (window.electron as any).invoke('choose-folder');
        if (folder) setOutputFolder(folder);
      }
    } catch (e) {
      setError('Errore nella selezione della cartella.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (window.electron && (window.electron as any).invoke) {
        await (window.electron as any).invoke('set-base-output-folder', outputFolder);
      }
    } catch (e) {
      setError('Errore nel salvataggio della cartella.');
    }
    setSaving(false);
  };

  return (
    <div className=" mx-auto p-8 mt-8 bg-slate-800 rounded shadow text-white">
      {onBack && (
        <button
          className="mb-4 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-400"
          onClick={onBack}
        >
          Indietro
        </button>
      )}
      <h2 className="text-2xl font-bold mb-4">Impostazioni</h2>
      <div className="mb-4">
        <span className="block mb-2 font-semibold">Cartella base per l&apos;output dei dati:</span>
        <div className="flex items-center gap-2">
          <input
            id="outputFolderInput"
            type="text"
            aria-label="Cartella base per l'output dei dati"
            className="input flex-1 px-3 py-2 border rounded text-black"
            value={outputFolder}
            readOnly
          />
          <button
            className="btn px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-400"
            onClick={handleChooseFolder}
            type="button"
          >
            Scegli Cartella
          </button>
        </div>
      </div>
      {/* Proxy settings */}
      <div className="mb-4">
        <span className="block mb-2 font-semibold">Proxy</span>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="useProxyCheckbox"
            checked={useProxy}
            onChange={e => setUseProxy(e.target.checked)}
            className="mr-2"
          />
          <span>Abilita proxy</span>
        </div>
        {useProxy && (
          <input
            type="text"
            id="customProxyInput"
            className="input w-full px-3 py-2 border rounded text-black"
            placeholder="Proxy personalizzato (es: http://ip:porta)"
            value={customProxy}
            onChange={e => setCustomProxy(e.target.value)}
          />
        )}
      </div>
      {/* Headless mode */}
      <div className="mb-4">
        <span className="block mb-2 font-semibold">Modalit&agrave; bot</span>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="headlessCheckbox"
            checked={headless}
            onChange={e => setHeadless(e.target.checked)}
            className="mr-2"
          />
          <span>Rimuovi la spunta solo in caso di problemi [modalit&agrave; bot]</span>
        </div>
      </div>
      <button
        className="btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-400"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Salvataggio...' : 'Salva'}
      </button>
      {error && <div className="text-red-400 mt-4">{error}</div>}
    </div>
  );
}

export default SettingsPage; 