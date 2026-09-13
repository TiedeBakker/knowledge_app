// src/components/ParameterValueEditorModal.tsx
import React, { useState, useEffect } from 'react';
import { main } from '../../wailsjs/go/models';
import { ParameterSearchSelect, ParameterOption } from './ParameterSearchSelect';
import { SaveParameterValue } from '../../wailsjs/go/main/App';
import { isoToLocalDatetime, localDatetimeToIso } from '../utils/dateUtils';
import { RichTextEditorModal } from './RichTextEditorModal';
import { Edit3 } from 'lucide-react';

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

                // Bepaal dataType: controleer expliciet de entity, of 'dataType' / 'dataTypeCode' eigenschappen
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

    // Herken zowel 'markdown' als 'richtext' of 'html'
    const currentDataType = selectedParam?.dataType?.toLowerCase() || 'onbekend';
    const isMarkdown = ['markdown', 'richtext', 'html'].includes(currentDataType);

    return (
        <>
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1100
            }}>
                <div style={{
                    background: '#fff', padding: '20px', borderRadius: '8px',
                    width: '450px', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                    <h3>{initialValue ? 'Parameterwaarde Bewerken' : 'Parameterwaarde Toevoegen'}</h3>

                    {!initialValue && (
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Parameter</label>
                            <ParameterSearchSelect onSelect={(opt) => setSelectedParam(opt)} />
                        </div>
                    )}

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                                Waarde {selectedParam?.unit ? `(${selectedParam.unit})` : ''}
                            </label>
                            {/* Debug indicator van het actieve data_type */}
                            <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                type: {currentDataType} | ID: {selectedParam?.value || initialValue?.parameterId || 'onbekend'}
                            </span>
                        </div>

                        {isMarkdown ? (
                            <div style={{ marginTop: '6px' }}>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("Klik op bewerken ontvangen! isRichTextOpen wordt true");
                                        setIsRichTextOpen(true);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 12px',
                                        background: '#0f172a',
                                        color: '#38bdf8',
                                        border: '1px solid #334155',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        width: '100%',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Edit3 size={16} />
                                    {value ? 'Opgemaakte tekst bewerken...' : 'Opgemaakte tekst invoeren...'}
                                </button>

                                {value && (
                                    <div
                                        style={{
                                            marginTop: '6px',
                                            padding: '8px',
                                            background: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '4px',
                                            maxHeight: '100px',
                                            overflowY: 'auto',
                                            fontSize: '0.8rem',
                                            color: '#475569'
                                        }}
                                        dangerouslySetInnerHTML={{ __html: value }}
                                    />
                                )}
                            </div>
                        ) : (
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                style={{ width: '100%', padding: '6px', marginTop: '4px', boxSizing: 'border-box' }}
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
                            style={{ width: '100%', padding: '6px', marginTop: '4px', boxSizing: 'border-box' }}
                        />
                    </div>

                    {!isMeetwaardeMode && (
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Geldig tot (validTo)</label>
                            <input
                                type="datetime-local"
                                value={validToLocal}
                                onChange={(e) => setValidToLocal(e.target.value)}
                                style={{ width: '100%', padding: '6px', marginTop: '4px', boxSizing: 'border-box' }}
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
                        <button onClick={onClose} style={{ padding: '6px 12px' }}>Annuleren</button>
                        <button onClick={handleSave} style={{ padding: '6px 12px', background: '#007acc', color: '#fff', border: 'none', borderRadius: '4px' }}>
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