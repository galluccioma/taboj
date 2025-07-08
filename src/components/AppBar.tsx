import React from 'react';
import { Map, Globe, FileQuestionMark, DatabaseBackup, Settings as SettingsIcon } from 'lucide-react';
import customIcon from '../assets/icons/icon.png';

interface AppBarProps {
  selectedType: string;
  onChangeType: (type: string) => void;
  viewMode: 'scraping' | 'dashboard';
  onChangeViewMode: (mode: 'scraping' | 'dashboard') => void;
  onOpenSettings: () => void;
  title?: string;
}

function AppBar({ selectedType, onChangeType, viewMode, onChangeViewMode, onOpenSettings, title }: AppBarProps) {
  return (
    <>
      <div className="bg-slate-800 py-0.5 fixed top-0 mx-auto w-full flex justify-between text-white items-center draggable">
          <div className="flex items-center gap-4 mx-4">
            <img className="h-6 lg:-ml-2" src={customIcon} alt="Icon of Electron" />
            <p className="text-md font-bold md:pt-1 md:-ml-1 lg:-ml-2">Taboj</p>
          </div>

        {/* Right controls: undraggable */}
        <div className="inline-flex items-center gap-2 -mt-1 undraggable">
          {!title && <>
          {/* Scraping/Dashboard Toggle */}
          <button
            className={`undraggable hover:bg-gray-700 px-4 py-2 rounded-l ${viewMode === 'scraping' ? 'bg-green-600 text-white' : 'bg-slate-700 text-gray-300'}`}
            onClick={(e) => { e.stopPropagation(); onChangeViewMode('scraping'); }}
          >
            Scraping
          </button>
          <button
            className={`undraggable hover:bg-gray-700 px-4 py-2 rounded-r ${viewMode === 'dashboard' ? 'bg-green-600 text-white' : 'bg-slate-700 text-gray-300'}`}
            onClick={(e) => { e.stopPropagation(); onChangeViewMode('dashboard'); }}
          >
            Dashboard
          </button>
          </>}
          <button
            className="undraggable px-3 py-2 hover:bg-gray-700 rounded-full"
            title="Impostazioni"
            onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); window.Main && window.Main.Minimize && window.Main.Minimize(); }} className="undraggable md:px-4 lg:px-3 pt-1 hover:bg-gray-300">
            &#8211;
          </button>
          <button onClick={(e) => { e.stopPropagation(); window.Main && window.Main.Maximize && window.Main.Maximize(); }} className="undraggable px-6 lg:px-5 pt-1 hover:bg-gray-300">
            {'⃞'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); window.Main && window.Main.Close && window.Main.Close(); }} className="undraggable px-4 pt-1 hover:bg-red-500 hover:text-white">
            &#10005;
          </button>
        </div>
      </div>
      <header className="bg-slate-800 py-4 text-white undraggable fixed bottom-0 w-full z-50 items-center flex justify-center">
        <div className="flex text-center gap-4">
          <div
            className={`flex items-center justify-center gap-2 text-sm hover:bg-gray-700 cursor-pointer p-2 rounded-full ${
              selectedType === 'maps' ? 'bg-green-700' : ''
            }`}
            role="button"
            tabIndex={0}
            onClick={() => onChangeType('maps')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onChangeType('maps');
              }
            }}
          >
            <Map className="inline " />
            <span>Maps</span>
          </div>
          <div
            className={`flex items-center justify-center gap-2 text-sm hover:bg-gray-700 cursor-pointer p-2 rounded-full ${
              selectedType === 'dns' ? 'bg-green-700' : ''
            }`}
            role="button"
            tabIndex={0}
            onClick={() => onChangeType('dns')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onChangeType('dns');
              }
            }}
          >
            <Globe className="inline " />
            <span>DNS</span>
          </div>
          <div
            className={`flex items-center justify-center gap-2 text-sm hover:bg-gray-700 cursor-pointer p-2 rounded-full ${
              selectedType === 'ask' ? 'bg-green-700' : ''
            }`}
            role="button"
            tabIndex={0}
            onClick={() => onChangeType('ask')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onChangeType('ask');
              }
            }}
          >
            <FileQuestionMark className="inline " />
            <span>Ask</span>
          </div>
          <div
            className={`flex items-center justify-center gap-2 text-sm hover:bg-gray-700 cursor-pointer p-2 rounded-full ${
              selectedType === 'backup' ? 'bg-green-700' : ''
            }`}
            role="button"
            tabIndex={0}
            onClick={() => onChangeType('backup')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onChangeType('backup');
              }
            }}
          >
            <DatabaseBackup className="inline " />
            <span>SEO Backup</span>
          </div>
        </div>
      </header>
    </>
  );
}

export default AppBar;
