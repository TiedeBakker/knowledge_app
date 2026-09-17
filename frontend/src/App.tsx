import { useState } from 'react';
import { Sidebar, ModuleType } from './components/layout/Sidebar';
import { TreeViewerModule } from './modules/tree-viewer/TreeViewerModule';
import { ReportingModule } from './modules/reporting/ReportingModule';
import { MediaImportModal } from './modules/import/MediaImportModal';
import './App.css';

// function App() {
//   const [activeModule, setActiveModule] = useState<ModuleType>('tree-viewer');

//   return (
//     <div className="app-layout" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
//       <Sidebar activeModule={activeModule} onSelectModule={setActiveModule} />
//       <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', background: '#ffffff' }}>
//         {activeModule === 'tree-viewer' && <TreeViewerModule />}
//         {activeModule === 'reporting' && <ReportingModule />}
//       </main>
//     </div>
//   );
// }

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleType>('tree-viewer');

  const handleImportCompleted = () => {
    // Schakel bijvoorbeeld terug naar de boomstructuur om de nieuwe media/groep te zien
    setActiveModule('tree-viewer');
  };

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh' }}>
      <Sidebar activeModule={activeModule} onSelectModule={setActiveModule} />
      
      <main className="main-content" style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
         {activeModule === 'tree-viewer' && <TreeViewerModule />}
        {activeModule === 'reporting' && <ReportingModule />}
        
        {/* Render de Media Import Modal wanneer 'media-import' actief is */}
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