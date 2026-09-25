export interface TemplateFieldConfig {
  field: string;
  fallback?: string;
  type: 'heading' | 'rich_text' | 'text' | 'inline_bold' | string;
  css_class?: string;
  role?: string;
}

export interface TemplateLevelRule {
  level: number;
  name: string;
  heading_tag: string | null;
  page_break_before: boolean;
  include_in_toc: boolean;
  filter?: {
    allowed_object_types?: string[];
    excluded_object_types?: string[];
  };
  fields: TemplateFieldConfig[];
}

export interface ReportTemplateConfig {
  id: string;
  naam: string;
  type: 'book' | 'table' | 'list' | string;
  version: number;
  global_settings: {
    toc: {
      enabled: boolean;
      max_depth: number;
      title: string;
    };
    numbering: {
      type: string;
      separator: string;
      stop_at_level: number;
    };
  };
  root_level: {
    title_field: string;
    fallback_title_field?: string;
    sub_title_field?: string | null;
    elements: TemplateFieldConfig[];
  };
  level_rules: TemplateLevelRule[];
  default_fallback_rule: {
    heading_tag: string | null;
    include_in_toc: boolean;
    show_heading: boolean;
    fields: TemplateFieldConfig[];
  };
}

export interface DbTemplateRecord {
  id: string;
  label: string;
  description?: string | null;
  type: string;
  config_json?: string | null;
  updated_at: string;
  deleted_at?: string | null;
}