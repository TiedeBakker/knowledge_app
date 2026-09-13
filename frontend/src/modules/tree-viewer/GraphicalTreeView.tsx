import React, { useState } from 'react';
import { main } from '../../../wailsjs/go/models';
import { getInboundRelationLabel, getOutboundRelationLabel } from '../../utils/relationUtils';

interface Props {
  treeData: main.TreeNodeData | null;
  onOpenEditor: (node: main.ObjectEntity) => void;
  onSetCentralNode: (node: main.ObjectEntity) => void;
}

export const GraphicalTreeView: React.FC<Props> = ({ treeData, onOpenEditor, onSetCentralNode }) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  if (!treeData || !treeData.nodes || treeData.nodes.length === 0) {
    return <div style={{ color: '#666', fontStyle: 'italic' }}>Kies een start-node om de grafische boom te bekijken.</div>;
  }

  const nodeMap = new Map<string, main.ObjectEntity>();
  treeData.nodes.forEach((n) => nodeMap.set(n.id, n));

  const centralNode = nodeMap.get(treeData.centralNodeId);
  if (!centralNode) return null;

  // SORTEERFUNCTIE VOOR UITGAANDE RELATIES OP 'VOLGORDE' (zonder RelationEntity type-afhankelijkheid)
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

    return (
      <div
        onMouseEnter={() => setHoveredNodeId(node.id)}
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
                  padding: '3px 6px',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  border: '1px solid #ccc',
                  background: '#f5f5f5',
                  color: '#333',
                  fontWeight: 'bold'
                }}
              >
                ✏️ Bewerken
              </button>
              {!isCentral && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetCentralNode(node);
                  }}
                  style={{
                    flex: 1,
                    fontSize: '0.7rem',
                    padding: '3px 6px',
                    cursor: 'pointer',
                    borderRadius: '3px',
                    border: 'none',
                    background: '#2e7d32',
                    color: '#fff',
                    fontWeight: 'bold'
                  }}
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
    if (depth > treeData.inLevels) return null;

    const edges = treeData.edges?.filter((e) => e.targetId === targetId) || [];
    if (edges.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginRight: '16px' }}>
        {edges.map((edge) => {
          const sourceNode = nodeMap.get(edge.sourceId);
          if (!sourceNode) return null;

          // Gebruik hier het INKOMENDE label (eerste deel vóór de |)
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
    if (depth > treeData.outLevels) return null;

    const rawEdges = treeData.edges?.filter((e) => e.sourceId === sourceId) || [];
    if (rawEdges.length === 0) return null;

    const sortedEdges = sortOutboundEdges(rawEdges);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '16px' }}>
        {sortedEdges.map((edge) => {
          const targetNode = nodeMap.get(edge.targetId);
          if (!targetNode) return null;

          // Gebruik hier het UITGAANDE label (tweede deel ná de |)
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
        {treeData.inLevels > 0 && renderInboundSubTree(centralNode.id, 1)}

        {/* CENTRAAL (MIDDEN) */}
        {renderNodeCard(centralNode, true)}

        {/* UITGAAND (RECHTS) */}
        {treeData.outLevels > 0 && renderOutboundSubTree(centralNode.id, 1)}

      </div>
    </div>
  );
};