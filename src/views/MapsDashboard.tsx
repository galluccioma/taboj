import React, { useState } from 'react';
import { Filter, EyeOff, RotateCcw } from 'lucide-react';

function MapsDashboard({ data }: { data: Record<string, any>[] }) {
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);

  const headers = Object.keys(data[0] || {});

  const filteredData = data.filter((row) =>
    headers.every(
      (header) =>
        !filters[header] ||
        String(row[header] ?? '')
          .toLowerCase()
          .includes(filters[header].toLowerCase())
    )
  );

  const visibleHeaders = headers.filter((h) => !hiddenCols.includes(h));

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-400 text-lg mb-2">📊</div>
        <p className="text-slate-400">Nessun dato disponibile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
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
          {filteredData.length} di {data.length} risultati
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600/50">
                {visibleHeaders.map((header) => (
                  <th key={header} className="px-6 py-4 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-200 truncate">{header}</span>
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
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors duration-200">
                  {visibleHeaders.map((header) => (
                    <td key={header} className="px-6 py-4">
                      <div className="text-sm text-slate-300 max-w-xs truncate" title={String(row[header] || '')}>
                        {row[header] || '-'}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredData.length === 0 && (
        <div className="text-center py-8">
          <div className="text-slate-400 text-lg mb-2">🔍</div>
          <p className="text-slate-400">Nessun risultato trovato con i filtri applicati</p>
        </div>
      )}
    </div>
  );
}

export default MapsDashboard;
