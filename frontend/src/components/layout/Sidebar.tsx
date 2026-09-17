import React from 'react';
import './Sidebar.css';

// 1. Voeg 'media-import' toe aan ModuleType
export type ModuleType = 'tree-viewer' | 'reporting' | 'media-import';

interface Props {
  activeModule: ModuleType;
  onSelectModule: (module: ModuleType) => void;
}

export const Sidebar: React.FC<Props> = ({ activeModule, onSelectModule }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Kennissysteem</h2>
      </div>
      <nav className="sidebar-nav">
        <button
          className={`nav-button ${activeModule === 'tree-viewer' ? 'active' : ''}`}
          onClick={() => onSelectModule('tree-viewer')}
        >
          <span className="icon">🌳</span> Tree Viewer & Editor
        </button>
        <button
          className={`nav-button ${activeModule === 'reporting' ? 'active' : ''}`}
          onClick={() => onSelectModule('reporting')}
        >
          <span className="icon">📊</span> Rapportage
        </button>
        
        {/* 2. Nieuwe knop voor Media Import */}
        <button
          className={`nav-button ${activeModule === 'media-import' ? 'active' : ''}`}
          onClick={() => onSelectModule('media-import')}
        >
          <span className="icon">📷</span> Media Import
        </button>
      </nav>
    </aside>
  );
};