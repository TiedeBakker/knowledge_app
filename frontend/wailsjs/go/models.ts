export namespace main {
	
	export class DbTemplateRecord {
	    id: string;
	    label: string;
	    description?: string;
	    type: string;
	    config_json?: string;
	    updated_at: string;
	    deleted_at?: string;
	
	    static createFrom(source: any = {}) {
	        return new DbTemplateRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.description = source["description"];
	        this.type = source["type"];
	        this.config_json = source["config_json"];
	        this.updated_at = source["updated_at"];
	        this.deleted_at = source["deleted_at"];
	    }
	}
	export class TemplateFieldConfig {
	    field: string;
	    fallback?: string;
	    type: string;
	    css_class?: string;
	    role?: string;
	
	    static createFrom(source: any = {}) {
	        return new TemplateFieldConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.field = source["field"];
	        this.fallback = source["fallback"];
	        this.type = source["type"];
	        this.css_class = source["css_class"];
	        this.role = source["role"];
	    }
	}
	export class DefaultFallbackRule {
	    heading_tag?: string;
	    include_in_toc: boolean;
	    show_heading: boolean;
	    fields: TemplateFieldConfig[];
	
	    static createFrom(source: any = {}) {
	        return new DefaultFallbackRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.heading_tag = source["heading_tag"];
	        this.include_in_toc = source["include_in_toc"];
	        this.show_heading = source["show_heading"];
	        this.fields = this.convertValues(source["fields"], TemplateFieldConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NumberingConfig {
	    type: string;
	    separator: string;
	    stop_at_level: number;
	
	    static createFrom(source: any = {}) {
	        return new NumberingConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.separator = source["separator"];
	        this.stop_at_level = source["stop_at_level"];
	    }
	}
	export class TOCConfig {
	    enabled: boolean;
	    max_depth: number;
	    title: string;
	
	    static createFrom(source: any = {}) {
	        return new TOCConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.max_depth = source["max_depth"];
	        this.title = source["title"];
	    }
	}
	export class GlobalSettings {
	    toc: TOCConfig;
	    numbering: NumberingConfig;
	
	    static createFrom(source: any = {}) {
	        return new GlobalSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.toc = this.convertValues(source["toc"], TOCConfig);
	        this.numbering = this.convertValues(source["numbering"], NumberingConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ParameterValueEntity {
	    id: string;
	    parameterId: string;
	    parameterCode: string;
	    parameterLabel: string;
	    dataType: string;
	    targetId: string;
	    targetType: string;
	    value: string;
	    unit?: string;
	    isConfidential: boolean;
	    validFrom: string;
	    validTo?: string;
	    updatedAt: string;
	    deletedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new ParameterValueEntity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.parameterId = source["parameterId"];
	        this.parameterCode = source["parameterCode"];
	        this.parameterLabel = source["parameterLabel"];
	        this.dataType = source["dataType"];
	        this.targetId = source["targetId"];
	        this.targetType = source["targetType"];
	        this.value = source["value"];
	        this.unit = source["unit"];
	        this.isConfidential = source["isConfidential"];
	        this.validFrom = source["validFrom"];
	        this.validTo = source["validTo"];
	        this.updatedAt = source["updatedAt"];
	        this.deletedAt = source["deletedAt"];
	    }
	}
	export class RelationValueEntity {
	    id: string;
	    relationId: string;
	    relationLabel: string;
	    sourceId: string;
	    sourceLabel: string;
	    targetId: string;
	    targetLabel: string;
	    volgorde: number;
	    isConfidential: boolean;
	    validFrom: string;
	    validTo?: string;
	    updatedAt: string;
	    deletedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new RelationValueEntity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.relationId = source["relationId"];
	        this.relationLabel = source["relationLabel"];
	        this.sourceId = source["sourceId"];
	        this.sourceLabel = source["sourceLabel"];
	        this.targetId = source["targetId"];
	        this.targetLabel = source["targetLabel"];
	        this.volgorde = source["volgorde"];
	        this.isConfidential = source["isConfidential"];
	        this.validFrom = source["validFrom"];
	        this.validTo = source["validTo"];
	        this.updatedAt = source["updatedAt"];
	        this.deletedAt = source["deletedAt"];
	    }
	}
	export class ObjectEntity {
	    id: string;
	    label: string;
	    isConfidential: boolean;
	    validFrom: string;
	    validTo?: string;
	    updatedAt: string;
	    deletedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new ObjectEntity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.isConfidential = source["isConfidential"];
	        this.validFrom = source["validFrom"];
	        this.validTo = source["validTo"];
	        this.updatedAt = source["updatedAt"];
	        this.deletedAt = source["deletedAt"];
	    }
	}
	export class GraphData {
	    nodes: ObjectEntity[];
	    edges: RelationValueEntity[];
	    parameters?: ParameterValueEntity[];
	
	    static createFrom(source: any = {}) {
	        return new GraphData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nodes = this.convertValues(source["nodes"], ObjectEntity);
	        this.edges = this.convertValues(source["edges"], RelationValueEntity);
	        this.parameters = this.convertValues(source["parameters"], ParameterValueEntity);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GraphNode {
	    id: string;
	    label: string;
	    relationType?: string;
	    relationValue?: number;
	    incoming?: GraphNode[];
	    children?: GraphNode[];
	    totalChildren?: number;
	    hasMore?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GraphNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.relationType = source["relationType"];
	        this.relationValue = source["relationValue"];
	        this.incoming = this.convertValues(source["incoming"], GraphNode);
	        this.children = this.convertValues(source["children"], GraphNode);
	        this.totalChildren = source["totalChildren"];
	        this.hasMore = source["hasMore"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MediaMetadataJSON {
	    opnamedatum: string;
	    oorspronkelijkFormaat: string;
	    latitude: string;
	    longitude: string;
	    device: string;
	
	    static createFrom(source: any = {}) {
	        return new MediaMetadataJSON(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.opnamedatum = source["opnamedatum"];
	        this.oorspronkelijkFormaat = source["oorspronkelijkFormaat"];
	        this.latitude = source["latitude"];
	        this.longitude = source["longitude"];
	        this.device = source["device"];
	    }
	}
	export class MediaImportItem {
	    originalPath: string;
	    fileName: string;
	    mediaType: string;
	    destinationPath: string;
	    hasExactDate: boolean;
	    metadata: MediaMetadataJSON;
	
	    static createFrom(source: any = {}) {
	        return new MediaImportItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.originalPath = source["originalPath"];
	        this.fileName = source["fileName"];
	        this.mediaType = source["mediaType"];
	        this.destinationPath = source["destinationPath"];
	        this.hasExactDate = source["hasExactDate"];
	        this.metadata = this.convertValues(source["metadata"], MediaMetadataJSON);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class ObjectSelectItem {
	    id: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new ObjectSelectItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	    }
	}
	export class ObjectSummary {
	    id: string;
	    label: string;
	    is_confidential: boolean;
	    valid_from: string;
	    valid_to?: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new ObjectSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.is_confidential = source["is_confidential"];
	        this.valid_from = source["valid_from"];
	        this.valid_to = source["valid_to"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class ObjectTypeOption {
	    id: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new ObjectTypeOption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	    }
	}
	export class ParameterDefinition {
	    id: string;
	    label: string;
	    code: string;
	    dataType: string;
	    unit?: string;
	
	    static createFrom(source: any = {}) {
	        return new ParameterDefinition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.code = source["code"];
	        this.dataType = source["dataType"];
	        this.unit = source["unit"];
	    }
	}
	export class ParameterSummary {
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
	
	    static createFrom(source: any = {}) {
	        return new ParameterSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.parameter_id = source["parameter_id"];
	        this.parameter_code = source["parameter_code"];
	        this.parameter_label = source["parameter_label"];
	        this.data_type = source["data_type"];
	        this.target_id = source["target_id"];
	        this.target_type = source["target_type"];
	        this.value = source["value"];
	        this.unit = source["unit"];
	        this.is_confidential = source["is_confidential"];
	        this.valid_from = source["valid_from"];
	        this.valid_to = source["valid_to"];
	    }
	}
	
	export class RelationSummary {
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
	
	    static createFrom(source: any = {}) {
	        return new RelationSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.relation_id = source["relation_id"];
	        this.relation_label = source["relation_label"];
	        this.source_id = source["source_id"];
	        this.source_label = source["source_label"];
	        this.target_id = source["target_id"];
	        this.target_label = source["target_label"];
	        this.volgorde = source["volgorde"];
	        this.is_confidential = source["is_confidential"];
	        this.valid_from = source["valid_from"];
	        this.valid_to = source["valid_to"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class RelationTypeEntity {
	    id: string;
	    label: string;
	    updatedAt: string;
	    deletedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new RelationTypeEntity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.updatedAt = source["updatedAt"];
	        this.deletedAt = source["deletedAt"];
	    }
	}
	
	export class TemplateFilter {
	    allowed_object_types?: string[];
	    excluded_object_types?: string[];
	
	    static createFrom(source: any = {}) {
	        return new TemplateFilter(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.allowed_object_types = source["allowed_object_types"];
	        this.excluded_object_types = source["excluded_object_types"];
	    }
	}
	export class TemplateLevelRule {
	    level: number;
	    name: string;
	    heading_tag?: string;
	    page_break_before: boolean;
	    include_in_toc: boolean;
	    filter?: TemplateFilter;
	    fields: TemplateFieldConfig[];
	
	    static createFrom(source: any = {}) {
	        return new TemplateLevelRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.level = source["level"];
	        this.name = source["name"];
	        this.heading_tag = source["heading_tag"];
	        this.page_break_before = source["page_break_before"];
	        this.include_in_toc = source["include_in_toc"];
	        this.filter = this.convertValues(source["filter"], TemplateFilter);
	        this.fields = this.convertValues(source["fields"], TemplateFieldConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RootLevelConfig {
	    title_field: string;
	    fallback_title_field?: string;
	    sub_title_field?: string;
	    elements: TemplateFieldConfig[];
	
	    static createFrom(source: any = {}) {
	        return new RootLevelConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title_field = source["title_field"];
	        this.fallback_title_field = source["fallback_title_field"];
	        this.sub_title_field = source["sub_title_field"];
	        this.elements = this.convertValues(source["elements"], TemplateFieldConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ReportTemplateConfig {
	    id: string;
	    naam: string;
	    type: string;
	    version: number;
	    global_settings: GlobalSettings;
	    root_level: RootLevelConfig;
	    level_rules: TemplateLevelRule[];
	    default_fallback_rule: DefaultFallbackRule;
	
	    static createFrom(source: any = {}) {
	        return new ReportTemplateConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.naam = source["naam"];
	        this.type = source["type"];
	        this.version = source["version"];
	        this.global_settings = this.convertValues(source["global_settings"], GlobalSettings);
	        this.root_level = this.convertValues(source["root_level"], RootLevelConfig);
	        this.level_rules = this.convertValues(source["level_rules"], TemplateLevelRule);
	        this.default_fallback_rule = this.convertValues(source["default_fallback_rule"], DefaultFallbackRule);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ReportTreeNode {
	    object: ObjectSummary;
	    parameters: ParameterSummary[];
	    relation?: RelationSummary;
	    children: ReportTreeNode[];
	
	    static createFrom(source: any = {}) {
	        return new ReportTreeNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.object = this.convertValues(source["object"], ObjectSummary);
	        this.parameters = this.convertValues(source["parameters"], ParameterSummary);
	        this.relation = this.convertValues(source["relation"], RelationSummary);
	        this.children = this.convertValues(source["children"], ReportTreeNode);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SimpleObject {
	    id: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new SimpleObject(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	    }
	}
	
	
	
	
	export class TreeNodeData {
	    centralNodeId: string;
	    inLevels: number;
	    outLevels: number;
	    nodes: ObjectEntity[];
	    edges: RelationValueEntity[];
	
	    static createFrom(source: any = {}) {
	        return new TreeNodeData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.centralNodeId = source["centralNodeId"];
	        this.inLevels = source["inLevels"];
	        this.outLevels = source["outLevels"];
	        this.nodes = this.convertValues(source["nodes"], ObjectEntity);
	        this.edges = this.convertValues(source["edges"], RelationValueEntity);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

