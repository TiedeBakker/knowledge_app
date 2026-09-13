package main

// Object uit tabel 'objects'
type ObjectEntity struct {
	ID             string  `json:"id"`
	Label          string  `json:"label"`
	IsConfidential bool    `json:"isConfidential"`
	ValidFrom      string  `json:"validFrom"`
	ValidTo        *string `json:"validTo,omitempty"` // Pointer voor NULL waarden
	UpdatedAt      string  `json:"updatedAt"`
	DeletedAt      *string `json:"deletedAt,omitempty"` // Pointer voor NULL waarden
}

type RelationValueEntity struct {
	ID             string  `json:"id"`
	RelationID     string  `json:"relationId"`
	RelationLabel  string  `json:"relationLabel"`
	SourceID       string  `json:"sourceId"`
	SourceLabel    string  `json:"sourceLabel"` // Extra: label van het bron-object
	TargetID       string  `json:"targetId"`
	TargetLabel    string  `json:"targetLabel"` // Extra: label van het doel-object
	Volgorde       int     `json:"volgorde"`
	IsConfidential bool    `json:"isConfidential"`
	ValidFrom      string  `json:"validFrom"`
	ValidTo        *string `json:"validTo,omitempty"`
	UpdatedAt      string  `json:"updatedAt"`
	DeletedAt      *string `json:"deletedAt,omitempty"`
}

// Parameterwaarde gekoppeld aan Object of Relatie
type ParameterValueEntity struct {
	ID             string  `json:"id"`
	ParameterID    string  `json:"parameterId"`
	ParameterCode  string  `json:"parameterCode"`  // JOIN met 'parameters'
	ParameterLabel string  `json:"parameterLabel"` // JOIN met 'parameters'
	TargetID       string  `json:"targetId"`
	TargetType     string  `json:"targetType"`
	Value          string  `json:"value"`
	Unit           *string `json:"unit,omitempty"`
	IsConfidential bool    `json:"isConfidential"`
	ValidFrom      string  `json:"validFrom"`
	ValidTo        *string `json:"validTo,omitempty"`
	UpdatedAt      string  `json:"updatedAt"`
	DeletedAt      *string `json:"deletedAt,omitempty"`
}

// Het netwerk dat je in één keer naar je graph-view in de frontend stuurt
type GraphData struct {
	Nodes      []ObjectEntity        `json:"nodes"`
	Edges      []RelationValueEntity `json:"edges"`
	Parameters []ParameterValueEntity `json:"parameters,omitempty"`
}

// TreeNodeData bevat alle unieke objecten en relaties binnen het opgevraagde bereik
type TreeNodeData struct {
	CentralNodeID string                `json:"centralNodeId"`
	InLevels      int                   `json:"inLevels"`
	OutLevels     int                   `json:"outLevels"`
	Nodes         []ObjectEntity        `json:"nodes"`
	Edges         []RelationValueEntity `json:"edges"`
}
type RelationTypeEntity struct {
	ID        string  `json:"id"`
	Label     string  `json:"label"`
	UpdatedAt string  `json:"updatedAt"`
	DeletedAt *string `json:"deletedAt,omitempty"`
}