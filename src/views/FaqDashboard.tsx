import React from 'react';

function FaqDashboard({ data }: { data: Record<string, any>[] }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return (
    <div className="space-y-8">
      {data.map((row, idx) => (
        <div key={idx} className="border-b border-slate-600 pb-4 mb-4 gap-4">
          <div>
            <strong>Domanda:</strong>
            <div className="bg-slate-900 text-white p-2 rounded mt-1">{row.question}</div>
          </div>
          <div>
            <strong>Risposta:</strong>
            <div className="bg-slate-900 text-white p-2 rounded mt-1 whitespace-pre-line">{row.description}</div>
          </div>
          <div>
            <strong>Query di ricerca:</strong>
            <span className="ml-2">{row.searchQuery}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default FaqDashboard; 