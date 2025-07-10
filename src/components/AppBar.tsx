import React from 'react';

interface AppBarProps {
  viewMode: 'scraping' | 'dashboard';
  onChangeViewMode: (mode: 'scraping' | 'dashboard') => void;
  title?: string;
}

function AppBar({ viewMode, onChangeViewMode, title }: AppBarProps) {
  return (
    <header className="bg-slate-800 text-white fixed top-0 mx-auto w-full flex justify-between items-center draggable z-[999]">
      {/* Controlli per windows */}
      <div>
        <div className="flex space-x-2 p-2 undraggable group">
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.Main?.Close?.();
            }}
            className="h-3 w-3 rounded-full bg-red-500 hover:bg-red-600"
            title="Close"
            aria-label="Close"
          >
            <svg
              className="h-3 w-3 text-slate-800 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Button Resize */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.Main?.Minimize?.();
            }}
            className="h-3 w-3 rounded-full bg-yellow-700 hover:bg-yellow-800"
            title="Minimize"
            aria-label="Minimize"
          >
            <svg
              className="h-3 w-3 text-slate-800 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            </svg>
          </button>
          {/* Button mazimize */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.Main?.Maximize?.();
            }}
            className="h-3 w-3 rounded-full bg-green-500 hover:bg-green-600"
            title="Maximize"
            aria-label="Maximize"
          >
            <svg
              className="h-3 w-3 text-slate-800 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>
      {/* Right controls: undraggable */}
      <div className="inline-flex items-start undraggable">
        {!title && (
          <>
            {/* Scraping/Dashboard Toggle */}
            <button
              className={`undraggable hover:bg-gray-700 px-4 py-2 rounded-l ${
                viewMode === 'scraping' ? 'bg-slate-900 hover:bg-slate-900 text-white' : 'bg-slate-700 text-gray-300'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onChangeViewMode('scraping');
              }}
            >
              Scraping
            </button>
            
            <button
              className={`undraggable hover:bg-gray-700 px-4 py-2 rounded-r ${
                viewMode === 'dashboard' ? 'bg-slate-900 hover:bg-slate-900 text-white' : 'bg-slate-700 text-gray-300'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onChangeViewMode('dashboard');
              }}
            >
              Dashboard
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default AppBar;
