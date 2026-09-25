// src/components/layout/Sidebar.tsx
import React from 'react';
import './Sidebar.css';

// 1. Voeg 'base-module' toe aan ModuleType
export type ModuleType = 'tree-viewer' | 'reporting' | 'media-import' | 'base-module';

interface Props {
  activeModule: ModuleType;
  onSelectModule: (module: ModuleType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<Props> = ({ 
  activeModule, 
  onSelectModule, 
  isCollapsed, 
  onToggleCollapse 
}) => {
  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && <h2>Kennissysteem</h2>}
        <button 
          className="toggle-button" 
          onClick={onToggleCollapse}
          title={isCollapsed ? "Sidebar uitklappen" : "Sidebar inklappen"}
        >
          {isCollapsed ? '➔' : '◀'}
        </button>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-button ${activeModule === 'tree-viewer' ? 'active' : ''}`}
          onClick={() => onSelectModule('tree-viewer')}
          title="Tree Viewer & Editor"
        >
          <span className="icon">🌳</span> 
          {!isCollapsed && <span className="label">Tree Viewer & Editor</span>}
        </button>

        {/* NIEUWE BASISMODULE KNOP */}
        <button
          className={`nav-button ${activeModule === 'base-module' ? 'active' : ''}`}
          onClick={() => onSelectModule('base-module')}
          title="Basismodule"
        >
          <span className="icon">⚡</span> 
          {!isCollapsed && <span className="label">Basismodule</span>}
        </button>

        <button
          className={`nav-button ${activeModule === 'reporting' ? 'active' : ''}`}
          onClick={() => onSelectModule('reporting')}
          title="Rapportage"
        >
          <span className="icon">📊</span> 
          {!isCollapsed && <span className="label">Rapportage</span>}
        </button>
        
        <button
          className={`nav-button ${activeModule === 'media-import' ? 'active' : ''}`}
          onClick={() => onSelectModule('media-import')}
          title="Media Import"
        >
          <span className="icon">📷</span> 
          {!isCollapsed && <span className="label">Media Import</span>}
        </button>
      </nav>
    </aside>
  );
};