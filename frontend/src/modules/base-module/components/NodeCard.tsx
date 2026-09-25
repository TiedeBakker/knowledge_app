// src/modules/base-module/components/NodeCard.tsx
import React from 'react';
import { GraphNode } from '../types/tree.types';

interface NodeCardProps {
  node: GraphNode;
  isCentral?: boolean;
  onSelectCentral: (id: string) => void;
  onOpenEditor: (node: GraphNode) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  isCentral = false,
  onSelectCentral,
  onOpenEditor,
}) => {
  // SPECIALE RENDER VOOR OVERFLOW/HAS-MORE FICHE
  if (node.hasMore) {
    return (
      <div
        onClick={() => onSelectCentral(node.id)}
        title="Klik om dit ouder-object centraal te stellen en alle sub-objecten te bekijken"
        style={{
          width: '180px',
          minHeight: '44px',
          padding: '8px 10px',
          backgroundColor: '#eef6ff',
          color: '#005fb8',
          borderRadius: '6px',
          border: '1.5px dashed #005fb8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: '0.8rem',
          transition: 'all 0.15s ease-in-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#005fb8';
          e.currentTarget.style.color = '#ffffff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#eef6ff';
          e.currentTarget.style.color = '#005fb8';
        }}
      >
        {node.label}
      </div>
    );
  }

  // STANDAARD FICHE
  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onOpenEditor(node);
    }
  };

  const handleDoubleClick = () => {
    onSelectCentral(node.id);
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={`${node.label}\n\n• Dubbelklik: Maak centraal\n• Ctrl + klik: Open details`}
      style={{
        width: '180px',
        minHeight: '52px',
        maxHeight: '64px',
        padding: '8px 10px',
        backgroundColor: isCentral ? '#005fb8' : '#ffffff',
        color: isCentral ? '#ffffff' : '#1a1a1a',
        borderRadius: '6px',
        border: isCentral ? '2px solid #003e78' : '1px solid #cccccc',
        boxShadow: isCentral
          ? '0 4px 10px rgba(0, 95, 184, 0.3)'
          : '0 2px 5px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        transition: 'all 0.15s ease-in-out',
      }}
      onMouseEnter={(e) => {
        if (!isCentral) {
          e.currentTarget.style.borderColor = '#005fb8';
          e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isCentral) {
          e.currentTarget.style.borderColor = '#cccccc';
          e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.08)';
        }
      }}
    >
      {node.relationType && !isCentral && (
        <span
          style={{
            fontSize: '0.65rem',
            color: '#666666',
            marginBottom: '2px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {node.relationType}
        </span>
      )}

      <div
        style={{
          fontSize: isCentral ? '0.85rem' : '0.8rem',
          fontWeight: isCentral ? 600 : 500,
          lineHeight: '1.2',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-word',
        }}
      >
        {node.label}
      </div>
    </div>
  );
};