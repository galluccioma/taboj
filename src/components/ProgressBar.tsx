import React from 'react';

/**
 * Barra di progresso riutilizzabile
 * Props:
 * - current: valore attuale
 * - total: valore massimo
 * - showPercent: mostra la percentuale (default true)
 */
interface ProgressBarProps {
  current: number;
  total: number;
  showPercent?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, showPercent = true }) => {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  if (total <= 0) return null;
  return (
    <div className="w-full bg-slate-700 rounded-full h-4 mb-4 overflow-hidden">
      <div
        className="bg-green-500 h-4 transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
      <div className="text-xs text-center text-white mt-1">
        {current} / {total} completati{showPercent ? ` (${percent}%)` : ''}
      </div>
    </div>
  );
};

export default ProgressBar; 