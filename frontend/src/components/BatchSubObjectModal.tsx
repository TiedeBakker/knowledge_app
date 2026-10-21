import React, { useState, useEffect } from 'react';
import { BatchCreateSubObjects, CreateComplexSubObject } from '../../wailsjs/go/main/App';
import { SUB_OBJECT_CONFIGS, ParameterConfig } from '../config/subObjectConfigs';
import { main } from '../../wailsjs/go/models';
import { RichTextEditorModal } from './RichTextEditorModal'; // Zorg dat dit pad klopt naar jouw component

interface Props {
  isOpen: boolean;
  parentId: string;
  parentLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const BatchSubObjectModal: React.FC<Props> = ({
  isOpen,
  parentId,
  parentLabel,
  onClose,
  onSuccess,
}) => {
  const [activeTypeKey, setActiveTypeKey] = useState<string>('tekstitem');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // State voor Batch (Tekstitem)
  const [batchCount, setBatchCount] = useState<number>(1);
  const [batchBaseLabel, setBatchBaseLabel] = useState<string>('Paragraaf');
  const [batchValues, setBatchValues] = useState<Record<string, string>>({});

  // State voor Enkelvoudige Complexe Objecten (Boek)
  const [objectLabel, setObjectLabel] = useState<string>('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  // State voor de RichTextEditorModal koppeling
  const [isRichTextOpen, setIsRichTextOpen] = useState<boolean>(false);
  const [activeMarkdownField, setActiveMarkdownField] = useState<{ code: string; isBatch: boolean } | null>(null);

  const currentConfig = SUB_OBJECT_CONFIGS.find((c) => c.typeKey === activeTypeKey) || SUB_OBJECT_CONFIGS[0];

  useEffect(() => {
    if (!isOpen) return;

    const initialParams: Record<string, string> = {};
    const allParams = [...currentConfig.requiredParameters, ...currentConfig.optionalParameters];

    allParams.forEach((p) => {
      if (p.defaultValue) {
        initialParams[p.code] = p.defaultValue;
      }
    });

    if (currentConfig.isBatch) {
      setBatchValues(initialParams);
    } else {
      setParamValues(initialParams);
      setObjectLabel('');
    }
  }, [activeTypeKey, isOpen]);

  if (!isOpen) return null;

  const areRequiredFieldsFilled = () => {
    if (currentConfig.isBatch) {
      return batchCount > 0 && batchBaseLabel.trim() !== '';
    }
    if (!objectLabel.trim()) return false;
    for (const req of currentConfig.requiredParameters) {
      if (!paramValues[req.code]?.trim()) {
        return false;
      }
    }
    return true;
  };

  const handleParamChange = (code: string, val: string, isBatch: boolean) => {
    if (isBatch) {
      setBatchValues((prev) => ({ ...prev, [code]: val }));
    } else {
      setParamValues((prev) => ({ ...prev, [code]: val }));
    }
  };

  // Open de RichTextEditorModal voor een specifiek markdown-veld
  const handleOpenRichText = (code: string, isBatch: boolean) => {
    setActiveMarkdownField({ code, isBatch });
    setIsRichTextOpen(true);
  };

  // Opslaan vanuit de RichTextEditorModal
  const handleSaveRichText = (htmlContent: string) => {
    if (!activeMarkdownField) return;
    handleParamChange(activeMarkdownField.code, htmlContent, activeMarkdownField.isBatch);
    setIsRichTextOpen(false);
    setActiveMarkdownField(null);
  };

  const handleFileSelect = async (paramCode: string, isBatch: boolean) => {
    try {
      const filePath = await (window as any).go.main.App.SelectAnyFile();
      if (!filePath) return;

      let formattedPath = filePath.replace(/\\/g, '/');
      if (formattedPath.includes('DArchieven')) {
        const parts = formattedPath.split('DArchieven');
        formattedPath = `http://localhost/DArchieven${parts[parts.length - 1]}`;
      }

      handleParamChange(paramCode, formattedPath, isBatch);
    } catch (err) {
      console.error('Fout bij selecteren bestand:', err);
    }
  };

  const renderParameterInput = (param: ParameterConfig, isBatch: boolean) => {
    const value = isBatch ? (batchValues[param.code] || '') : (paramValues[param.code] || '');
    const paramType = param.type || 'text';

    switch (paramType) {
      case 'markdown':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={value}
                onChange={(e) => handleParamChange(param.code, e.target.value, isBatch)}
                placeholder="HTML inhoud of bewerk via editor..."
                style={{ flex: 1, padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
              />
              <button
                type="button"
                onClick={() => handleOpenRichText(param.code, isBatch)}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  background: '#e3f2fd',
                  border: '1px solid #90caf9',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  color: '#0d47a1',
                }}
              >
                📝 Rich Text Editor
              </button>
            </div>
          </div>
        );

      case 'file':
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={value}
              onChange={(e) => handleParamChange(param.code, e.target.value, isBatch)}
              placeholder="Pad of http://localhost/DArchieven/..."
              style={{ flex: 1, padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
            />
            <button
              type="button"
              onClick={() => handleFileSelect(param.code, isBatch)}
              style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
            >
              📂 Kies bestand...
            </button>
          </div>
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleParamChange(param.code, e.target.value, isBatch)}
            style={{ width: '100%', padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        );
    }
  };

  const handleSubmit = async () => {
    if (!parentId || !areRequiredFieldsFilled()) return;
    setIsLoading(true);

    try {
      if (currentConfig.isBatch) {
        await BatchCreateSubObjects({
          parentId: parentId,
          count: Number(batchCount),
          baseLabel: batchBaseLabel.trim() || 'Paragraaf',
          relationID: currentConfig.relation1Id,
          objectTypeID: currentConfig.objectTypeId,
          parameterID: currentConfig.requiredParameters[0].id,
          parameterValue: batchValues[currentConfig.requiredParameters[0].code] || '<p>Tekstblok</p>',
        });
      } else {
        const parametersPayload = [
          ...currentConfig.requiredParameters.map((p) => ({
            parameterId: p.id,
            value: paramValues[p.code] || '',
          })),
          ...currentConfig.optionalParameters
            .filter((p) => paramValues[p.code]?.trim())
            .map((p) => ({
              parameterId: p.id,
              value: paramValues[p.code],
            })),
        ];

        await CreateComplexSubObject(
          new main.CreateComplexSubObjectInput({
            parentId: parentId,
            label: objectLabel.trim(),
            relationId: currentConfig.relation1Id,
            objectTypeId: currentConfig.objectTypeId,
            parameters: parametersPayload,
          })
        );
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Fout bij aanmaken sub-object:', err);
      alert('Aanmaken mislukt: ' + err);
    } finally {
      setIsLoading(false);
    }
  };

  // Huidige waarde ophalen voor de actieve rich text editor
  const getCurrentMarkdownValue = () => {
    if (!activeMarkdownField) return '';
    return activeMarkdownField.isBatch
      ? (batchValues[activeMarkdownField.code] || '')
      : (paramValues[activeMarkdownField.code] || '');
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
          width: '650px',
          maxWidth: '90%',
          maxHeight: '90vh',
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
            <span style={{ fontSize: '0.8rem', color: '#666' }}>
              Gekoppeld aan: <strong>{parentLabel}</strong>
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* TAB STRIP */}
        <div style={{ display: 'flex', borderBottom: '2px solid #ddd', marginBottom: '16px', gap: '8px' }}>
          {SUB_OBJECT_CONFIGS.map((conf) => (
            <button
              key={conf.typeKey}
              onClick={() => setActiveTypeKey(conf.typeKey)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeTypeKey === conf.typeKey ? 'bold' : 'normal',
                borderBottom: activeTypeKey === conf.typeKey ? '3px solid #007acc' : 'none',
                color: activeTypeKey === conf.typeKey ? '#007acc' : '#555',
              }}
            >
              {conf.tabLabel}
            </button>
          ))}
        </div>

        {/* TAB INHOUD */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {currentConfig.isBatch ? (
            /* --- BATCH FORMULIER (TEKSTITEM) --- */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  Aantal tekstitems:
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value, 10) || 1)}
                  style={{ width: '100%', padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  Basislabel (voorvoegsel):
                </label>
                <input
                  type="text"
                  value={batchBaseLabel}
                  onChange={(e) => setBatchBaseLabel(e.target.value)}
                  style={{ width: '100%', padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  {currentConfig.requiredParameters[0].label}:
                </label>
                {renderParameterInput(currentConfig.requiredParameters[0], true)}
              </div>
            </div>
          ) : (
            /* --- COMPLEX ENKELVOUDIG OBJECT (BIJV. BOEK) --- */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  Object Label (Naam/Identificatie)*:
                </label>
                <input
                  type="text"
                  value={objectLabel}
                  onChange={(e) => setObjectLabel(e.target.value)}
                  placeholder="bijv. De Kleine Prins (Boek)"
                  style={{ width: '100%', padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              {/* Verplichte Parameters */}
              <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '6px', border: '1px solid #eee' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#007acc' }}>Verplichte Parameters</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {currentConfig.requiredParameters.map((param) => (
                    <div key={param.code}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '3px' }}>
                        {param.label} *:
                      </label>
                      {renderParameterInput(param, false)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Optionele Parameters */}
              {currentConfig.optionalParameters.length > 0 && (
                <div style={{ background: '#fafafa', padding: '12px', borderRadius: '6px', border: '1px solid #eee' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#666' }}>Optionele Parameters</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentConfig.optionalParameters.map((param) => (
                      <div key={param.code}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '3px' }}>
                          {param.label}:
                        </label>
                        {renderParameterInput(param, false)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
          <button onClick={onClose} style={{ padding: '6px 12px', cursor: 'pointer' }}>
            Annuleren
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !areRequiredFieldsFilled()}
            style={{
              background: '#007acc',
              color: '#fff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              opacity: isLoading || !areRequiredFieldsFilled() ? 0.5 : 1,
            }}
          >
            {isLoading ? 'Opslaan...' : currentConfig.isBatch ? `Voeg ${batchCount} items toe` : `${currentConfig.tabLabel.replace(/[^a-zA-Z ]/g, '').trim()} Aanmaken`}
          </button>
        </div>

        {/* GEKOPPELDE RICHTEXTEDITOR MODAL */}
        {isRichTextOpen && (
          <RichTextEditorModal
            isOpen={isRichTextOpen}
            initialValue={getCurrentMarkdownValue()} // 👈 Gebruik initialValue in plaats van initialContent
            onClose={() => setIsRichTextOpen(false)}
            onSave={handleSaveRichText}
          />
        )}
      </div>
    </div>
  );
};