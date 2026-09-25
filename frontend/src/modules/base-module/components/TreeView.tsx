// knowledge-app/frontend/src/modules/base-module/components/TreeView.tsx
import React from 'react';
import { GraphNode } from '../types/tree.types';
import { NodeCard } from './NodeCard';

interface TreeViewProps {
  centralNode: GraphNode;
  onSelectCentral: (id: string) => void;
  onOpenEditor: (node: GraphNode) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
  centralNode,
  onSelectCentral,
  onOpenEditor,
}) => {
  // RendersRecursief een kolom met takken
  const renderChildrenColumn = (nodes: GraphNode[]) => {
    if (!nodes || nodes.length === 0) return null;

    // Sorteer op relationValue (oplopend)
    const sortedNodes = [...nodes].sort(
      (a, b) => (a.relationValue ?? 0) - (b.relationValue ?? 0)
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sortedNodes.map((child) => (
          <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <NodeCard
              node={child}
              onSelectCentral={onSelectCentral}
              onOpenEditor={onOpenEditor}
            />
            {/* Recursieve aanroep voor volgend niveau rechts */}
            {child.children && child.children.length > 0 && renderChildrenColumn(child.children)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
        padding: '24px',
        overflowX: 'auto',
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* KOLOM 1: LINKS (Ingaande relaties - 1 niveau) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={{ fontSize: '0.75rem', color: '#777', fontWeight: 600 }}>
          Ingaand (1e niv)
        </span>
        {centralNode.incoming && centralNode.incoming.length > 0 ? (
          centralNode.incoming.map((inc) => (
            <NodeCard
              key={inc.id}
              node={inc}
              onSelectCentral={onSelectCentral}
              onOpenEditor={onOpenEditor}
            />
          ))
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#aaa', fontStyle: 'italic' }}>
            Geen ingaande relaties
          </span>
        )}
      </div>

      {/* SCHEIDINGSLIJN */}
      <div style={{ width: '1px', height: '80%', backgroundColor: '#e0e0e0' }} />

      {/* KOLOM 2: CENTRAAL OBJECT */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.75rem', color: '#005fb8', fontWeight: 700 }}>
          Centraal Object
        </span>
        <NodeCard
          node={centralNode}
          isCentral={true}
          onSelectCentral={onSelectCentral}
          onOpenEditor={onOpenEditor}
        />
      </div>

      {/* SCHEIDINGSLIJN */}
      <div style={{ width: '1px', height: '80%', backgroundColor: '#e0e0e0' }} />

      {/* KOLOM 3+: RECHTS (Uitgaande takken per niveau, gesorteerd op relation_value) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={{ fontSize: '0.75rem', color: '#777', fontWeight: 600 }}>
          Uitgaand (Boomstructuur)
        </span>
        {centralNode.children && centralNode.children.length > 0 ? (
          renderChildrenColumn(centralNode.children)
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#aaa', fontStyle: 'italic' }}>
            Geen sub-objecten
          </span>
        )}
      </div>
    </div>
  );
};