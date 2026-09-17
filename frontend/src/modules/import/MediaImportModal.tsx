import React, { useState, useEffect } from 'react';
import { ScanMediaDirectory, ExecuteMediaImport, SelectDirectory } from '../../../wailsjs/go/main/App';
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

export const MediaImportModal: React.FC<Props> = ({ isOpen, onClose, onImportCompleted }) => {
  const [folderPath, setFolderPath] = useState('');
  const [groupName, setGroupName] = useState('');
  const [items, setItems] = useState<main.MediaImportItem[]>([]);
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
      setItems(scannedItems || []);
    } catch (err) {
      alert("Fout bij scannen van map: " + err);
    } finally {
      setLoading(false);
    }
  };

  // Handmatige wijziging van een bestemmingspad in de preview-tabel
  const handlePathChange = (index: number, newPath: string) => {
    const updated = [...items];
    updated[index].destinationPath = newPath;
    setItems(updated);
  };

  // Uitvoeren van de definitieve import
  const handleRunImport = async () => {
    if (!groupName.trim()) {
      alert("Voer een groepsnaam in.");
      return;
    }
    if (items.length === 0) {
      alert("Geen bestanden om te importeren.");
      return;
    }

    setIsExecuting(true);
    try {
      await ExecuteMediaImport(groupName.trim(), items);
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

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '8px', width: '950px',
        maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <h2 style={{ marginTop: 0 }}>📷 Batch Media Import (Foto & Video)</h2>

        {/* INPUT VELDEN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Groepsnaam (Verzameling Media):</label>
            <input
              type="text"
              placeholder="bijv. Vakantie Italië 2025"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Maplocatie op schijf:</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="Selecteer een map met foto's of video's..."
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f9f9f9' }}
              />
              <button
                onClick={handleBrowseFolder}
                disabled={loading}
                style={{ padding: '8px 16px', background: '#4a5568', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                📁 Bladeren...
              </button>
              <button
                onClick={() => scanFolder(folderPath)}
                disabled={loading || !folderPath}
                style={{ padding: '8px 16px', background: '#007acc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {loading ? 'Scannen...' : '🔍 Scannen'}
              </button>
            </div>
          </div>
        </div>

        {/* LIVE LOG TERMINAL */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>📟 Live Import & Scan Log:</span>
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.75rem' }}
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
            height: '130px',
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

        {/* PREVIEW TABEL */}
        {items.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Gevonden bestanden ({items.length})</h3>
            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #ccc', textAlign: 'left', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '6px' }}>Type</th>
                    <th style={{ padding: '6px' }}>Origineel Bestand</th>
                    <th style={{ padding: '6px' }}>Bestemmingspad (Relatief t.o.v. Media)</th>
                    <th style={{ padding: '6px' }}>Datum Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #eee',
                        backgroundColor: item.hasExactDate ? '#ffffff' : '#fff8e1'
                      }}
                    >
                      <td style={{ padding: '6px', fontWeight: 'bold' }}>{item.mediaType}</td>
                      <td style={{ padding: '6px' }}>{item.fileName}</td>
                      <td style={{ padding: '6px' }}>
                        <input
                          type="text"
                          value={item.destinationPath}
                          onChange={(e) => handlePathChange(idx, e.target.value)}
                          style={{ width: '100%', padding: '4px', fontSize: '0.8rem', border: '1px solid #ccc', borderRadius: '3px' }}
                        />
                      </td>
                      <td style={{ padding: '6px' }}>
                        {item.hasExactDate ? (
                          <span style={{ color: '#2e7d32' }}>✓ EXIF</span>
                        ) : (
                          <span style={{ color: '#e65100', fontWeight: 'bold' }}>⚠️ Overgenomen</span>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', cursor: 'pointer' }}>Annuleren</button>
          <button
            onClick={handleRunImport}
            disabled={isExecuting || items.length === 0}
            style={{
              padding: '8px 20px',
              background: items.length > 0 ? '#2e7d32' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: items.length > 0 ? 'pointer' : 'default',
              fontWeight: 'bold'
            }}
          >
            {isExecuting ? 'Importeren...' : '🚀 Start Import'}
          </button>
        </div>
      </div>
    </div>
  );
};