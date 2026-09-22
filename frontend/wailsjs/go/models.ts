export namespace main {
	
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

