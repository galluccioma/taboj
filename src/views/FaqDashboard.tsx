import React, { useState } from 'react';

function FaqDashboard({ data }: { data: Record<string, any>[] }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  const headers = Object.keys(data[0] || {});
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const filteredData = data.filter(row =>
    headers.every(header =>
      !filters[header] ||
      String(row[header] ?? '').toLowerCase().includes(filters[header].toLowerCase())
    )
  );
  const visibleHeaders = headers.filter(h => !hiddenCols.includes(h));
  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex flex-wrap gap-2">
        {hiddenCols.length > 0 && (
          <button
            className="px-2 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs"
            onClick={() => setHiddenCols([])}
          >
            Ripristina colonne
          </button>
        )}
      </div>
      <table className="min-w-full bg-slate-900 text-white border border-slate-700 rounded">
        <thead>
          <tr>
            {visibleHeaders.map(header => (
              <th key={header} className="px-2 py-1 border-b border-slate-700 text-xs text-left">
                <div className="flex items-center gap-1">
                  <span>{header}</span>
                  <button
                    className="ml-1 px-1 py-0.5 bg-red-700 hover:bg-red-800 text-white rounded text-xs"
                    title="Nascondi colonna"
                    onClick={() => setHiddenCols(cols => [...cols, header])}
                  >
                    ✕
                  </button>
                </div>
                <div>
                  <input
                    type="text"
                    value={filters[header] || ''}
                    onChange={e =>
                      setFilters(f => ({ ...f, [header]: e.target.value }))
                    }
                    placeholder="Filtra"
                    className="w-full mt-1 px-1 py-0.5 text-xs text-black rounded"
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row, idx) => (
            <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800">
              {visibleHeaders.map(header => (
                <td key={header} className="px-2 py-1 text-xs">
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FaqDashboard; 