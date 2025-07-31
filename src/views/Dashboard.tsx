import React, { useState } from 'react';
import { Filter, EyeOff, RotateCcw, ChevronUp, ChevronDown, ChevronLeft } from 'lucide-react';
import AiChatDialog from '../components/AiChatDialog';

/**
 * Dashboard: mostra dati CSV, controlli, chat AI, e vista JSON/raw.
 * Props:
 * - data: array di record da mostrare
 * - csvPath: percorso CSV (opzionale, per chatId)
 * - onBack: funzione opzionale per tornare alla lista
 */
function Dashboard({ data, csvPath, onBack }: { data: Record<string, any>[]; csvPath?: string; onBack?: () => void }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-400 text-lg mb-2">📊</div>
        <p className="text-slate-400">Nessun dato disponibile</p>
      </div>
    );
  }
  const headers = Object.keys(data[0] || {});
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  const [showAiChat, setShowAiChat] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  // --- Solo chat AI e controlli non-AI ---

  const filteredData = data.filter((row) =>
    headers.every(
      (header) =>
        !filters[header] ||
        String(row[header] ?? '').toLowerCase().includes(filters[header].toLowerCase())
    )
  );
  const visibleHeaders = headers.filter((h) => !hiddenCols.includes(h));

  // Sorting logic
  const sortedData = React.useMemo(() => {
    if (!sort.key || !sort.direction) return filteredData;
    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sort.key] ?? '';
      const bVal = b[sort.key] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sort.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
        : String(bVal).localeCompare(String(aVal), undefined, { numeric: true });
    });
    return sorted;
  }, [filteredData, sort]);

  // --- UI: pulsanti e vista condizionale ---
  return (
    <div className="space-y-6">
      {/* Pulsanti di controllo in alto */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          {onBack && (
            <button
              className="flex px-3 py-1 hover:bg-slate-900 text-white rounded"
              onClick={onBack}
            >
              <ChevronLeft/>
              Torna alla lista
            </button>
          )}
        </div>
        <button
          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
          onClick={() => setShowRaw((r) => !r)}
        >
          {showRaw ? 'Vista Formattata' : 'Vista JSON'}
        </button>
      </div>
      {/* Vista condizionale: JSON/raw oppure tabella+chat */}
      {showRaw ? (
        <pre className="break-words whitespace-pre-wrap bg-slate-900 text-white p-4 rounded overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-wrap gap-3">
            {/* Pulsante per aprire la chat AI */}
            <button
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-sm font-medium"
              onClick={() => setShowAiChat(true)}
            >
              Chatta con AI
            </button>
            {hiddenCols.length > 0 && (
              <button
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-sm font-medium"
                onClick={() => setHiddenCols([])}
              >
                <RotateCcw className="w-4 h-4" />
                Ripristina Colonne
              </button>
            )}
            <div className="text-sm text-slate-400 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {sortedData.length} di {data.length} risultati
            </div>
          </div>
          {/* Table Container */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600/50">
                    {visibleHeaders.map((header) => {
                      const isSorted = sort.key === header && sort.direction;
                      return (
                        <th key={header} className="px-6 py-4 text-left select-none">
                          <div className="flex items-center justify-between gap-3">
                            <button
                              className="flex items-center gap-1 group"
                              onClick={() => {
                                setSort((prev) => {
                                  if (prev.key !== header) return { key: header, direction: 'asc' };
                                  if (prev.direction === 'asc') return { key: header, direction: 'desc' };
                                  if (prev.direction === 'desc') return { key: '', direction: null };
                                  return { key: header, direction: 'asc' };
                                });
                              }}
                              title="Ordina colonna"
                            >
                              <span className="text-sm font-semibold text-slate-200 truncate">{header}</span>
                              {isSorted && sort.direction === 'asc' && <ChevronUp className="w-4 h-4 text-blue-400" />}
                              {isSorted && sort.direction === 'desc' && <ChevronDown className="w-4 h-4 text-blue-400" />}
                            </button>
                            <button
                              className="p-1 hover:bg-red-600/20 rounded-lg transition-colors duration-200 group"
                              title="Nascondi colonna"
                              onClick={() => setHiddenCols((cols) => [...cols, header])}
                            >
                              <EyeOff className="w-4 h-4 text-slate-400 group-hover:text-red-400" />
                            </button>
                          </div>
                          <div className="mt-2">
                            <input
                              type="text"
                              value={filters[header] || ''}
                              onChange={(e) => setFilters((f) => ({ ...f, [header]: e.target.value }))}
                              placeholder="Filtra..."
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sortedData.map((row) => {
                    const rowKey = JSON.stringify(visibleHeaders.map(h => row[h]));
                    return (
                      <tr key={rowKey} className="hover:bg-slate-800/30 transition-colors duration-200">
                        {visibleHeaders.map((header) => (
                          <td key={header} className="px-6 py-4">
                            <div className="text-sm text-slate-300 max-w-xs truncate" title={String(row[header] || '')}>
                              {row[header] || '-'}
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {sortedData.length === 0 && (
            <div className="text-center py-8">
              <div className="text-slate-400 text-lg mb-2">🔍</div>
              <p className="text-slate-400">Nessun risultato trovato con i filtri applicati</p>
            </div>
          )}
          {/* Dialog per la chat AI */}
          <AiChatDialog open={showAiChat} onClose={() => setShowAiChat(false)} context={data} chatId={csvPath || 'default'} />
        </>
      )}
    </div>
  );
}

export default Dashboard; 