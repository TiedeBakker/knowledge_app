import React, { useState, useEffect } from 'react';
import { ReportTemplate, ReportTreeNode } from '../../types/report';
import { TemplateEditModal } from './TemplateEditModal';
import { NodeSearchSelect } from '../../components/NodeSearchSelect';
import { getOutboundRelationLabel } from '../../utils/relationUtils';
import { main } from '../../../wailsjs/go/models';
import { SelectSavePath,FetchReportTree, ExportReportToPDF } from '../../../wailsjs/go/main/App';

const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'standard_book',
    name: 'Standaard Boekindeling',
    pageSize: 'A4',
    orientation: 'portrait',
    maxLevels: 4,
    contentParameterCode: 'Toelichting',
    hierarchyRules: [
      { level: 0, fontSize: 24, pageBreakBefore: false },
      { level: 1, fontSize: 18, pageBreakBefore: true },
      { level: 2, fontSize: 14, pageBreakBefore: false },
      { level: 3, fontSize: 12, pageBreakBefore: false }
    ]
  }
];

export const ReportModule: React.FC = () => {
  const [templates, setTemplates] = useState<ReportTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_TEMPLATES[0].id);

  const [startNode, setStartNode] = useState<main.ObjectEntity | null>(null);
  const [maxLevels, setMaxLevels] = useState<number>(3);

  const [reportTree, setReportTree] = useState<ReportTreeNode | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | undefined>(undefined);

  const currentTemplate = templates.find(t => t.id === selectedTemplateId);

  useEffect(() => {
    if (!startNode) {
      setReportTree(null);
      return;
    }

    const loadTreeData = async () => {
      setIsLoading(true);
      try {
        const paramCode = currentTemplate?.contentParameterCode || 'Toelichting';
        const data = await FetchReportTree(startNode.id, maxLevels, paramCode);
        setReportTree(data as ReportTreeNode);
      } catch (err) {
        console.error("Fout bij ophalen report tree:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTreeData();
  }, [startNode, maxLevels, currentTemplate?.contentParameterCode]);

  // Render-functie voor een node in de boom
  const renderTreePreview = (treeNode: ReportTreeNode, currentLevel: number = 0) => {
    const rule = currentTemplate?.hierarchyRules.find(r => r.level === currentLevel) || { fontSize: 12 };

    // Bepaal de te zoeken sleutel (ID, code of label) case-insensitive
    const rawSearchKey = currentTemplate?.contentParameterCode || 'Toelichting';
    const targetKey = rawSearchKey.toLowerCase();

    // Zoek de parameterwaarde op basis van ID, Code of Label (gebruik snake_case veldnamen)
    const contentParam = treeNode.parameters?.find(p =>
      p.parameter_id?.toLowerCase() === targetKey ||
      p.parameter_code?.toLowerCase() === targetKey ||
      p.parameter_label?.toLowerCase() === targetKey
    );

    // Bepaal de daadwerkelijke RichText inhoud en strip eventuele inline lichte/witte kleuren
    let rawContent = (contentParam as any)?.value || '';
    if (rawContent) {
      rawContent = rawContent
        .replace(/color:\s*(?:#fff(?:fff)?|#ffffff[0-9a-f]{2}|white|rgb\(255,\s*255,\s*255\)|rgba\(255,\s*255,\s*255,\s*[\d.]+\))/gi, 'color: inherit');
    }

    // Bepaal de uitgaande relatienaam (bijv. "Onderdeel van") voor extra context (gebruik relation_label)
    const relationType = treeNode.relation?.relation_label
      ? getOutboundRelationLabel(treeNode.relation.relation_label)
      : '';

    return (
      <div
        key={treeNode.object.id}
        style={{
          marginTop: currentLevel === 0 ? 0 : '16px',
          marginLeft: currentLevel > 0 ? `${currentLevel * 16}px` : 0,
          borderLeft: currentLevel > 0 ? '2px solid #007acc' : 'none',
          paddingLeft: currentLevel > 0 ? '12px' : 0
        }}
      >
        {/* Titel: Toont altijd het label van het gerelateerde object zelf */}
        <div style={{ fontSize: `${rule.fontSize}px`, fontWeight: 'bold', color: '#111' }}>
          {currentLevel === 0 ? (
            `[Hoofdobject] ${treeNode.object.label}`
          ) : (
            <>
              {treeNode.object.label}
              {relationType && (
                <span style={{ fontSize: '0.8em', fontWeight: 'normal', color: '#666', marginLeft: '8px' }}>
                  ({relationType})
                </span>
              )}
            </>
          )}
        </div>

        {/* RichText Inhoud (Toelichting van het gerelateerde object) */}
        {rawContent ? (
          <div
            style={contentBoxStyle}
            dangerouslySetInnerHTML={{ __html: rawContent }}
          />
        ) : (
          <div style={{ fontSize: '11px', color: '#aaa', fontStyle: 'italic', margin: '4px 0' }}>
            (Geen parameter '{rawSearchKey}' aanwezig op dit object)
          </div>
        )}

        {/* Recursieve rendering van kind-objecten */}
        {treeNode.children && treeNode.children.map(child => renderTreePreview(child, currentLevel + 1))}
      </div>
    );
  };

  const [isExporting, setIsExporting] = useState<boolean>(false);

const handleExportPDF = async () => {
    if (!reportTree) return;

    try {
      setIsExporting(true);

      // 1. Roep de Go-backend aan om het 'Opslaan als'-scherm van Windows te openen
      const defaultName = `${reportTree.object.label || 'rapport'}.pdf`;
      const targetPath = await SelectSavePath(defaultName);

      // 2. Als de gebruiker op 'Annuleren' drukt in het venster
      if (!targetPath) {
        setIsExporting(false);
        return;
      }

      // 3. Roep Go aan met 'as any' om het Wails/TypeScript interfaceverschil te overbruggen
      await ExportReportToPDF(reportTree as any, targetPath);

      alert('PDF succesvol gegenereerd!');
    } catch (err: any) {
      console.error('Fout bij exporteren PDF:', err);
      alert(`Fout bij exporteren: ${err.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };
  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%', padding: '16px', boxSizing: 'border-box' }}>
      {/* Linkerpaneel */}
      <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid #ccc', paddingRight: '16px' }}>
        <h3 style={{ margin: 0 }}>Rapportage Module</h3>

        <div>
          <label style={labelStyle}>Startobject (Boektitel):</label>
          <NodeSearchSelect
            value={startNode}
            onSelectNode={(node) => setStartNode(node)}
            placeholder="Zoek startobject..."
            excludePhotos={true}
          />
        </div>

        <div>
          <label style={labelStyle}>Max. Diepte / Niveaus:</label>
          <input
            type="number"
            min={1}
            max={10}
            value={maxLevels}
            onChange={(e) => setMaxLevels(parseInt(e.target.value) || 1)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Stuurbestand (JSON):</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button onClick={() => { setEditingTemplate(currentTemplate); setIsModalOpen(true); }} style={buttonStyle}>
              ✏️
            </button>
          </div>
        </div>

        <hr style={{ width: '100%', margin: '8px 0' }} />

        <button
          disabled={!reportTree || isExporting}
          onClick={handleExportPDF}
          style={{
            ...buttonStyle,
            backgroundColor: reportTree && !isExporting ? '#28a745' : '#ccc',
            color: '#fff',
            cursor: reportTree && !isExporting ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            padding: '10px'
          }}
        >
          {isExporting ? '⏳ Genereren...' : '📄 Genereer PDF Test (Stap 3)'}
        </button>     </div>

      {/* Rechterpaneel: Document Preview */}
      <div style={{ flex: 1, backgroundColor: '#f9f9f9', padding: '16px', borderRadius: '4px', overflowY: 'auto' }}>
        <h4 style={{ marginTop: 0 }}>Document Preview</h4>

        {isLoading && <div style={{ color: '#007acc' }}>Boomstructuur laden uit SQLite...</div>}

        {!isLoading && reportTree && (
          <div style={pagePreviewStyle}>
            {renderTreePreview(reportTree)}
          </div>
        )}

        {!isLoading && !reportTree && (
          <div style={{ color: '#888', textAlign: 'center', marginTop: '60px', fontStyle: 'italic' }}>
            Selecteer een Startobject om de echte objectenboom op te halen.
          </div>
        )}
      </div>

      <TemplateEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(updated) => {
          setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
        }}
        initialTemplate={editingTemplate}
      />
    </div>
  );
};

const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '6px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' };
const buttonStyle: React.CSSProperties = { padding: '6px 12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' };
const pagePreviewStyle: React.CSSProperties = { background: '#fff', padding: '30px', minHeight: '500px', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' };
const contentBoxStyle: React.CSSProperties = {
  margin: '6px 0 12px 0',
  padding: '8px 12px',
  backgroundColor: '#f4f6f8',
  borderRadius: '4px',
  fontSize: '13px',
  color: '#222222', // Dwingt donkere tekst af
  lineHeight: '1.5'
};