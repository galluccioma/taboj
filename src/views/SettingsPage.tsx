import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useSettings } from '../components/SettingsContext';

interface SettingsPageProps {
  onBack?: () => void;
}

function SettingsPage({ onBack }: SettingsPageProps) {
  const [outputFolder, setOutputFolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aiToken, setAiToken] = useState('');
  const [aiModel, setAiModel] = useState('meta-llama/Llama-3.2-3B-Instruct');
  const { googleServiceAccountKeyPath, setGoogleServiceAccountKeyPath, googleProjectId, setGoogleProjectId } =
    useSettings();
  const { metaAdsAccessToken, setMetaAdsAccessToken } = useSettings();

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
    // Carica AI settings da localStorage
    setAiToken(localStorage.getItem('aiToken') || '');
    setAiModel(localStorage.getItem('aiModel') || 'meta-llama/Llama-3.2-3B-Instruct');
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
      // Salva AI settings e chiavi in localStorage
      localStorage.setItem('aiToken', aiToken);
      localStorage.setItem('aiModel', aiModel);
      // Salva anche su app_settings.json tramite IPC
      if (window.electron && (window.electron as any).invoke) {
        try {
          await (window.electron as any).invoke('save-app-settings', {
            aiToken,
            aiModel
            // puoi aggiungere qui altre impostazioni se vuoi
          });
        } catch (e) {
          // Se fallisce, fallback su localStorage (già fatto sopra)
          console.warn('Salvataggio su file fallito, fallback su localStorage', e);
        }
      }
    } catch (e) {
      setError('Errore nel salvataggio della cartella.');
    }
    setSaving(false);
    alert('Cartella aggiornata con successo');
  };

  // Selettore file per Google Service Account Key
  const handleChooseGoogleKeyFile = async () => {
    if (window.electron && (window.electron as any).invoke) {
      const filePath = await (window.electron as any).invoke('choose-file', {
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (filePath) setGoogleServiceAccountKeyPath(filePath);
    } else if (window.electron && window.electron.chooseFolder) {
      const path = await window.electron.chooseFolder();
      if (path) setGoogleServiceAccountKeyPath(path);
    }
  };

  return (
    <div className=" mx-auto p-8 mt-8 bg-slate-800 rounded shadow text-white">
      {onBack && (
        <button className="flex mb-4 px-3 py-1 hover:bg-slate-900 text-white rounded" onClick={onBack}>
          <ChevronLeft />
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
            className="btn px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded "
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
            onChange={(e) => setUseProxy(e.target.checked)}
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
            onChange={(e) => setCustomProxy(e.target.value)}
          />
        )}
      </div>
      {/* Headless mode */}
      <div className="mb-4">
        <span className="block mb-2 font-semibold">Modalit&agrave; Headless</span>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="headlessCheckbox"
            checked={headless}
            onChange={(e) => setHeadless(e.target.checked)}
            className="mr-2"
          />
          <span>Rimuovi la spunta solo in caso di problemi</span>
        </div>
      </div>
      <div className="mb-4">
        <span className="block mb-2 font-semibold">Token HuggingFace AI</span>
        <input
          type="text"
          className="input w-full px-3 py-2 border rounded text-black"
          value={aiToken}
          onChange={(e) => setAiToken(e.target.value)}
          placeholder="hf_..."
        />
      </div>
      <div className="mb-4">
        <span className="block mb-2 font-semibold">Modello AI</span>
        <input
          type="text"
          className="input w-full px-3 py-2 border rounded text-black"
          value={aiModel}
          onChange={(e) => setAiModel(e.target.value)}
          placeholder="meta-llama/Llama-3.2-3B-Instruct"
        />
      </div>
      <div className="mb-4">
        <span className="block mb-2 font-semibold">Percorso file chiave Google Service Account (JSON)</span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="input flex-1 px-3 py-2 border rounded text-black"
            value={googleServiceAccountKeyPath}
            onChange={(e) => setGoogleServiceAccountKeyPath(e.target.value)}
            placeholder="/percorso/file/chiave.json"
            readOnly
          />
          <button
            className="btn px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
            onClick={handleChooseGoogleKeyFile}
            type="button"
          >
            Scegli File
          </button>
          <button className="btn px-4 py-2 bg-yellow-700 hover:bg-yellow-800 text-slate-800 rounded">
            <a href="https://console.cloud.google.com/apis/api/bigquery.googleapis.com" target="blank">
              🔑 Ottieni la tua chiave Google
            </a>
          </button>
        </div>
      </div>
      <div className="mb-4">
        <span className="block mb-2 font-semibold">Google Project ID</span>
        <input
          type="text"
          className="input w-full px-3 py-2 border rounded text-black"
          value={googleProjectId}
          onChange={(e) => setGoogleProjectId(e.target.value)}
          placeholder="Google Cloud Project ID"
        />
      </div>
      <div className="mb-4">
        <span className="block mb-2 font-semibold">Meta API Key</span>
        <div className='flex items-center gap-2'>
        <input
          type="text"
          className="input w-full px-3 py-2 border rounded text-black"
          value={metaAdsAccessToken}
          onChange={(e) => setMetaAdsAccessToken(e.target.value)}
          placeholder="Meta API Key"
        />
        <button className="btn px-4 py-2 bg-yellow-700 hover:bg-yellow-800 text-slate-800 rounded">
          <a href="https://www.facebook.com/ads/library/api" target="blank">
            🔑 Ottieni la tua chiave Meta
          </a>
        </button>
        </div>
      </div>
      <button
        className="btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
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
