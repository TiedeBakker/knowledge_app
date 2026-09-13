import React, { useState, useEffect } from 'react';
import { NodeSearchSelect } from '../../components/NodeSearchSelect';
import { GraphicalTreeView } from './GraphicalTreeView';
import { TextualTreeView } from './TextualTreeView';
import { NodeEditorModal } from '../../components/NodeEditorModal';
import { GetTreeForNode } from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import { UpdateObject } from '../../../wailsjs/go/main/App';

type ViewMode = 'graphical' | 'textual';

export const TreeViewerModule: React.FC = () => {
  const [startNode, setStartNode] = useState<main.ObjectEntity | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('graphical');

  // Niveaus (Default: 1 in, 1 uit)
  const [inLevels, setInLevels] = useState<number>(1);
  const [outLevels, setOutLevels] = useState<number>(1);

  // Boom-data uit SQLite
  const [treeData, setTreeData] = useState<main.TreeNodeData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // NodeEditor Modal State
  const [selectedEditorNode, setSelectedEditorNode] = useState<main.ObjectEntity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Data ophalen zodra startNode, inLevels of outLevels verandert
  useEffect(() => {
    if (startNode) {
      setLoading(true);
      GetTreeForNode(startNode.id, inLevels, outLevels)
        .then((data) => setTreeData(data))
        .catch((err) => console.error("Fout bij ophalen boomdata:", err))
        .finally(() => setLoading(false));
    } else {
      setTreeData(null);
    }
  }, [startNode, inLevels, outLevels]);

  const handleOpenEditor = (node: main.ObjectEntity) => {
    setSelectedEditorNode(node);
    setIsModalOpen(true);
  };

  const handleSetCentralNode = (node: main.ObjectEntity) => {
    setStartNode(node);
  };

  return (
    <div className="module-container" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Tree Viewer & Editor</h1>
      </header>

      {/* BEDIENINGSBALK */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Start-node:</label>
          <NodeSearchSelect onSelectNode={(node) => setStartNode(node)} />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Inkomende niveaus:</label>
          <input
            type="number"
            min="0"
            max="5"
            value={inLevels}
            onChange={(e) => setInLevels(Math.max(0, parseInt(e.target.value) || 0))}
            style={{ width: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Uitgaande niveaus:</label>
          <input
            type="number"
            min="0"
            max="5"
            value={outLevels}
            onChange={(e) => setOutLevels(Math.max(0, parseInt(e.target.value) || 0))}
            style={{ width: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Weergave:</label>
          <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('graphical')}
              style={{
                padding: '8px 16px', border: 'none',
                background: viewMode === 'graphical' ? '#007acc' : '#f0f0f0',
                color: viewMode === 'graphical' ? '#fff' : '#333', cursor: 'pointer'
              }}
            >
              🎨 Grafisch
            </button>
            <button
              onClick={() => setViewMode('textual')}
              style={{
                padding: '8px 16px', border: 'none',
                background: viewMode === 'textual' ? '#007acc' : '#f0f0f0',
                color: viewMode === 'textual' ? '#fff' : '#333', cursor: 'pointer'
              }}
            >
              📄 Tekstueel
            </button>
          </div>
        </div>
      </div>

      {/* WEERGAVE INHOUD */}
      {loading ? (
        <div style={{ padding: '20px' }}>Boomstructuur laden uit SQLite...</div>
      ) : viewMode === 'graphical' ? (
        <GraphicalTreeView
          treeData={treeData}
          onOpenEditor={handleOpenEditor}
          onSetCentralNode={handleSetCentralNode}
        />
      ) : (
        <TextualTreeView
          treeData={treeData}
          onOpenEditor={handleOpenEditor}
          onSetCentralNode={handleSetCentralNode}
        />
      )}

      {/* MODAL EDITOR */}
      <NodeEditorModal
        node={selectedEditorNode}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={async (updatedNode) => {
          try {
            // 1. Schrijf naar SQLite
            await UpdateObject(updatedNode);
            console.log('Object succesvol opgeslagen in SQLite!');

            // 2. Update ook de geopende editor-node referentie
            setSelectedEditorNode(updatedNode);

            // 3. Ververs de achterliggende grafische boomweergave op de achtergrond
            // (Het modal blijft nu gewoon OPEN staan!)
            if (startNode) {
              const refreshedData = await GetTreeForNode(startNode.id, inLevels, outLevels);
              setTreeData(refreshedData);
            }
          } catch (err) {
            console.error('Fout bij opslaan in database:', err);
          }
        }}
      />
    </div>
  );
};