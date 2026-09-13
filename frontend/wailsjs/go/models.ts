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

