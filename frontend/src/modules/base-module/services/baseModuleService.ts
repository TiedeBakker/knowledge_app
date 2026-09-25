// 1. Zorg dat je de Wails Go-bindingen importeert bovenaan de file:
import { 
  GetObjectsForSelector, 
  GetObjectTree, 
  GenerateBookReport, 
  ExportBookReportToHTML, 
  ExportBookReportToPDF,
  GetTemplateById,   // <-- Zorg dat deze in app.go / wailsjs aanwezig is
  SaveTemplateRecord, // <-- Zorg dat deze in app.go / wailsjs aanwezig is
  GetTemplates
} from '../../../../wailsjs/go/main/App';
// import { main } from '../../../../wailsjs/go/models';

import { GraphNode } from '../types/tree.types';
import { DbTemplateRecord } from '../types/template.types';

export const fetchTemplates = async (): Promise<DbTemplateRecord[]> => {
  try {
    const result = await GetTemplates();
    return result ?? []; // Als Go 'null' of 'nil' geeft, retourneer []
  } catch (err) {
    console.error('Fout bij ophalen van templates:', err);
    return [];
  }
};

export interface BaseObjectDto {
  id: string;
  label: string;
}

export async function fetchBaseObjects(): Promise<BaseObjectDto[]> {
  try {
    const result = await GetObjectsForSelector();
    return result || [];
  } catch (error) {
    console.error('Fout bij ophalen objecten:', error);
    return [];
  }
}

export async function fetchObjectTree(rootId: string, maxDepth: number): Promise<GraphNode | null> {
  try {
    const result = await GetObjectTree(rootId, maxDepth);
    return result || null;
  } catch (error) {
    console.error('Fout bij ophalen boomstructuur:', error);
    return null;
  }
}

export async function fetchReportPreview(
  rootObjectId: string,
  maxDepth: number,
  templateId: string
): Promise<string> {
  try {
    const html = await GenerateBookReport(rootObjectId, maxDepth, templateId);
    return html;
  } catch (error) {
    console.error('Fout bij het ophalen van rapportage HTML:', error);
    return `<div style="color: red; padding: 20px;">
      Er is een fout opgetreden bij het genereren van de rapportage.
    </div>`;
  }
}

export async function exportReportHTML(
  rootObjectId: string,
  maxDepth: number,
  templateId: string
): Promise<string> {
  return await ExportBookReportToHTML(rootObjectId, maxDepth, templateId);
}

export async function exportReportPDF(
  rootObjectId: string,
  maxDepth: number,
  templateId: string
): Promise<string> {
  return await ExportBookReportToPDF(rootObjectId, maxDepth, templateId);
}

// ✅ HAAL TEMPLATE OP VIA WAILS GO-BINDING
export async function fetchTemplateById(id: string): Promise<DbTemplateRecord | null> {
  try {
    const result = await GetTemplateById(id); 
    // Cast het resultaat van Wails naar jouw DbTemplateRecord
    return (result as unknown as DbTemplateRecord) || null;
  } catch (error) {
    console.error(`Fout bij ophalen van template (${id}):`, error);
    return null;
  }
}

// ✅ SLA TEMPLATE OP VIA WAILS GO-BINDING EN RETOURNEER HET RECORD
export async function saveTemplate(template: Partial<DbTemplateRecord>): Promise<DbTemplateRecord | null> {
  try {
    const result = await SaveTemplateRecord(template as any);
    return (result as unknown as DbTemplateRecord) || null;
  } catch (error) {
    console.error('Fout bij opslaan van template:', error);
    throw error;
  }
}