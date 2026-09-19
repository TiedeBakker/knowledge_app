// knowledge-app/frontend/src/modules/tree-viewer/GraphicalTreeView.tsx
import React, { useState } from 'react';
import { main } from '../../../wailsjs/go/models';
import { getInboundRelationLabel, getOutboundRelationLabel } from '../../utils/relationUtils';
import { GetParametersForTarget, OpenFile } from '../../../wailsjs/go/main/App';

interface Props {
  treeData: main.TreeNodeData | null;
  onOpenEditor: (node: main.ObjectEntity) => void;
  onSetCentralNode: (node: main.ObjectEntity) => void;
}

export const GraphicalTreeView: React.FC<Props> = ({ treeData, onOpenEditor, onSetCentralNode }) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  // State om de bestandspaden per node op te slaan: { [nodeId]: filePath }
  const [nodeFilePaths, setNodeFilePaths] = useState<{ [nodeId: string]: string | null }>({});

  if (!treeData || !treeData.nodes || treeData.nodes.length === 0) {
    return <div style={{ color: '#666', fontStyle: 'italic' }}>Kies een start-node om de grafische boom te bekijken.</div>;
  }

  const data = treeData;

  const nodeMap = new Map<string, main.ObjectEntity>();
  data.nodes.forEach((n) => nodeMap.set(n.id, n));

  const centralNode = nodeMap.get(data.centralNodeId);
  if (!centralNode) return null;

  // Bij hoveren direct controleren of het object een parameter met type 'file' heeft
  const handleMouseEnter = async (nodeId: string) => {
    setHoveredNodeId(nodeId);

    // Als we voor deze node nog niet hebben gecachet of er een bestand is:
    if (!(nodeId in nodeFilePaths)) {
      try {
        const params = await GetParametersForTarget(nodeId);
        const fileParam = params?.find((p: any) => {
          const dt = (p.dataType || p.dataTypeCode || p.data_type || '').toString().toLowerCase();
          return dt === 'file' && p.value;
        });

        setNodeFilePaths((prev) => ({
          ...prev,
          [nodeId]: fileParam ? fileParam.value : null
        }));
      } catch (err) {
        console.error("Fout bij ophalen parameters voor node:", nodeId, err);
        setNodeFilePaths((prev) => ({ ...prev, [nodeId]: null }));
      }
    }
  };

  // Direct het bestand openen
  const handleQuickOpenFile = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await OpenFile(filePath);
    } catch (err) {
      console.error("Fout bij openen van bestand:", err);
    }
  };

  // Sorteerfunctie voor uitgaande relaties op 'volgorde'
  const sortOutboundEdges = (edges: any[]) => {
    return [...edges].sort((a, b) => {
      const valA = a.volgorde ?? a.sortOrder ?? a.sort_order ?? a.order ?? 0;
      const valB = b.volgorde ?? b.sortOrder ?? b.sort_order ?? b.order ?? 0;
      return valA - valB;
    });
  };

  // FICHE RENDERER
  const renderNodeCard = (node: main.ObjectEntity, isCentral = false, relationLabel?: string) => {
    const isHovered = hoveredNodeId === node.id;
    const filePath = nodeFilePaths[node.id];

    return (
      <div
        onMouseEnter={() => handleMouseEnter(node.id)}
        onMouseLeave={() => setHoveredNodeId(null)}
        onDoubleClick={() => onOpenEditor(node)}
        style={{
          position: 'relative',
          width: '150px',
          height: '50px',
          boxSizing: 'border-box'
        }}
      >
        {/* BASISTEGEL */}
        <div
          style={{
            width: '100%',
            height: '100%',
            background: isCentral ? '#007acc' : '#ffffff',
            color: isCentral ? '#ffffff' : '#333333',
            border: `2px solid ${isCentral ? '#005999' : '#b0bec5'}`,
            borderRadius: '4px',
            padding: '4px 6px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            boxSizing: 'border-box'
          }}
        >
          {relationLabel && (
            <div
              style={{
                fontSize: '0.62rem',
                background: isCentral ? '#005999' : '#eceff1',
                color: isCentral ? '#fff' : '#455a64',
                padding: '0px 3px',
                borderRadius: '2px',
                alignSelf: 'flex-start',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginBottom: '1px'
              }}
              title={relationLabel}
            >
              {relationLabel}
            </div>
          )}
          <strong
            style={{
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
              lineHeight: '1.2'
            }}
            title={node.label}
          >
            {node.label}
          </strong>
        </div>

        {/* VERGROOT HOVER-FICHE */}
        {isHovered && (
          <div
            style={{
              position: 'absolute',
              top: '-4px',
              left: '-4px',
              width: '210px',
              zIndex: 100,
              background: isCentral ? '#007acc' : '#ffffff',
              color: isCentral ? '#ffffff' : '#333333',
              border: `2px solid ${isCentral ? '#004080' : '#007acc'}`,
              borderRadius: '6px',
              padding: '8px 10px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            {relationLabel && (
              <span
                style={{
                  fontSize: '0.68rem',
                  background: isCentral ? '#004080' : '#e3f2fd',
                  color: isCentral ? '#fff' : '#007acc',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  alignSelf: 'flex-start',
                  fontWeight: 'bold'
                }}
              >
                Relatie: {relationLabel}
              </span>
            )}
            <div style={{ fontWeight: 'bold', fontSize: '0.88rem', wordBreak: 'break-word' }}>
              {node.label}
            </div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
              ID: {node.id}
            </div>

            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEditor(node);
                }}
                style={{
                  flex: 1,
                  fontSize: '0.7rem',
                  padding: '3px 4px',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  border: '1px solid #ccc',
                  background: '#f5f5f5',
                  color: '#333',
                  fontWeight: 'bold'
                }}
                title="Open Node Editor"
              >
                ✏️ Bewerken
              </button>

              {/* SLIMME KNOP: Alleen zichtbaar als er daadwerkelijk een bestand is */}
              {filePath && (
                <button
                  onClick={(e) => handleQuickOpenFile(filePath, e)}
                  style={{
                    fontSize: '0.7rem',
                    padding: '3px 6px',
                    cursor: 'pointer',
                    borderRadius: '3px',
                    border: '1px solid #007acc',
                    background: '#e3f2fd',
                    color: '#007acc',
                    fontWeight: 'bold'
                  }}
                  title={`Open bestand: ${filePath}`}
                >
                  📂 Openen
                </button>
              )}

              {!isCentral && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetCentralNode(node);
                  }}
                  style={{
                    flex: 1,
                    fontSize: '0.7rem',
                    padding: '3px 4px',
                    cursor: 'pointer',
                    borderRadius: '3px',
                    border: 'none',
                    background: '#2e7d32',
                    color: '#fff',
                    fontWeight: 'bold'
                  }}
                  title="Maak centraal node"
                >
                  🎯 Centraal
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // RECURSIEF: INKOMENDE TAKKEN (LINKS VAN CENTRUM)
  const renderInboundSubTree = (targetId: string, depth: number) => {
    if (depth > data.inLevels) return null;

    const edges = data.edges?.filter((e) => e.targetId === targetId) || [];
    if (edges.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginRight: '16px' }}>
        {edges.map((edge) => {
          const sourceNode = nodeMap.get(edge.sourceId);
          if (!sourceNode) return null;

          const inboundLabel = getInboundRelationLabel(edge.relationLabel);

          return (
            <div key={edge.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
              {renderInboundSubTree(sourceNode.id, depth + 1)}

              {renderNodeCard(sourceNode, false, inboundLabel)}

              <div style={{ display: 'flex', alignItems: 'center', height: '50px', marginLeft: '4px' }}>
                <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '0.9rem' }}>──►</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // RECURSIEF: UITGAANDE TAKKEN (RECHTS VAN CENTRUM)
  const renderOutboundSubTree = (sourceId: string, depth: number) => {
    if (depth > data.outLevels) return null;

    const rawEdges = data.edges?.filter((e) => e.sourceId === sourceId) || [];
    if (rawEdges.length === 0) return null;

    const sortedEdges = sortOutboundEdges(rawEdges);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '16px' }}>
        {sortedEdges.map((edge) => {
          const targetNode = nodeMap.get(edge.targetId);
          if (!targetNode) return null;

          const outboundLabel = getOutboundRelationLabel(edge.relationLabel);

          return (
            <div key={edge.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', height: '50px', marginRight: '4px' }}>
                <span style={{ color: '#c62828', fontWeight: 'bold', fontSize: '0.9rem' }}>──►</span>
              </div>

              {renderNodeCard(targetNode, false, outboundLabel)}

              {renderOutboundSubTree(targetNode.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '16px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
        
        {/* INKOMEND (LINKS) */}
        {data.inLevels > 0 && renderInboundSubTree(centralNode.id, 1)}

        {/* CENTRAAL (MIDDEN) */}
        {renderNodeCard(centralNode, true)}

        {/* UITGAAND (RECHTS) */}
        {data.outLevels > 0 && renderOutboundSubTree(centralNode.id, 1)}

      </div>
    </div>
  );
};