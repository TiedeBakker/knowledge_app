import { useState } from 'react';
import { Sidebar, ModuleType } from './components/layout/Sidebar';
import { TreeViewerModule } from './modules/tree-viewer/TreeViewerModule';
import { BaseModule } from './modules/base-module/BaseModule'; // Importeer de nieuwe module
import { ReportModule } from './modules/reporting/ReportModule';
import { MediaImportModal } from './modules/import/MediaImportModal';
import './App.css';

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleType>('tree-viewer');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const handleImportCompleted = () => {
    setActiveModule('tree-viewer');
  };

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <main className="main-content" style={{ flex: 1, padding: '0', overflow: 'hidden', height: '100vh' }}>
        {activeModule === 'tree-viewer' && <TreeViewerModule />}
        {activeModule === 'base-module' && <BaseModule />}
        {activeModule === 'reporting' && <ReportModule />}

        <MediaImportModal
          isOpen={activeModule === 'media-import'}
          onClose={() => setActiveModule('tree-viewer')}
          onImportCompleted={handleImportCompleted}
        />
      </main>
    </div>
  );
};

export default App;