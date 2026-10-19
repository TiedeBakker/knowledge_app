import React, { useState } from 'react';
import { BatchCreateSubObjects } from '../../wailsjs/go/main/App';

interface Props {
  isOpen: boolean;
  parentId: string;
  parentLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

type SubObjectTypeTab = 'tekstitem'; // Hier kunnen we straks 'afbeelding', 'bijlage', etc. aan toevoegen

export const BatchSubObjectModal: React.FC<Props> = ({
  isOpen,
  parentId,
  parentLabel,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<SubObjectTypeTab>('tekstitem');

  // State voor TAB 1: Tekstitems
  const [count, setCount] = useState<number>(1);
  const [baseLabel, setBaseLabel] = useState<string>('Paragraaf');
  const [paramValue, setParamValue] = useState<string>('<p>Tekstblok</p>');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCreateTekstitems = async () => {
    if (!parentId || count <= 0) return;
    setIsLoading(true);
    try {
      const resultCount = await BatchCreateSubObjects({
        parentId: parentId,
        count: Number(count),
        baseLabel: baseLabel.trim() || 'Paragraaf',
        relationID: '01a03afa-fa76-76de-a973-18d94bc873e3', // "is een uitwerking van"
        objectTypeID: '01a144fd-8c55-7d92-baa1-0a0716ce60fb', // "tekstitem"
        parameterID: '01a0d3ba-c761-755a-b6c4-537c29a5e902', // "Tekstblok"
        parameterValue: paramValue,
      });

      console.log(`Succesvol ${resultCount} tekstitems aangemaakt!`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Fout bij batch aanmaken sub-objecten:', err);
      alert('Fout bij aanmaken: ' + err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1150,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          width: '550px',
          maxWidth: '90%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          color: '#333',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Sub-object(en) Toevoegen</h3>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>Aan: <strong>{parentLabel}</strong></span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* TAB STRIP */}
        <div style={{ display: 'flex', borderBottom: '2px solid #ddd', marginBottom: '16px' }}>
          <button
            onClick={() => setActiveTab('tekstitem')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'tekstitem' ? 'bold' : 'normal',
              borderBottom: activeTab === 'tekstitem' ? '3px solid #007acc' : 'none',
              color: activeTab === 'tekstitem' ? '#007acc' : '#555',
            }}
          >
            📝 Tekstitem
          </button>
          {/* Ruimte gereserveerd voor toekomstige tabbladen */}
        </div>

        {/* TAB INHOUD */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'tekstitem' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  Aantal tekstitems:
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                  style={{ width: '100%', padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  Basislabel (voorvoegsel):
                </label>
                <input
                  type="text"
                  value={baseLabel}
                  onChange={(e) => setBaseLabel(e.target.value)}
                  placeholder="bijv. Paragraaf of Hoofdstuk"
                  style={{ width: '100%', padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  Standaard inhoud (Tekstblok HTML):
                </label>
                <textarea
                  value={paramValue}
                  onChange={(e) => setParamValue(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '6px',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
          <button onClick={onClose} style={{ padding: '6px 12px', cursor: 'pointer' }}>
            Annuleren
          </button>
          <button
            onClick={handleCreateTekstitems}
            disabled={isLoading}
            style={{
              background: '#007acc',
              color: '#fff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Aanmaken...' : `Voeg ${count} ${count === 1 ? 'tekstitem' : 'tekstitems'} toe`}
          </button>
        </div>
      </div>
    </div>
  );
};