import React, { useState, useEffect } from 'react';
import { main } from '../../wailsjs/go/models';
import { ParameterSearchSelect, ParameterOption } from './ParameterSearchSelect';
import { SaveParameterValue, OpenFile } from '../../wailsjs/go/main/App'; // <- Importeer OpenFile
import { isoToLocalDatetime, localDatetimeToIso } from '../utils/dateUtils';
import { RichTextEditorModal } from './RichTextEditorModal';
import { Edit3, ExternalLink, FileText } from 'lucide-react';

interface Props {
    isOpen: boolean;
    targetId: string;
    targetType: 'object' | 'relation_value';
    initialValue?: main.ParameterValueEntity | null;
    isMeetwaardeMode?: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export const ParameterValueEditorModal: React.FC<Props> = ({
    isOpen,
    targetId,
    targetType,
    initialValue,
    isMeetwaardeMode = false,
    onClose,
    onSaved,
}) => {
    const [selectedParam, setSelectedParam] = useState<ParameterOption | null>(null);
    const [value, setValue] = useState<string>('');
    const [validFromLocal, setValidFromLocal] = useState<string>('');
    const [validToLocal, setValidToLocal] = useState<string>('');
    const [isConfidential, setIsConfidential] = useState<boolean>(false);
    const [isRichTextOpen, setIsRichTextOpen] = useState<boolean>(false);

    useEffect(() => {
        if (isOpen) {
            if (initialValue) {
                setValue(initialValue.value || '');
                setValidFromLocal(isoToLocalDatetime(initialValue.validFrom));
                setValidToLocal(isoToLocalDatetime(initialValue.validTo));
                setIsConfidential(initialValue.isConfidential || false);

                const rawDataType =
                    (initialValue as any).dataType ||
                    (initialValue as any).dataTypeCode ||
                    (initialValue as any).data_type ||
                    'string';

                setSelectedParam({
                    value: initialValue.parameterId,
                    label: `${initialValue.parameterLabel || 'Parameter'} (${initialValue.parameterCode || ''})`,
                    code: initialValue.parameterCode || '',
                    unit: initialValue.unit || undefined,
                    dataType: String(rawDataType).toLowerCase(),
                });
            } else {
                setValue('');
                setValidFromLocal(isoToLocalDatetime(new Date().toISOString()));
                setValidToLocal('');
                setIsConfidential(false);
                setSelectedParam(null);
            }
        }
    }, [initialValue, isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!selectedParam) return;

        const isoValidFrom = localDatetimeToIso(validFromLocal) || new Date().toISOString();
        const isoValidTo = isMeetwaardeMode ? isoValidFrom : localDatetimeToIso(validToLocal);

        const record: main.ParameterValueEntity = new main.ParameterValueEntity({
            id: initialValue?.id || '',
            parameterId: selectedParam.value,
            targetId: targetId,
            targetType: targetType,
            value: value,
            isConfidential: isConfidential,
            validFrom: isoValidFrom,
            validTo: isoValidTo,
            updatedAt: new Date().toISOString(),
        });

        try {
            await SaveParameterValue(record);
            onSaved();
            onClose();
        } catch (err) {
            console.error("Fout bij opslaan parameterwaarde:", err);
        }
    };

    // Help-functie om het bestand te openen via Go
    const handleOpenFile = async () => {
        if (!value) return;
        try {
            await OpenFile(value);
        } catch (err) {
            alert(`Kon bestand niet openen: ${err}`);
        }
    };

    const currentDataType = selectedParam?.dataType?.toLowerCase() || 'string';
    const isMarkdown = ['markdown', 'richtext', 'html'].includes(currentDataType);
    const isFile = currentDataType === 'file';

    // Helper functie voor de weergave van relatieve paden
    const getRelativePathPreview = (val: string): string => {
        if (!val) return '';

        if (val.startsWith('http://localhost/DArchieven')) {
            return val.replace('http://localhost/DArchieven', '../DArchieven');
        }

        // Herken "2024/W29/..." met een reguliere expressie
        if (/^\d{4}\/W\d{1,2}\//.test(val)) {
            return `../media/${val}`;
        }

        return val;
    };

    return (
        <>
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1100
            }}>
                <div style={{
                    background: '#fff', padding: '20px', borderRadius: '8px',
                    width: '480px', display: 'flex', flexDirection: 'column', gap: '12px',
                    color: '#1e293b', fontFamily: 'sans-serif'
                }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                        {initialValue ? 'Parameterwaarde Bewerken' : 'Parameterwaarde Toevoegen'}
                    </h3>

                    {!initialValue && (
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Parameter</label>
                            <ParameterSearchSelect onSelect={(opt) => setSelectedParam(opt)} />
                        </div>
                    )}

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                                Waarde {selectedParam?.unit ? `(${selectedParam.unit})` : ''}
                            </label>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                type: {currentDataType}
                            </span>
                        </div>

                        {/* A. WEERGAVE VOOR MARKDOWN */}
                        {isMarkdown && (
                            <div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsRichTextOpen(true);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
                                        background: '#007acc', color: '#fff', border: 'none', borderRadius: '4px',
                                        cursor: 'pointer', fontSize: '0.85rem', width: '100%', justifyContent: 'center'
                                    }}
                                >
                                    <Edit3 size={16} />
                                    {value ? 'Opgemaakte tekst bewerken...' : 'Opgemaakte tekst invoeren...'}
                                </button>

                                {value && (
                                    <div
                                        style={{
                                            marginTop: '6px', padding: '8px', background: '#f8fafc',
                                            border: '1px solid #e2e8f0', borderRadius: '4px',
                                            maxHeight: '100px', overflowY: 'auto', fontSize: '0.8rem', color: '#475569'
                                        }}
                                        dangerouslySetInnerHTML={{ __html: value }}
                                    />
                                )}
                            </div>
                        )}

                        {/* B. WEERGAVE VOOR BESTANDEN (FILE) */}
                        {isFile && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    placeholder="2024/W29/... of http://localhost/DArchieven/..."
                                    style={{ width: '100%', padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                />

                                {value && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                            <FileText size={16} style={{ color: '#007acc', flexShrink: 0 }} />
                                            <span
                                                style={{ fontSize: '0.75rem', color: '#475569', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                                                title={getRelativePathPreview(value)}
                                            >
                                                {getRelativePathPreview(value)}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleOpenFile}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
                                                background: '#ffffff', border: '1px solid #007acc', color: '#007acc',
                                                borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, flexShrink: 0
                                            }}
                                            title="Open bestand in standaard viewer"
                                        >
                                            <ExternalLink size={14} />
                                            Openen
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* C. WEERGAVE VOOR OVERIGE DATATYPES (STRING, NUMERIC, ETC.) */}
                        {!isMarkdown && !isFile && (
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                style={{ width: '100%', padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            />
                        )}
                    </div>

                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {isMeetwaardeMode ? 'Tijdstip meting' : 'Geldig vanaf (validFrom)'}
                        </label>
                        <input
                            type="datetime-local"
                            value={validFromLocal}
                            onChange={(e) => setValidFromLocal(e.target.value)}
                            style={{ width: '100%', padding: '6px', marginTop: '4px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                    </div>

                    {!isMeetwaardeMode && (
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Geldig tot (validTo)</label>
                            <input
                                type="datetime-local"
                                value={validToLocal}
                                onChange={(e) => setValidToLocal(e.target.value)}
                                style={{ width: '100%', padding: '6px', marginTop: '4px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            />
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="checkbox"
                            id="paramConfidential"
                            checked={isConfidential}
                            onChange={(e) => setIsConfidential(e.target.checked)}
                        />
                        <label htmlFor="paramConfidential" style={{ fontSize: '0.85rem' }}>Vertrouwelijk</label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                        <button onClick={onClose} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
                            Annuleren
                        </button>
                        <button onClick={handleSave} style={{ padding: '6px 12px', background: '#007acc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            Opslaan
                        </button>
                    </div>
                </div>
            </div>

            <RichTextEditorModal
                isOpen={isRichTextOpen}
                onClose={() => setIsRichTextOpen(false)}
                initialValue={value}
                title={`Tekst bewerken voor ${selectedParam?.label || 'Parameter'}`}
                onSave={(htmlContent: string) => {
                    setValue(htmlContent);
                }}
            />
        </>
    );
};