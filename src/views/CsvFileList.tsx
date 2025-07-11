import React from 'react';

interface CsvFileListProps {
  files: string[];
  onView: (file: string) => void;
  onDelete: (file: string) => void;
  loading?: boolean;
}

const CsvFileList: React.FC<CsvFileListProps> = ({ files, onView, onDelete, loading }) => {
  if (loading) return <div>Caricamento file...</div>;
  return (
    <ul className="divide-y divide-slate-600">
      {files.map((file, idx) => (
        <li key={file} className="py-2 flex items-center justify-between">
          <span className="truncate max-w-xs">{file.split(/[\\/]/).pop() || file}</span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded "
              onClick={() => onView(file)}
            >
              Vedi
            </button>
            <button
              className="px-3 py-1 bg-yellow-700 hover:bg-yellow-800 text-white rounded"
              onClick={async () => {
                const folderPath = file.substring(0, file.lastIndexOf('/'));
                if (window.electron && window.electron.invoke && folderPath) {
                  await window.electron.invoke('open-backup-folder', folderPath);
                }
              }}
            >
              Mostra File
            </button>
            <button
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              onClick={() => onDelete(file)}
            >
              Elimina
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default CsvFileList; 