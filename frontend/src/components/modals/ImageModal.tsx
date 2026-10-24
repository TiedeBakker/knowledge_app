import React, { useState, useEffect } from 'react';
import { NodeSearchSelect } from '../NodeSearchSelect';
import { main } from '../../../wailsjs/go/models';

export interface ImageModalData {
  mediaId: string;
  layout: 'inline-left' | 'inline-right' | 'inline-center' | 'span-all';
  caption: string;
}

interface ImageModalProps {
  isOpen: boolean;
  initialData?: ImageModalData | null;
  onClose: () => void;
  onSave: (data: ImageModalData) => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  initialData,
  onClose,
  onSave,
}) => {
  const [selectedNode, setSelectedNode] = useState<main.ObjectEntity | null>(null);
  const [layout, setLayout] = useState<ImageModalData['layout']>('inline-left');
  const [caption, setCaption] = useState<string>('');

  useEffect(() => {
    if (initialData) {
      setLayout(initialData.layout || 'inline-left');
      setCaption(initialData.caption || '');
      if (initialData.mediaId) {
        setSelectedNode(
          new main.ObjectEntity({
            id: initialData.mediaId,
            label: `Foto: ${initialData.mediaId}`,
          })
        );
      }
    } else {
      setSelectedNode(null);
      setLayout('inline-left');
      setCaption('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!selectedNode) {
      alert('Selecteer eerst een Foto-object.');
      return;
    }

    onSave({
      mediaId: selectedNode.id,
      layout,
      caption,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          width: '520px',
          maxWidth: '90%',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>
          {initialData ? 'Afbeelding bewerken' : 'Foto-object invoegen'}
        </h2>

        {/* 1. SELECTIE VIA NODESEARCHSELECT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
            Foto-object
          </label>
          <NodeSearchSelect
            value={selectedNode}
            onSelectNode={(node) => setSelectedNode(node)}
            placeholder="Zoek een Foto-object (bijv. Foto: kever)..."
            filterNode={(node) => {
              const lbl = (node.label || '').trim().toUpperCase();
              return lbl.startsWith('FOTO:');
            }}
          />
        </div>

        {/* 2. WEERGAVE & UITLIJNING */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
            Weergave & Uitlijning
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { id: 'inline-left', label: '👈 Links (50%)' },
              { id: 'inline-right', label: '👉 Rechts (50%)' },
              { id: 'inline-center', label: '↔️ Midden (80%)' },
              { id: 'span-all', label: '↔️ Volle breedte (100%)' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLayout(item.id as ImageModalData['layout'])}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: layout === item.id ? '2px solid #005fb8' : '1px solid #ccc',
                  backgroundColor: layout === item.id ? '#e6f2ff' : '#fff',
                  color: layout === item.id ? '#005fb8' : '#333',
                  fontWeight: layout === item.id ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. ONDERTITEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
            Ondertitel (Bijschrift)
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Voer een optionele ondertitel in..."
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '0.9rem',
            }}
          />
        </div>

        {/* ACTIEKNOPPEN */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              backgroundColor: '#fff',
              cursor: 'pointer',
            }}
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#005fb8',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {initialData ? 'Bijwerken' : 'Invoegen'}
          </button>
        </div>
      </div>
    </div>
  );
};