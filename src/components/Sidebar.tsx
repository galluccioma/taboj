import React, { useState } from 'react';
import { Map, Globe, Search, DatabaseBackup, Menu, X, SettingsIcon, Tags } from 'lucide-react';
import customIcon from '../assets/icons/icon.png';

interface SidebarProps {
  selectedType: string;
  onChangeType: (type: string) => void;
  onOpenSettings: () => void;
}

// Sidebar Items component
function SidebarItem({
  open,
  selected,
  icon,
  label,
  onClick
}: {
  open: boolean;
  selected: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 cursor-pointer p-2 rounded-lg mx-2 my-1 transition-colors duration-200 ${
        selected ? 'bg-green-500' : 'hover:bg-gray-700'
      } ${open ? 'justify-start' : 'justify-center'}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
    >
      {icon}
      {open && <span className="text-sm">{label}</span>}
    </div>
  );
}

// Setting Button
function SettingButton({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <button
      className="fixed bottom-10 right-10 undraggable px-3 py-2 hover:bg-gray-700 rounded-full"
      title="Impostazioni"
      onClick={(e) => {
        e.stopPropagation();
        onOpenSettings();
      }}
    >
      <SettingsIcon className="w-6 h-6" />
    </button>
  );
}

function Sidebar({ selectedType, onChangeType, onOpenSettings }: SidebarProps) {
  const [open, setOpen] = useState(false);

  // Sidebar content
  const sidebarContent = (
    <>
      <aside
        className={`fixed top-0 flex flex-col h-full pt-12 bg-slate-800 border-r border-gray-600 text-white shadow-lg transition-all duration-300 ${
          open ? 'w-64' : 'w-16'
        }  top-0 left-0 z-50 undraggable`}
        style={{ minHeight: '100vh' }}
      >
        {/* Header */}
        <div className="flex flex-col items-start gap-2 px-4 py-4 border-b border-slate-700/40">
          {/* Logo e Titolo */}
          <div className="flex">
            <img
              className={`h-7 transition-all duration-300 ${open ? 'ml-2' : 'ml-0'}`}
              src={customIcon}
              alt="Icon of Electron"
            />
            {open && <p className="text-lg font-bold ml-2">Taboj</p>}
          </div>
          {/* Menu Hamburger */}
          <button
            className="undraggable p-1 rounded hover:bg-gray-700 focus:outline-none"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close sidebar' : 'Open sidebar'}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Navigation Business Analyzer */}
        <nav className="flex flex-col gap-1 py-4 border-b border-white/20">
          <SidebarItem
            open={open}
            selected={selectedType === 'maps'}
            icon={<Map className="w-5 h-5" />}
            label="Maps"
            onClick={() => onChangeType('maps')}
          />
          <SidebarItem
            open={open}
            selected={selectedType === 'dns'}
            icon={<Globe className="w-5 h-5" />}
            label="DNS"
            onClick={() => onChangeType('dns')}
          />
          <SidebarItem
            open={open}
            selected={selectedType === 'googleads'}
            icon={<Tags className="w-5 h-5" />} // You may want to use a different icon
            label="Google Ads"
            onClick={() => onChangeType('googleads')}
          />
        </nav>
        {/* Navigation Tecnici */}
         <nav className="flex flex-col gap-1 py-4 border-b border-white/20">
            <SidebarItem
            open={open}
            selected={selectedType === 'ask'}
            icon={<Search className="w-5 h-5" />}
            label="Ask"
            onClick={() => onChangeType('ask')}
          />
          <SidebarItem
            open={open}
            selected={selectedType === 'backup'}
            icon={<DatabaseBackup className="w-5 h-5" />}
            label="SEO Backup"
            onClick={() => onChangeType('backup')}
          />
        </nav>
      </aside>
      <SettingButton onOpenSettings={onOpenSettings} />
    </>
  );

  return sidebarContent;
}

export default Sidebar;
