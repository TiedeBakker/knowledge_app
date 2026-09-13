import React, { useEffect, useState } from 'react';
import './NodeEditorModal.css';
import { GetParametersForTarget, GetRelationsForTarget } from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { RelationEditorModal } from './RelationEditorModal';
import { getInboundRelationLabel, getOutboundRelationLabel } from '../utils/relationUtils';

interface Props {
  node: main.ObjectEntity | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedNode: main.ObjectEntity) => Promise<void> | void;
}

const isoToLocalDatetime = (isoStr?: string | null): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};

const localDatetimeToIso = (localStr: string): string | undefined => {
  if (!localStr) return undefined;
  const d = new Date(localStr);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
};

export const NodeEditorModal: React.FC<Props> = ({ node, isOpen, onClose, onSave }) => {
  const [initialData, setInitialData] = useState<main.ObjectEntity | null>(null);
  const [formData, setFormData] = useState<main.ObjectEntity | null>(null);

  // States voor Parameters & Relaties
  const [parameters, setParameters] = useState<main.ParameterValueEntity[]>([]);
  const [relations, setRelations] = useState<main.RelationValueEntity[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // State voor de RelationEditorModal
  const [selectedRelation, setSelectedRelation] = useState<main.RelationValueEntity | null>(null);
  const [isRelationModalOpen, setIsRelationModalOpen] = useState<boolean>(false);
  const [fixedSourceId, setFixedSourceId] = useState<string | undefined>(undefined);
  const [fixedTargetId, setFixedTargetId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (node && isOpen) {
      setInitialData({ ...node });
      setFormData({ ...node });

      setLoadingDetails(true);

      // Parallel parameters en relaties ophalen uit SQLite
      Promise.all([
        GetParametersForTarget(node.id),
        GetRelationsForTarget(node.id)
      ])
        .then(([params, rels]) => {
          setParameters(params || []);
          setRelations(rels || []);
        })
        .catch((err) => console.error("Fout bij ophalen details:", err))
        .finally(() => setLoadingDetails(false));
    }
  }, [node, isOpen]);

  if (!isOpen || !formData || !initialData) return null;

  const isFieldModified = (key: keyof main.ObjectEntity): boolean => {
    return formData[key] !== initialData[key];
  };

  const getInputStyle = (isModified: boolean, baseStyle: React.CSSProperties = {}) => ({
    width: '100%',
    padding: '6px 8px',
    border: isModified ? '1.5px solid #ffa726' : '1px solid #ccc',
    backgroundColor: isModified ? '#fffde7' : '#ffffff',
    borderRadius: '4px',
    boxSizing: 'border-box' as const,
    transition: 'all 0.2s ease',
    ...baseStyle
  });

  const handleCopyId = () => {
    if (formData.id) {
      navigator.clipboard.writeText(formData.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveAttributes = async () => {
    if (!formData) return;

    const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialData);
    const now = new Date().toISOString();

    const updatedNode: main.ObjectEntity = {
      ...formData,
      updatedAt: hasChanges ? now : formData.updatedAt
    };

    if (onSave) {
      await onSave(updatedNode);
    }

    setInitialData({ ...updatedNode });
    setFormData({ ...updatedNode });
  };

  const isLabelModified = isFieldModified('label');
  const isConfidentialModified = isFieldModified('isConfidential');
  const isValidFromModified = isFieldModified('validFrom');
  const isValidToModified = isFieldModified('validTo');
  const isDeletedAtModified = isFieldModified('deletedAt');

  const hasAnyAttributeChanged = isLabelModified || isConfidentialModified || isValidFromModified || isValidToModified || isDeletedAtModified;

  // Splits relaties in Inkomend en Uitgaand
  const inboundRelations = relations.filter((r) => r.targetId === formData.id);
  const outboundRelations = relations.filter((r) => r.sourceId === formData.id);

  const refreshRelations = () => {
    if (formData?.id) {
      GetRelationsForTarget(formData.id).then((rels) => setRelations(rels || []));
    }
  };

  // Handlers voor Toevoegen knoppen
  const handleAddInbound = () => {
    setSelectedRelation(null);
    setFixedSourceId(undefined);
    setFixedTargetId(formData.id); // Vastzetten als Target (inkomend)
    setIsRelationModalOpen(true);
  };

  const handleAddOutbound = () => {
    setSelectedRelation(null);
    setFixedSourceId(formData.id); // Vastzetten als Source (uitgaand)
    setFixedTargetId(undefined);
    setIsRelationModalOpen(true);
  };

  const handleEditRelation = (rel: main.RelationValueEntity) => {
    setSelectedRelation(rel);
    setFixedSourceId(undefined);
    setFixedTargetId(undefined);
    setIsRelationModalOpen(true);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }} onClick={onClose}>

      <div style={{
        backgroundColor: '#ffffff', borderRadius: '8px', width: '950px',
        maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)', color: '#333'
      }} onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '12px', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>Node Editor: {formData.label || 'Onbekend'}</h2>
          <button onClick={onClose} style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.5rem' }}>✕</button>
        </div>

        {/* BODY LAYOUT */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>

          {/* KOLOM 1: INKOMEND */}
          <div style={{ flex: 1, border: '1px solid #e0e0e0', borderRadius: '6px', padding: '16px', background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#2e7d32' }}>◄ Inkomend</h3>
              <button onClick={handleAddInbound} style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>+ Toevoegen</button>
            </div>
            {inboundRelations.map((rel) => (
              <div
                key={rel.id}
                onClick={() => handleEditRelation(rel)}
                style={{ padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', marginBottom: '6px' }}
              >
                {/* Gebruik van de ingaande omschrijving (1e deel van 'ingaand|uitgaand') */}
                <div style={{ fontWeight: 'bold', color: '#007acc' }}>
                  {getInboundRelationLabel(rel.relationLabel)} ✏️
                </div>
                <div style={{ fontSize: '0.8rem' }}>Van: <strong>{rel.sourceLabel || rel.sourceId}</strong></div>
              </div>
            ))}
          </div>

          {/* KOLOM 2: OBJECT ATTRIBUTEN */}
          <div style={{ flex: 1.2, border: '1px solid #e0e0e0', borderRadius: '6px', padding: '16px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Object Attributen</h3>
              <button
                onClick={handleSaveAttributes}
                disabled={!hasAnyAttributeChanged}
                style={{
                  padding: '4px 12px',
                  background: hasAnyAttributeChanged ? '#007acc' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: hasAnyAttributeChanged ? 'pointer' : 'default',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  transition: 'background-color 0.2s ease'
                }}
              >
                {hasAnyAttributeChanged ? 'Attributen Opslaan *' : 'Opslaan'}
              </button>
            </div>

            {/* ID */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>ID (UUIDv7):</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={formData.id || ''}
                  disabled
                  style={{ flex: 1, padding: '6px 8px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }}
                />
                <button onClick={handleCopyId} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>
                  {copied ? '✓ Gekopieerd' : '📋 Kopiëren'}
                </button>
              </div>
            </div>

            {/* LABEL */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                Label {isLabelModified && <span style={{ color: '#ffa726' }}>(gewijzigd)</span>}
              </label>
              <input
                type="text"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                style={getInputStyle(isLabelModified)}
              />
            </div>

            {/* IS CONFIDENTIAL */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 6px',
              backgroundColor: isConfidentialModified ? '#fffde7' : 'transparent',
              borderRadius: '4px',
              border: isConfidentialModified ? '1px solid #ffa726' : '1px solid transparent'
            }}>
              <input
                type="checkbox"
                id="chkConfidential"
                checked={Boolean(formData.isConfidential)}
                onChange={(e) => setFormData({ ...formData, isConfidential: e.target.checked })}
              />
              <label htmlFor="chkConfidential" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                Vertrouwelijk (isConfidential) {isConfidentialModified && <span style={{ color: '#ffa726' }}>(gewijzigd)</span>}
              </label>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '4px 0' }} />

            {/* VALID FROM */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                Geldig vanaf (validFrom) {isValidFromModified && <span style={{ color: '#ffa726' }}>(gewijzigd)</span>}:
              </label>
              <input
                type="datetime-local"
                value={isoToLocalDatetime(formData.validFrom)}
                onChange={(e) => setFormData({ ...formData, validFrom: localDatetimeToIso(e.target.value) || '' })}
                style={getInputStyle(isValidFromModified)}
              />
            </div>

            {/* VALID TO */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                Geldig tot (validTo) {isValidToModified && <span style={{ color: '#ffa726' }}>(gewijzigd)</span>}:
              </label>
              <input
                type="datetime-local"
                value={isoToLocalDatetime(formData.validTo)}
                onChange={(e) => setFormData({ ...formData, validTo: localDatetimeToIso(e.target.value) })}
                style={getInputStyle(isValidToModified)}
              />
            </div>

            {/* DELETED AT */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                Verwijderd op (deletedAt) {isDeletedAtModified && <span style={{ color: '#ffa726' }}>(gewijzigd)</span>}:
              </label>
              <input
                type="datetime-local"
                value={isoToLocalDatetime(formData.deletedAt)}
                onChange={(e) => setFormData({ ...formData, deletedAt: localDatetimeToIso(e.target.value) })}
                style={getInputStyle(isDeletedAtModified)}
              />
            </div>

          </div>

          {/* KOLOM 3: UITGAAND */}
          <div style={{ flex: 1, border: '1px solid #e0e0e0', borderRadius: '6px', padding: '16px', background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#c62828' }}>► Uitgaand</h3>
              <button onClick={handleAddOutbound} style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>+ Toevoegen</button>
            </div>
            {outboundRelations.map((rel) => (
              <div
                key={rel.id}
                onClick={() => handleEditRelation(rel)}
                style={{ padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', marginBottom: '6px' }}
              >
                {/* Gebruik van de uitgaande omschrijving (2e deel van 'ingaand|uitgaand') */}
                <div style={{ fontWeight: 'bold', color: '#007acc' }}>
                  {getOutboundRelationLabel(rel.relationLabel)} ✏️
                </div>
                <div style={{ fontSize: '0.8rem' }}>Naar: <strong>{rel.targetLabel || rel.targetId}</strong></div>
              </div>
            ))}
          </div>

        </div>

        {/* PARAMETERS TABEL */}
        <div style={{ border: '1px solid #e0e0e0', borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Parameters & Metingen</h3>
          {loadingDetails ? (
            <p style={{ fontSize: '0.85rem' }}>Laden...</p>
          ) : parameters.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                  <th style={{ padding: '6px' }}>Code</th>
                  <th style={{ padding: '6px' }}>Label</th>
                  <th style={{ padding: '6px' }}>Waarde</th>
                  <th style={{ padding: '6px' }}>Eenheid</th>
                </tr>
              </thead>
              <tbody>
                {parameters.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px' }}><strong>{p.parameterCode}</strong></td>
                    <td style={{ padding: '6px' }}>{p.parameterLabel}</td>
                    <td style={{ padding: '6px' }}>{p.value}</td>
                    <td style={{ padding: '6px' }}>{p.unit || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: '0.85rem', color: '#888', margin: 0 }}>Geen parameters gekoppeld.</p>
          )}
        </div>

        {/* FOOTER BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Sluiten / Annuleren
          </button>
        </div>

        {/* MODAL PLACEHOLDER ONDERAAN RENDEREN */}
        <RelationEditorModal
          isOpen={isRelationModalOpen}
          relation={selectedRelation}
          fixedSourceId={fixedSourceId}
          fixedTargetId={fixedTargetId}
          onClose={() => setIsRelationModalOpen(false)}
          onSaved={refreshRelations}
        />

      </div>
    </div>
  );
};