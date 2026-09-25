import React, { useState, useEffect } from 'react';
import { DbTemplateRecord } from '../types/template.types';

interface TemplateEditorModalProps {
    templateId: string | null; // <-- Sta null toe
    onClose: () => void;
    onSave: (updatedRecord: Partial<DbTemplateRecord>) => Promise<void>;
    fetchTemplateById: (id: string) => Promise<DbTemplateRecord | null>;
}

export const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({
    templateId,
    onClose,
    onSave,
    fetchTemplateById,
}) => {
    const [label, setLabel] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [type, setType] = useState<string>('report');
    const [jsonText, setJsonText] = useState<string>('{\n  \n}');

    const [jsonError, setJsonError] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // Haal bestaande record op
    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            // Als er geen ID is (bijv. nieuw sjabloon), hoeven we niets op te halen
            if (!templateId) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setLoadError(null);
            try {
                const data = await fetchTemplateById(templateId);
                if (!isMounted) return;

                if (data) {
                    setLabel(data.label || '');
                    setDescription(data.description || '');
                    setType(data.type || 'report');

                    if (data.config_json) {
                        try {
                            const parsed = JSON.parse(data.config_json);
                            setJsonText(JSON.stringify(parsed, null, 2));
                        } catch {
                            setJsonText(data.config_json);
                        }
                    }
                } else {
                    setLoadError(`Geen template gevonden met ID: ${templateId}`);
                }
            } catch (err: any) {
                if (isMounted) {
                    setLoadError(err?.message || 'Fout bij het ophalen van de gegevens.');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, [templateId]);
    const handleJsonChange = (val: string) => {
        setJsonText(val);
        try {
            JSON.parse(val);
            setJsonError(null);
        } catch (err: any) {
            setJsonError(err.message || 'Ongeldige JSON-syntaxis');
        }
    };

const handleSave = async () => {
    if (jsonError) return;

    setIsSaving(true);
    try {
        const parsed = JSON.parse(jsonText);
        const minifiedJson = JSON.stringify(parsed);

        await onSave({
            ...(templateId ? { id: templateId } : {}), // Pas toevoegen als templateId niet null is
            label,
            description,
            type,
            config_json: minifiedJson,
            updated_at: new Date().toISOString(),
        });
        onClose();
    } catch (err) {
        alert(`Fout bij opslaan: ${err}`);
    } finally {
        setIsSaving(false);
    }
};
    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                handleJsonChange(text);
            }
        } catch {
            alert('Kon het klembord niet lezen. Gebruik Shift+Insert of Ctrl+V.');
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                {/* HEADER */}
                <div style={styles.header}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                            Template Editor ({templateId})
                        </h2>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>
                            Beheer de JSON-configuratie en metadata van het rapportagesjabloon
                        </span>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}>✕</button>
                </div>

                {/* BODY */}
                {isLoading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
                        Template gegevens laden...
                    </div>
                ) : loadError ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#d93025' }}>
                        ⚠️ {loadError}
                    </div>
                ) : (
                    <div style={styles.body}>
                        {/* METADATA VELDEN */}
                        <div style={styles.row}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                <label style={styles.label}>Label</label>
                                <input
                                    type="text"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    style={styles.input}
                                />
                            </div>
                            <div style={{ width: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={styles.label}>Type</label>
                                <input
                                    type="text"
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    style={styles.input}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={styles.label}>Omschrijving</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                style={styles.input}
                            />
                        </div>

                        {/* EDITOR GEBIED */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <label style={styles.label}>Configuratie JSON (`config_json`)</label>
                                    <button
                                        type="button"
                                        onClick={handlePasteFromClipboard}
                                        style={styles.pasteBtn}
                                    >
                                        📋 Plakken uit klembord
                                    </button>
                                </div>

                                {jsonError ? (
                                    <span style={{ fontSize: '0.75rem', color: '#d93025', fontWeight: 600 }}>
                                        ⚠️ {jsonError}
                                    </span>
                                ) : (
                                    <span style={{ fontSize: '0.75rem', color: '#1e8e3e', fontWeight: 600 }}>
                                        ✓ Geldige JSON
                                    </span>
                                )}
                            </div>
                            <textarea
                                value={jsonText}
                                onChange={(e) => handleJsonChange(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                                onPaste={(e) => {
                                    e.stopPropagation();
                                    const pastedData = e.clipboardData.getData('text');
                                    if (pastedData) {
                                        setTimeout(() => handleJsonChange(pastedData), 0);
                                    }
                                }}
                                style={{
                                    ...styles.textarea,
                                    borderColor: jsonError ? '#d93025' : '#ccc',
                                }}
                                spellCheck={false}
                            />
                        </div>
                    </div>
                )}

                {/* FOOTER */}
                <div style={styles.footer}>
                    <button onClick={onClose} style={styles.cancelBtn}>
                        Annuleren
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!!jsonError || isSaving || isLoading || !!loadError}
                        style={{
                            ...styles.saveBtn,
                            opacity: jsonError || isSaving || isLoading || !!loadError ? 0.6 : 1,
                            cursor: jsonError || isSaving || isLoading || !!loadError ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isSaving ? 'Opslaan...' : 'Sjabloon Opslaan'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modal: {
        backgroundColor: '#fff',
        borderRadius: '6px',
        width: '800px',
        maxWidth: '90vw',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
    },
    header: {
        padding: '16px 20px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        fontSize: '1.2rem',
        cursor: 'pointer',
        color: '#666',
    },
    body: {
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        flex: 1,
        overflowY: 'auto',
    },
    row: {
        display: 'flex',
        gap: '16px',
    },
    label: {
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#444',
    },
    input: {
        padding: '6px 10px',
        fontSize: '0.85rem',
        borderRadius: '4px',
        border: '1px solid #ccc',
    },
    textarea: {
        flex: 1,
        minHeight: '300px',
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        fontSize: '0.85rem',
        padding: '12px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        lineHeight: '1.4',
        resize: 'none',
    },
    pasteBtn: {
        padding: '2px 8px',
        fontSize: '0.75rem',
        borderRadius: '3px',
        border: '1px solid #ccc',
        backgroundColor: '#f0f0f0',
        cursor: 'pointer',
    },
    footer: {
        padding: '12px 20px',
        backgroundColor: '#f8f9fa',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
    },
    cancelBtn: {
        padding: '8px 16px',
        fontSize: '0.85rem',
        borderRadius: '4px',
        border: '1px solid #ccc',
        backgroundColor: '#fff',
        cursor: 'pointer',
    },
    saveBtn: {
        padding: '8px 16px',
        fontSize: '0.85rem',
        borderRadius: '4px',
        border: '1px solid #005fb8',
        backgroundColor: '#005fb8',
        color: '#fff',
        fontWeight: 500,
    },
};