import React from 'react';
import { main } from '../../../wailsjs/go/models';

interface Props {
  treeData: main.TreeNodeData | null;
  onOpenEditor: (node: main.ObjectEntity) => void;
  onSetCentralNode: (node: main.ObjectEntity) => void;
}

export const TextualTreeView: React.FC<Props> = ({ treeData, onOpenEditor, onSetCentralNode }) => {
  if (!treeData || !treeData.nodes || treeData.nodes.length === 0) {
    return <div style={{ color: '#666', fontStyle: 'italic' }}>Kies een start-node om de tekstuele boom te bekijken.</div>;
  }

  const nodeMap = new Map<string, main.ObjectEntity>();
  treeData.nodes.forEach((n) => nodeMap.set(n.id, n));

  const centralNode = nodeMap.get(treeData.centralNodeId);
  if (!centralNode) return null;

  const renderActions = (node: main.ObjectEntity) => (
    <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>
      <button onClick={() => onOpenEditor(node)} style={{ marginRight: '4px', cursor: 'pointer' }}>✏️ Edit</button>
      {node.id !== centralNode.id && (
        <button onClick={() => onSetCentralNode(node)} style={{ cursor: 'pointer' }}>🎯 Centraal</button>
      )}
    </span>
  );

  // RECURSIEF: Inkomende Takken (Parents -> Children naar het centrum toe)
  const renderInboundBranch = (currentTargetId: string, depth: number) => {
    if (depth > treeData.inLevels) return null;

    const edges = treeData.edges?.filter((e) => e.targetId === currentTargetId) || [];
    if (edges.length === 0) return null;

    return (
      <ul style={{ listStyleType: 'none', paddingLeft: '24px', borderLeft: '1px solid #a5d6a7', margin: '4px 0' }}>
        {edges.map((edge) => {
          const sourceNode = nodeMap.get(edge.sourceId);
          if (!sourceNode) return null;

          return (
            <li key={edge.id} style={{ margin: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>└─ [{edge.relationLabel}]</span>
                <strong style={{ color: '#1b5e20' }}>{sourceNode.label}</strong>
                {renderActions(sourceNode)}
              </div>
              {/* Vervolgtakken dieper naar boven/links */}
              {renderInboundBranch(sourceNode.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  // RECURSIEF: Uitgaande Takken (Centrum -> Children -> Grandchildren)
  const renderOutboundBranch = (currentSourceId: string, depth: number) => {
    if (depth > treeData.outLevels) return null;

    const edges = treeData.edges?.filter((e) => e.sourceId === currentSourceId) || [];
    if (edges.length === 0) return null;

    return (
      <ul style={{ listStyleType: 'none', paddingLeft: '24px', borderLeft: '1px solid #ef9a9a', margin: '4px 0' }}>
        {edges.map((edge) => {
          const targetNode = nodeMap.get(edge.targetId);
          if (!targetNode) return null;

          return (
            <li key={edge.id} style={{ margin: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#c62828', fontWeight: 'bold' }}>└─ [{edge.relationLabel}]</span>
                <strong style={{ color: '#b71c1c' }}>{targetNode.label}</strong>
                {renderActions(targetNode)}
              </div>
              {/* Vervolgtakken dieper naar beneden/rechts */}
              {renderOutboundBranch(targetNode.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', padding: '20px', borderRadius: '6px', fontFamily: 'sans-serif' }}>
      <h3 style={{ marginTop: 0, borderBottom: '2px solid #007acc', paddingBottom: '6px' }}>
        Tekstuele Hiërarchie
      </h3>

      {/* 1. INKOMENDE TAKKEN */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ color: '#2e7d32', marginBottom: '8px' }}>⬆️ Inkomende Hiërarchie (Max {treeData.inLevels} diep)</h4>
        {treeData.inLevels === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic' }}>Inkomende niveaus staat op 0.</p>
        ) : (
          renderInboundBranch(centralNode.id, 1) || <p style={{ color: '#888' }}>Geen inkomende relaties gevonden.</p>
        )}
      </div>

      {/* 2. CENTRALE NODE */}
      <div style={{ background: '#e3f2fd', border: '2px solid #007acc', padding: '10px 16px', borderRadius: '6px', display: 'inline-block', margin: '10px 0' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#007acc' }}>📍 {centralNode.label}</span>
        {renderActions(centralNode)}
      </div>

      {/* 3. UITGAANDE TAKKEN */}
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ color: '#c62828', marginBottom: '8px' }}>⬇️ Uitgaande Hiërarchie (Max {treeData.outLevels} diep)</h4>
        {treeData.outLevels === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic' }}>Uitgaande niveaus staat op 0.</p>
        ) : (
          renderOutboundBranch(centralNode.id, 1) || <p style={{ color: '#888' }}>Geen uitgaande relaties gevonden.</p>
        )}
      </div>
    </div>
  );
};