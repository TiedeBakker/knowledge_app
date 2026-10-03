import React, { useEffect, useState } from 'react';
import * as AppBindings from '../../wailsjs/go/main/App';

interface Props {
  isOpen: boolean;
  initialTab?: 'parameters' | 'units' | 'relations';
  onClose: () => void;
  onUpdated?: () => void;
}

export const MasterDataEditorModal: React.FC<Props> = ({
  isOpen,
  initialTab = 'parameters',
  onClose,
  onUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'parameters' | 'units' | 'relations'>(initialTab);

  // Datasets
  const [parameters, setParameters] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);

  // Edit states (Inline of Form)
  const [editingParam, setEditingParam] = useState<any | null>(null);
  const [editingUnit, setEditingUnit] = useState<any | null>(null);
  const [editingRelation, setEditingRelation] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadAllData();
    }
  }, [isOpen, initialTab]);

  const loadAllData = async () => {
    const bindings = AppBindings as any;
    try {
      if (typeof bindings.GetAllMasterParameters === 'function') {
        setParameters(await bindings.GetAllMasterParameters() || []);
      }
      if (typeof bindings.GetAllMasterUnits === 'function') {
        setUnits(await bindings.GetAllMasterUnits() || []);
      }
      if (typeof bindings.GetAllMasterRelations === 'function') {
        setRelations(await bindings.GetAllMasterRelations() || []);
      }
    } catch (err) {
      console.error('Fout bij ophalen basistabellen:', err);
    }
  };

  const handleSaveParam = async () => {
    if (!editingParam?.label || !editingParam?.code) return;
    try {
      await (AppBindings as any).SaveMasterParameter(editingParam);
      setEditingParam(null);
      await loadAllData();
      if (onUpdated) onUpdated();
    } catch (e) {
      alert('Opslaan parameter mislukt: ' + e);
    }
  };

  const handleSaveUnit = async () => {
    if (!editingUnit?.label || !editingUnit?.symbol) return;
    try {
      await (AppBindings as any).SaveMasterUnit(editingUnit);
      setEditingUnit(null);
      await loadAllData();
      if (onUpdated) onUpdated();
    } catch (e) {
      alert('Opslaan eenheid mislukt: ' + e);
    }
  };

  const handleSaveRelation = async () => {
    if (!editingRelation?.label) return;
    try {
      await (AppBindings as any).SaveMasterRelation(editingRelation);
      setEditingRelation(null);
      await loadAllData();
      if (onUpdated) onUpdated();
    } catch (e) {
      alert('Opslaan relatietype mislukt: ' + e);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff', borderRadius: '8px', width: '750px',
          maxWidth: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Beheer Basistabellen (Stamgegevens)</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* TAB STRIP */}
        <div style={{ display: 'flex', borderBottom: '2px solid #ddd', marginBottom: '15px' }}>
          <button
            onClick={() => setActiveTab('parameters')}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'parameters' ? 'bold' : 'normal',
              borderBottom: activeTab === 'parameters' ? '3px solid #007acc' : 'none',
              color: activeTab === 'parameters' ? '#007acc' : '#555'
            }}
          >
            Parameters ({parameters.length})
          </button>
          <button
            onClick={() => setActiveTab('units')}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'units' ? 'bold' : 'normal',
              borderBottom: activeTab === 'units' ? '3px solid #007acc' : 'none',
              color: activeTab === 'units' ? '#007acc' : '#555'
            }}
          >
            Eenheden ({units.length})
          </button>
          <button
            onClick={() => setActiveTab('relations')}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'relations' ? 'bold' : 'normal',
              borderBottom: activeTab === 'relations' ? '3px solid #007acc' : 'none',
              color: activeTab === 'relations' ? '#007acc' : '#555'
            }}
          >
            Relatietypes ({relations.length})
          </button>
        </div>

        {/* TAB INHOUD */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>

          {/* --- TAB 1: PARAMETERS --- */}
          {activeTab === 'parameters' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>Lijst van alle gedefinieerde parameters.</span>
                <button
                  onClick={() => setEditingParam({ id: '', label: '', code: '', dataType: 'string', unit: '' })}
                  style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  + Nieuwe Parameter
                </button>
              </div>

              {editingParam && (
                <div style={{ background: '#f0f8ff', border: '1px solid #007acc', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>{editingParam.id ? 'Parameter Bewerken' : 'Nieuwe Parameter'}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" placeholder="Label (bijv. Gewicht)" value={editingParam.label} onChange={e => setEditingParam({ ...editingParam, label: e.target.value })} style={{ padding: '6px' }} />
                    <input type="text" placeholder="Code (bijv. gewicht_g)" value={editingParam.code} onChange={e => setEditingParam({ ...editingParam, code: e.target.value })} style={{ padding: '6px' }} />
                    <select value={editingParam.dataType} onChange={e => setEditingParam({ ...editingParam, dataType: e.target.value })} style={{ padding: '6px' }}>
                      <option value="string">Tekst (string)</option>
                      <option value="number">Getal (number)</option>
                      <option value="boolean">Ja/Nee (boolean)</option>
                      <option value="date">Datum (date)</option>
                    </select>
                    <select value={editingParam.unit || ''} onChange={e => setEditingParam({ ...editingParam, unit: e.target.value })} style={{ padding: '6px' }}>
                      <option value="">-- Geen eenheid --</option>
                      {units.map(u => (
                        <option key={u.id} value={u.symbol}>{u.label} ({u.symbol})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingParam(null)} style={{ padding: '4px 8px' }}>Annuleren</button>
                    <button onClick={handleSaveParam} style={{ background: '#007acc', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px' }}>Opslaan</button>
                  </div>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: '6px' }}>Code</th>
                    <th style={{ padding: '6px' }}>Label</th>
                    <th style={{ padding: '6px' }}>Datatype</th>
                    <th style={{ padding: '6px' }}>Eenheid</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px' }}><strong>{p.code}</strong></td>
                      <td style={{ padding: '6px' }}>{p.label}</td>
                      <td style={{ padding: '6px' }}>{p.dataType}</td>
                      <td style={{ padding: '6px' }}>{p.unit || '-'}</td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>
                        <button onClick={() => setEditingParam({ ...p })} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✏️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* --- TAB 2: EENHEDEN --- */}
          {activeTab === 'units' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>Lijst van meeteenheden.</span>
                <button
                  onClick={() => setEditingUnit({ id: '', label: '', symbol: '' })}
                  style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  + Nieuwe Eenheid
                </button>
              </div>

              {editingUnit && (
                <div style={{ background: '#f0f8ff', border: '1px solid #007acc', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>{editingUnit.id ? 'Eenheid Bewerken' : 'Nieuwe Eenheid'}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" placeholder="Label (bijv. Gram)" value={editingUnit.label} onChange={e => setEditingUnit({ ...editingUnit, label: e.target.value })} style={{ padding: '6px' }} />
                    <input type="text" placeholder="Symbool (bijv. g)" value={editingUnit.symbol} onChange={e => setEditingUnit({ ...editingUnit, symbol: e.target.value })} style={{ padding: '6px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingUnit(null)} style={{ padding: '4px 8px' }}>Annuleren</button>
                    <button onClick={handleSaveUnit} style={{ background: '#007acc', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px' }}>Opslaan</button>
                  </div>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: '6px' }}>Label</th>
                    <th style={{ padding: '6px' }}>Symbool</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px' }}>{u.label}</td>
                      <td style={{ padding: '6px' }}><strong>{u.symbol}</strong></td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>
                        <button onClick={() => setEditingUnit({ ...u })} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✏️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* --- TAB 3: RELATIES --- */}
          {activeTab === 'relations' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>Lijst van relatietypes.</span>
                <button
                  onClick={() => setEditingRelation({ id: '', label: '' })}
                  style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  + Nieuw Relatietype
                </button>
              </div>

              {editingRelation && (
                <div style={{ background: '#f0f8ff', border: '1px solid #007acc', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>{editingRelation.id ? 'Relatietype Bewerken' : 'Nieuw Relatietype'}</h4>
                  <div style={{ marginBottom: '8px' }}>
                    <input type="text" placeholder="Label (bijv. bevat_onderdeel)" value={editingRelation.label} onChange={e => setEditingRelation({ ...editingRelation, label: e.target.value })} style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingRelation(null)} style={{ padding: '4px 8px' }}>Annuleren</button>
                    <button onClick={handleSaveRelation} style={{ background: '#007acc', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px' }}>Opslaan</button>
                  </div>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: '6px' }}>Label</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {relations.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px' }}><strong>{r.label}</strong></td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>
                        <button onClick={() => setEditingRelation({ ...r })} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✏️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', cursor: 'pointer' }}>Sluiten</button>
        </div>
      </div>
    </div>
  );
};