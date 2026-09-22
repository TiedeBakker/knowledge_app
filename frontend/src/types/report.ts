// src/types/report.ts  

export interface ObjectSummary {
  id: string;
  label: string;
  is_confidential: boolean;
  valid_from: string;
  valid_to?: string;
  updated_at: string;
}

export interface ParameterSummary {
  id: string;
  parameter_id: string;
  parameter_code: string;
  parameter_label: string;
  data_type: string;
  target_id: string;
  target_type: string;
  value: string;
  unit: string;
  is_confidential: boolean;
  valid_from: string;
  valid_to?: string;
}

export interface RelationSummary {
  id: string;
  relation_id: string;
  relation_label: string;
  source_id: string;
  source_label: string;
  target_id: string;
  target_label: string;
  volgorde: number;
  is_confidential: boolean;
  valid_from: string;
  valid_to?: string;
  updated_at: string;
}

export interface ReportTreeNode {
  object: ObjectSummary;
  parameters: ParameterSummary[];
  relation?: RelationSummary;
  children: ReportTreeNode[];
}
export interface ReportTemplate {
  id: string;
  name: string;
  pageSize: 'A4' | 'A5' | 'Letter';
  orientation: 'portrait' | 'landscape';
  maxLevels: number;
  contentParameterCode: string; // Standaard 'toelichting'
  hierarchyRules: {
    level: number;
    fontSize: number;
    pageBreakBefore: boolean;
  }[];
}