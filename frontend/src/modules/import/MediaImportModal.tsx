import React, { useState, useEffect } from 'react';
import { 
  ScanMediaDirectory, 
  ExecuteMediaImport, 
  SelectDirectory, 
  GetObjectsForSelect 
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import { EventsOn, EventsOff } from '../../../wailsjs/runtime/runtime';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportCompleted: () => void;
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
}

interface ObjectSelectItem {
  id: string;
  label: string;
}

// Extends Wails MediaImportItem met een selectie-status voor de UI
type SelectableMediaItem = main.MediaImportItem & {
  selected: boolean;
};

export const MediaImportModal: React.FC<Props> = ({ isOpen, onClose, onImportCompleted }) => {
  // Import Mode: 'GROUP' (Verzameling) of 'OBJECT' (Direct koppelen)
  const [importMode, setImportMode] = useState<'GROUP' | 'OBJECT'>('GROUP');
  
  // Velden voor Modus GROUP
  const [groupName, setGroupName] = useState('');
  
  // Velden voor Modus OBJECT
  const [objectSearch, setObjectSearch] = useState('');
  const [objectOptions, setObjectOptions] = useState<ObjectSelectItem[]>([]);
  const [selectedObjectID, setSelectedObjectID] = useState('');
  const [selectedObjectLabel, setSelectedObjectLabel] = useState('');
  const [isSearchingObjects, setIsSearchingObjects] = useState(false);

  // Algemene velden
  const [folderPath, setFolderPath] = useState('');
  const [items, setItems] = useState<SelectableMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Luister naar Go log-events zolang de modal geopend is
  useEffect(() => {
    if (!isOpen) return;

    const handleLog = (data: { level: LogEntry['level']; message: string }) => {
      const entry: LogEntry = {
        timestamp: new Date().toLocaleTimeString(),
        level: data.level,
        message: data.message,
      };
      setLogs((prev) => [...prev, entry]);
    };

    EventsOn('media-import-log', handleLog);

    return () => {
      EventsOff('media-import-log');
    };
  }, [isOpen]);

  // Objecten zoeken wanneer de gebruiker typt in de zoekbalk (met debounce)
  useEffect(() => {
    if (importMode !== 'OBJECT') return;

    const timer = setTimeout(async () => {
      setIsSearchingObjects(true);
      try {
        const results = await GetObjectsForSelect(objectSearch);
        setObjectOptions(results || []);
      } catch (err) {
        console.error("Fout bij ophalen objecten:", err);
      } finally {
        setIsSearchingObjects(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [objectSearch, importMode]);

  if (!isOpen) return null;

  // Native mappenkiezer openen via Go runtime
  const handleBrowseFolder = async () => {
    try {
      const selectedPath = await SelectDirectory();
      if (selectedPath) {
        setFolderPath(selectedPath);
        scanFolder(selectedPath);
      }
    } catch (err) {
      alert("Fout bij selecteren van map: " + err);
    }
  };

  // Map scannen op afbeeldings- en videobestanden
  const scanFolder = async (path: string) => {
    if (!path) return;
    setLoading(true);
    setLogs([]);
    try {
      const scannedItems = await ScanMediaDirectory(path);
      // Gebruik Object.assign om Wails klasse-methodes te behouden
      const selectable = (scannedItems || []).map((item) => {
        return Object.assign(item, { selected: true });
      }) as SelectableMediaItem[];

      setItems(selectable);
    } catch (err) {
      alert("Fout bij scannen van map: " + err);
    } finally {
      setLoading(false);
    }
  };

  // Selectie van één specifiek bestand in-/uitschakelen
  const handleToggleSelect = (index: number) => {
    const updated = [...items];
    updated[index].selected = !updated[index].selected;
    setItems(updated);
  };

  // Alles selecteren of deselecteren
  const handleSelectAll = (select: boolean) => {
    setItems((prevItems) => 
      prevItems.map((item) => Object.assign(item, { selected: select }) as SelectableMediaItem)
    );
  };

  // Handmatige wijziging van een bestemmingspad
  const handlePathChange = (index: number, newPath: string) => {
    const updated = [...items];
    updated[index].destinationPath = newPath;
    setItems(updated);
  };

  // Uitvoeren van de definitieve import
  const handleRunImport = async () => {
    if (importMode === 'GROUP' && !groupName.trim()) {
      alert("Voer een groepsnaam in voor de verzameling.");
      return;
    }
    if (importMode === 'OBJECT' && !selectedObjectID) {
      alert("Selecteer een doelobject om de media aan te koppelen.");
      return;
    }

    // Filter alleen de geselecteerde bestanden
    const selectedItems = items.filter((item) => item.selected);

    if (selectedItems.length === 0) {
      alert("Geen bestanden geselecteerd om te importeren. Vink minstens één bestand aan.");
      return;
    }

    setIsExecuting(true);
    try {
      // Converteer de geselecteerde items naar de door Wails verwachte array van MediaImportItem
      const payload: main.MediaImportItem[] = selectedItems.map(({ selected, ...rest }) => rest as main.MediaImportItem);

      await ExecuteMediaImport(
        importMode, 
        importMode === 'GROUP' ? groupName.trim() : '', 
        importMode === 'OBJECT' ? selectedObjectID : '', 
        payload
      );
      alert("Import succesvol voltooid!");
      onImportCompleted();
      onClose();
    } catch (err) {
      alert("Fout tijdens import: " + err);
    } finally {
      setIsExecuting(false);
    }
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'ERROR': return '#f87171';
      case 'WARN': return '#fbbf24';
      case 'SUCCESS': return '#4ade80';
      default: return '#cbd5e1';
    }
  };

  const selectedCount = items.filter((item) => item.selected).length;
  const isAllSelected = items.length > 0 && selectedCount === items.length;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '8px', width: '980px',
        maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '24px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)', color: '#1e293b'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px', color: '#0f172a' }}>📷 Media Import (Foto & Video)</h2>

        {/* MODE SELECTOR (TABS) */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
          <button
            onClick={() => setImportMode('GROUP')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              backgroundColor: importMode === 'GROUP' ? '#007acc' : '#f1f5f9',
              color: importMode === 'GROUP' ? '#ffffff' : '#475569'
            }}
          >
            1. Verzameling / Groepsimport
          </button>
          <button
            onClick={() => setImportMode('OBJECT')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              backgroundColor: importMode === 'OBJECT' ? '#007acc' : '#f1f5f9',
              color: importMode === 'OBJECT' ? '#ffffff' : '#475569'
            }}
          >
            2. Koppelen aan Specifiek Object
          </button>
        </div>

        {/* INPUT VELDEN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          
          {/* OPTIE 1: GROEPSNAAM */}
          {importMode === 'GROUP' && (
            <div>
              <label style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#334155' }}>Groepsnaam (Verzameling Media):</label>
              <input
                type="text"
                placeholder="bijv. Vakantie Italië 2025"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', backgroundColor: '#ffffff' }}
              />
            </div>
          )}

          {/* OPTIE 2: OBJECT SELECTIE MET FILTER */}
          {importMode === 'OBJECT' && (
            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block', marginBottom: '4px', color: '#334155' }}>
                Zoek en kies Doel-Object:
              </label>
              
              {selectedObjectID ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', flex: 1, color: '#0f172a' }}>
                    Geselecteerd Object: {selectedObjectLabel}
                  </span>
                  <button 
                    onClick={() => { setSelectedObjectID(''); setSelectedObjectLabel(''); }}
                    style={{ background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                  >
                    Wijzig
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="Typ om te filteren op objectnaam..."
                    value={objectSearch}
                    onChange={(e) => setObjectSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', backgroundColor: '#ffffff' }}
                  />
                  
                  <select
                    size={4}
                    style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem', color: '#0f172a', backgroundColor: '#ffffff' }}
                    onChange={(e) => {
                      const selectedOpt = objectOptions.find(o => o.id === e.target.value);
                      if (selectedOpt) {
                        setSelectedObjectID(selectedOpt.id);
                        setSelectedObjectLabel(selectedOpt.label);
                      }
                    }}
                  >
                    {isSearchingObjects ? (
                      <option disabled style={{ color: '#64748b' }}>Zoeken...</option>
                    ) : objectOptions.length === 0 ? (
                      <option disabled style={{ color: '#64748b' }}>Geen objecten gevonden</option>
                    ) : (
                      objectOptions.map((obj) => (
                        <option key={obj.id} value={obj.id} style={{ color: '#0f172a', padding: '4px' }}>
                          {obj.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* MAP SELECTIE */}
          <div>
            <label style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#334155' }}>Maplocatie op schijf:</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="Selecteer een map met foto's of video's..."
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#f8fafc', color: '#0f172a' }}
              />
              <button
                onClick={handleBrowseFolder}
                disabled={loading}
                style={{ padding: '8px 16px', background: '#475569', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                📁 Bladeren...
              </button>
              <button
                onClick={() => scanFolder(folderPath)}
                disabled={loading || !folderPath}
                style={{ padding: '8px 16px', background: '#007acc', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {loading ? 'Scannen...' : '🔍 Scannen'}
              </button>
            </div>
          </div>
        </div>

        {/* LIVE LOG TERMINAL */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#334155' }}>📟 Live Import & Scan Log:</span>
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Wis log
              </button>
            )}
          </div>
          <div style={{
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            padding: '10px',
            borderRadius: '6px',
            height: '110px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            {logs.length === 0 ? (
              <span style={{ color: '#64748b' }}>Wachten op actie... Klik op 'Bladeren...' of 'Scannen' om te starten.</span>
            ) : (
              logs.map((log, i) => (
                <div key={i}>
                  <span style={{ color: '#64748b' }}>[{log.timestamp}]</span>{' '}
                  <span style={{ color: getLogColor(log.level), fontWeight: 'bold' }}>[{log.level}]</span>{' '}
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PREVIEW TABEL MET SELECTIE OPTIES */}
        {items.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0, color: '#0f172a' }}>
                Gevonden bestanden ({selectedCount} van {items.length} geselecteerd)
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleSelectAll(true)}
                  style={{ background: '#e2e8f0', color: '#1e293b', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✓ Alles selecteren
                </button>
                <button
                  onClick={() => handleSelectAll(false)}
                  style={{ background: '#e2e8f0', color: '#1e293b', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✗ Alles deselecteren
                </button>
              </div>
            </div>

            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#ffffff', textAlign: 'left', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ padding: '8px', width: '38px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '8px', width: '60px' }}>Type</th>
                    <th style={{ padding: '8px' }}>Origineel Bestand</th>
                    <th style={{ padding: '8px' }}>Bestemmingspad (Relatief t.o.v. Media)</th>
                    <th style={{ padding: '8px', width: '110px' }}>Datum Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: !item.selected 
                          ? '#f1f5f9' 
                          : item.hasExactDate 
                          ? '#ffffff' 
                          : '#fffbe6', // Zachte warm-gele tint voor bestanden zonder EXIF
                        opacity: item.selected ? 1 : 0.6,
                        color: '#0f172a'
                      }}
                    >
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggleSelect(idx)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: item.mediaType === 'VIDEO' ? '#2563eb' : '#059669' }}>
                        {item.mediaType}
                      </td>
                      <td style={{ padding: '8px', fontWeight: '500', color: '#0f172a' }}>
                        {item.fileName}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="text"
                          value={item.destinationPath}
                          disabled={!item.selected}
                          onChange={(e) => handlePathChange(idx, e.target.value)}
                          style={{ 
                            width: '100%', 
                            padding: '4px 8px', 
                            fontSize: '0.8rem', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '4px',
                            color: '#0f172a',
                            backgroundColor: item.selected ? '#ffffff' : '#e2e8f0'
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        {item.hasExactDate ? (
                          <span style={{ color: '#16a34a', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            ✓ EXIF
                          </span>
                        ) : (
                          <span style={{ color: '#d97706', fontWeight: 'bold', backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                            ⚠️ Overgenomen
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ACTIE KNOPPEN */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button 
            onClick={onClose} 
            style={{ padding: '8px 16px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Annuleren
          </button>
          <button
            onClick={handleRunImport}
            disabled={isExecuting || selectedCount === 0}
            style={{
              padding: '8px 20px',
              background: selectedCount > 0 ? '#16a34a' : '#cbd5e1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            {isExecuting ? 'Importeren...' : `🚀 Start Import (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};