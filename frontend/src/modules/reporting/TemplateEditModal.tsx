import React, { useState } from 'react';
import { ReportTemplate } from '../../types/report';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: ReportTemplate) => void;
  initialTemplate?: ReportTemplate;
}

export const TemplateEditModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialTemplate }) => {
  const [jsonString, setJsonString] = useState<string>(
    JSON.stringify(
      initialTemplate || {
        id: `template_${Date.now()}`,
        name: 'Nieuw Stuurbestand',
        pageSize: 'A4',
        orientation: 'portrait',
        maxLevels: 3,
        contentParameterKey: 'toelichting',
        hierarchyRules: [
          { level: 0, fontSize: 22, pageBreakBefore: false },
          { level: 1, fontSize: 16, pageBreakBefore: true },
          { level: 2, fontSize: 12, pageBreakBefore: false }
        ]
      },
      null,
      2
    )
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonString) as ReportTemplate;
      if (!parsed.id || !parsed.name) {
        throw new Error("JSON moet minimaal een 'id' en 'name' hebben.");
      }
      setError(null);
      onSave(parsed);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ongeldige JSON format');
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0 }}>Stuurbestand Bewerken / Toevoegen</h3>
        
        {error && <div style={errorStyle}>{error}</div>}

        <textarea
          style={textareaStyle}
          value={jsonString}
          onChange={(e) => setJsonString(e.target.value)}
          rows={15}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button onClick={onClose} style={buttonSecondary}>Annuleren</button>
          <button onClick={handleSave} style={buttonPrimary}>Opslaan</button>
        </div>
      </div>
    </div>
  );
};

// Inline styling volgens je UI-conventies
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};

const modalStyle: React.CSSProperties = {
  background: '#fff', padding: '20px', borderRadius: '8px', width: '600px', maxWidth: '90%'
};

const textareaStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'monospace', fontSize: '12px', padding: '8px', boxSizing: 'border-box'
};

const errorStyle: React.CSSProperties = {
  color: 'red', marginBottom: '8px', fontSize: '13px'
};

const buttonPrimary: React.CSSProperties = {
  padding: '6px 12px', backgroundColor: '#0066cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'
};

const buttonSecondary: React.CSSProperties = {
  padding: '6px 12px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer'
};