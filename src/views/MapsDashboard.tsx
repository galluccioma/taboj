import React from 'react';

function MapsDashboard({ data }: { data: Record<string, any>[] }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return (
    <div className="space-y-8">
      {data.map((row, idx) => (
        <div key={row.csvPath || row.name || idx} className="border-b border-slate-600 pb-4 mb-4">
          <div><strong>Nome:</strong> <span className="ml-2">{row.name}</span></div>
          <div><strong>Indirizzo:</strong> <span className="ml-2">{row.address}</span></div>
          <div><strong>Telefono:</strong> <span className="ml-2">{row.phone}</span></div>
          <div><strong>Sito Web:</strong> <span className="ml-2">{row.website}</span></div>
          <div><strong>Rating:</strong> <span className="ml-2">{row.rating}</span></div>
          <div><strong>Numero Recensioni:</strong> <span className="ml-2">{row.ratingNumber}</span></div>
          <div><strong>Email:</strong> <span className="ml-2">{row.mail}</span></div>
          <div><strong>P.IVA:</strong> <span className="ml-2">{row.piva}</span></div>
          <div><strong>Ragione Sociale:</strong> <span className="ml-2">{row.ragioneSociale}</span></div>
          <div><strong>Query di ricerca:</strong> <span className="ml-2">{row.searchQuery}</span></div>
          {row.csvPath && (
            <button
              className="mt-2 px-3 py-1 bg-yellow-700 hover:bg-yellow-800 text-white rounded bg-yellow-700 hover:bg-yellow-800"
              onClick={async () => {
                const filePath = row.csvPath;
                const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
                if (window.electron && window.electron.invoke && folderPath) {
                  await window.electron.invoke('open-backup-folder', folderPath);
                }
              }}
            >
              Mostra file
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default MapsDashboard; 