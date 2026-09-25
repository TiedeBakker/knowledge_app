import React, { useState, useEffect } from 'react';
import { ResizableSplitPane } from '../../components/layout/ResizableSplitPane';
import { NodeSearchSelector } from './components/NodeSearchSelector';
import { TreeView } from './components/TreeView';
import { BookPreview } from './components/reports/BookPreview';
import { BaseModuleConfig } from './types/baseModule.types';
import { GraphNode } from './types/tree.types';
import {
  fetchBaseObjects,
  fetchObjectTree,
  fetchReportPreview,
  exportReportHTML,
  exportReportPDF,
  BaseObjectDto,
} from './services/baseModuleService';

import { TemplateEditorModal } from './components/TemplateEditorModal';
import { DbTemplateRecord } from './types/template.types';
import {
  fetchTemplateById,
  fetchTemplates,
  saveTemplate,
} from './services/baseModuleService';


export const BaseModule: React.FC = () => {
  const [config, setConfig] = useState<BaseModuleConfig>({
    rootObjectId: null,
    maxDepth: 3,
    templateId: '', // Standby tot templates zijn geladen uit SQLite
  });

  const [availableObjects, setAvailableObjects] = useState<BaseObjectDto[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<DbTemplateRecord[]>([]);
  const [treeData, setTreeData] = useState<GraphNode | null>(null);
  const [reportHtml, setReportHtml] = useState<string>('');

  const [isLoadingObjects, setIsLoadingObjects] = useState<boolean>(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(true);
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(false);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  // Modal state
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState<boolean>(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // 1. Haal alle objecten én sjablonen op bij de start
  useEffect(() => {
    let isMounted = true;
    setIsLoadingObjects(true);
    setIsLoadingTemplates(true);

    fetchBaseObjects().then((objects) => {
      if (isMounted) {
        setAvailableObjects(objects || []);
        setIsLoadingObjects(false);
      }
    });

    fetchTemplates().then((templates) => {
      if (isMounted) {
        const safeTemplates = templates || [];
        setAvailableTemplates(safeTemplates);
        setIsLoadingTemplates(false);

        // Als er sjablonen zijn, selecteer de eerste
        if (safeTemplates.length > 0) {
          setConfig((prev) => ({ ...prev, templateId: safeTemplates[0].id }));
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Haal de boomstructuur op zodra rootObjectId of maxDepth verandert
  useEffect(() => {
    if (!config.rootObjectId) {
      setTreeData(null);
      return;
    }

    let isMounted = true;
    setIsLoadingTree(true);

    fetchObjectTree(config.rootObjectId, config.maxDepth).then((data) => {
      if (isMounted) {
        setTreeData(data);
        setIsLoadingTree(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [config.rootObjectId, config.maxDepth]);

  // 3. Haal de rapportage HTML op zodra rootObjectId, maxDepth of templateId verandert
  useEffect(() => {
    if (!config.rootObjectId || !config.templateId) {
      setReportHtml('');
      return;
    }

    let isMounted = true;
    setIsLoadingReport(true);

    fetchReportPreview(config.rootObjectId, config.maxDepth, config.templateId)
      .then((html) => {
        if (isMounted) {
          setReportHtml(html || '');
          setIsLoadingReport(false);
        }
      })
      .catch((err) => {
        console.error('Fout bij ophalen rapport-preview:', err);
        if (isMounted) {
          setReportHtml('<p style="color:red; padding: 16px;">Fout bij genereren rapportage.</p>');
          setIsLoadingReport(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [config.rootObjectId, config.maxDepth, config.templateId]);

  const handleConfigChange = <K extends keyof BaseModuleConfig>(
    key: K,
    value: BaseModuleConfig[K]
  ) => {
    setConfig((prev: BaseModuleConfig) => ({ ...prev, [key]: value }));
  };

  const handleOpenEditor = (node: GraphNode) => {
    alert(`Modale editor openen voor: ${node.label} (ID: ${node.id})`);
  };

  const handleOpenObjectEditorFromReport = (objectId: string) => {
    alert(`Modale Object Editor openen voor object ID: ${objectId}`);
  };

  const handleOpenRichTextEditorFromReport = (paramValueId: string, objectId: string) => {
    alert(`Modale RichText Editor openen voor ParameterValue ID: ${paramValueId} (Object: ${objectId})`);
  };

  const handleExportHTML = async () => {
    if (!config.rootObjectId || !config.templateId) return;
    setIsExporting(true);
    try {
      const filePath = await exportReportHTML(config.rootObjectId, config.maxDepth, config.templateId);
      alert(`HTML-rapport succesvol geëxporteerd naar:\n${filePath}`);
    } catch (err) {
      alert(`Fout bij exporteren HTML: ${err}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!config.rootObjectId || !config.templateId) return;
    setIsExporting(true);
    try {
      const filePath = await exportReportPDF(config.rootObjectId, config.maxDepth, config.templateId);
      alert(`PDF-rapport succesvol geëxporteerd naar:\n${filePath}`);
    } catch (err) {
      alert(`Fout bij exporteren PDF:\n${err}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenEditTemplate = () => {
    if (!config.templateId) return;
    setEditingTemplateId(config.templateId);
    setIsTemplateEditorOpen(true);
  };

  const handleOpenNewTemplate = () => {
    setEditingTemplateId(null); // Geen ID meegeven = nieuw sjabloon aanmaken
    setIsTemplateEditorOpen(true);
  };

const handleSaveTemplate = async (templateData: Partial<DbTemplateRecord>) => {
  try {
    // Aanroep van de geëxporteerde service-functie met kleine 's'
    const savedRecord = await saveTemplate(templateData);

    if (savedRecord && savedRecord.id) {
      setEditingTemplateId(savedRecord.id);
      setConfig((prev) => ({ ...prev, templateId: savedRecord.id }));
    }

    // Herlaad de lijst met sjablonen
    const templates = await fetchTemplates();
    setAvailableTemplates(templates || []);

    setIsTemplateEditorOpen(false);
  } catch (error) {
    console.error("Fout bij opslaan van sjabloon:", error);
  }
};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* KOPBALK */}
      <header
        style={{
          padding: '10px 20px',
          backgroundColor: '#f5f5f7',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Basismodule</h1>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>
            Kennis- & Informatiesysteem Workspace
          </span>
        </div>

        {/* CONTROLS */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          {/* Centraal Object Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 500 }}>
              Centraal Object {isLoadingObjects && '(laden...)'}
            </label>
            <NodeSearchSelector
              items={availableObjects}
              selectedId={config.rootObjectId}
              onSelect={(selectedObject) => {
                handleConfigChange('rootObjectId', selectedObject.id);
              }}
              placeholder="Zoek op label..."
            />
          </div>

          {/* Diepte van de boom */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 500 }}>
              Niveaus Diep
            </label>
            <select
              value={config.maxDepth}
              onChange={(e) => handleConfigChange('maxDepth', Number(e.target.value))}
              style={{
                padding: '6px 8px',
                fontSize: '0.85rem',
                borderRadius: '4px',
                border: '1px solid #767676',
                backgroundColor: '#fff',
                color: '#1a1a1a',
              }}
            >
              {[1, 2, 3, 4, 5].map((depth) => (
                <option key={depth} value={depth}>
                  {depth} {depth === 1 ? 'niveau' : 'niveaus'}
                </option>
              ))}
            </select>
          </div>

          {/* Template Keuze & Beheer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 500 }}>
              Template {isLoadingTemplates && '(laden...)'}
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                value={config.templateId}
                onChange={(e) => handleConfigChange('templateId', e.target.value)}
                disabled={isLoadingTemplates || availableTemplates.length === 0}
                style={{
                  padding: '6px 8px',
                  fontSize: '0.85rem',
                  borderRadius: '4px',
                  border: '1px solid #767676',
                  backgroundColor: '#fff',
                  color: '#1a1a1a',
                  minWidth: '160px',
                }}
              >
                {availableTemplates.length === 0 ? (
                  <option value="">(Geen sjablonen)</option>
                ) : (
                  availableTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.label}
                    </option>
                  ))
                )}
              </select>

              {/* Bewerken knop */}
              <button
                onClick={handleOpenEditTemplate}
                disabled={!config.templateId}
                title={config.templateId ? 'Sjabloon bewerken' : 'Selecteer eerst een sjabloon'}
                style={{
                  padding: '6px 10px',
                  fontSize: '0.85rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: '#fff',
                  cursor: config.templateId ? 'pointer' : 'not-allowed',
                  opacity: config.templateId ? 1 : 0.5,
                }}
              >
                ⚙️
              </button>

              {/* Nieuw sjabloon knop */}
              <button
                onClick={handleOpenNewTemplate}
                title="Nieuw sjabloon toevoegen"
                style={{
                  padding: '6px 10px',
                  fontSize: '0.85rem',
                  borderRadius: '4px',
                  border: '1px solid #005fb8',
                  backgroundColor: '#fff',
                  color: '#005fb8',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Export Acties */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '0.75rem', color: '#555', fontWeight: 500 }}>
              Export
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleExportHTML}
                disabled={!config.rootObjectId || !config.templateId || isExporting}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.85rem',
                  borderRadius: '4px',
                  border: '1px solid #005fb8',
                  backgroundColor: '#005fb8',
                  color: '#fff',
                  cursor: config.rootObjectId && config.templateId && !isExporting ? 'pointer' : 'not-allowed',
                  opacity: config.rootObjectId && config.templateId && !isExporting ? 1 : 0.6,
                }}
              >
                HTML
              </button>
              <button
                onClick={handleExportPDF}
                disabled={!config.rootObjectId || !config.templateId || isExporting}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.85rem',
                  borderRadius: '4px',
                  border: '1px solid #28a745',
                  backgroundColor: '#28a745',
                  color: '#fff',
                  cursor: config.rootObjectId && config.templateId && !isExporting ? 'pointer' : 'not-allowed',
                  opacity: config.rootObjectId && config.templateId && !isExporting ? 1 : 0.6,
                }}
              >
                PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* HOOFDINHOUD MET SPLIT-PANE */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ResizableSplitPane
          initialLeftWidthPercent={50}
          minWidthPixels={300}
          left={
            <div style={{ backgroundColor: '#fafafa', height: '100%', overflow: 'hidden' }}>
              {isLoadingTree ? (
                <div style={{ padding: '24px', color: '#666', fontSize: '0.9rem' }}>
                  Boomstructuur laden uit database...
                </div>
              ) : treeData ? (
                <TreeView
                  centralNode={treeData}
                  onSelectCentral={(id) => handleConfigChange('rootObjectId', id)}
                  onOpenEditor={handleOpenEditor}
                />
              ) : (
                <div style={{ padding: '24px', color: '#666', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  Selecteer een centraal object in de bovenbalk om de grafische boomstructuur te tonen.
                </div>
              )}
            </div>
          }
          right={
            <div style={{ backgroundColor: '#eef1f5', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
              {isLoadingReport ? (
                <div style={{ padding: '24px', color: '#666', fontSize: '0.9rem' }}>
                  Rapportage genereren...
                </div>
              ) : config.rootObjectId ? (
                config.templateId ? (
                  <BookPreview
                    htmlContent={reportHtml}
                    onOpenObjectEditor={handleOpenObjectEditorFromReport}
                    onOpenRichTextEditor={handleOpenRichTextEditorFromReport}
                  />
                ) : (
                  <div style={{ padding: '24px', color: '#666', fontStyle: 'italic', fontSize: '0.9rem' }}>
                    Geen sjabloon geselecteerd. Klik op <strong>+</strong> om een nieuw sjabloon aan te maken.
                  </div>
                )
              ) : (
                <div style={{ padding: '24px', color: '#666', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  Selecteer een object om de rapportage-preview te genereren.
                </div>
              )}
            </div>
          }
        />
      </div>

      {/* Modal Editor */}
      {isTemplateEditorOpen && (
        <TemplateEditorModal
          templateId={editingTemplateId}
          fetchTemplateById={fetchTemplateById}
          onClose={() => setIsTemplateEditorOpen(false)}
          onSave={handleSaveTemplate}
        />
      )}
    </div>
  );
};