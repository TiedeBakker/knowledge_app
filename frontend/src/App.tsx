import { useState } from 'react';
import { Sidebar, ModuleType } from './components/layout/Sidebar';
import { TreeViewerModule } from './modules/tree-viewer/TreeViewerModule';
import { ReportingModule } from './modules/reporting/ReportingModule';
import './App.css';

function App() {
  const [activeModule, setActiveModule] = useState<ModuleType>('tree-viewer');

  return (
    <div className="app-layout" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Sidebar activeModule={activeModule} onSelectModule={setActiveModule} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', background: '#ffffff' }}>
        {activeModule === 'tree-viewer' && <TreeViewerModule />}
        {activeModule === 'reporting' && <ReportingModule />}
      </main>
    </div>
  );
}

export default App;