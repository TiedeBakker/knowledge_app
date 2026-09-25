package main

import (
	"fmt"
)

type GraphNode struct {
	ID            string      `json:"id"`
	Label         string      `json:"label"`
	RelationType  string      `json:"relationType,omitempty"`
	RelationValue int         `json:"relationValue,omitempty"`
	Incoming      []GraphNode `json:"incoming,omitempty"`
	Children      []GraphNode `json:"children,omitempty"`
	TotalChildren int         `json:"totalChildren,omitempty"`
	HasMore       bool        `json:"hasMore,omitempty"`
}

const ChildLimit = 12 // Aantal sub-objecten dat maximaal per tak in de boom getoond wordt

// GetObjectTree haalt het centrale object op, 1 niveau ingaande relaties en N niveaus uitgaande relaties.
func (a *App) GetObjectTree(rootID string, maxDepth int) (*GraphNode, error) {
	if rootID == "" {
		return nil, nil
	}

	// 1. Haal details van het centrale object op
	rootNode := &GraphNode{ID: rootID}
	err := a.db.QueryRow(`SELECT label FROM objects WHERE id = ? AND deleted_at IS NULL`, rootID).Scan(&rootNode.Label)
	if err != nil {
		return nil, fmt.Errorf("centraal object niet gevonden: %w", err)
	}

	// 2. Haal 1 niveau INGAANDE relaties op (objecten die naar dit rootID verwijzen)
	incomingRows, err := a.db.Query(`
		SELECT 
			o.id, 
			o.label, 
			COALESCE(r.label, '') AS relation_type, 
			rv.volgorde
		FROM relation_values rv
		JOIN objects o ON o.id = rv.source_id
		LEFT JOIN relations r ON r.id = rv.relation_id AND r.deleted_at IS NULL
		WHERE rv.target_id = ? 
		  AND rv.deleted_at IS NULL 
		  AND o.deleted_at IS NULL
		ORDER BY rv.volgorde ASC, o.label ASC
	`, rootID)

	if err == nil {
		defer incomingRows.Close()
		for incomingRows.Next() {
			var inc GraphNode
			if err := incomingRows.Scan(&inc.ID, &inc.Label, &inc.RelationType, &inc.RelationValue); err == nil {
				rootNode.Incoming = append(rootNode.Incoming, inc)
			}
		}
	}

	// 3. Haal N niveaus UITGAANDE relaties op (recursief met limiet)
	if maxDepth > 0 {
		rootNode.Children = a.fetchChildrenRecursive(rootID, 1, maxDepth)
	}

	return rootNode, nil
}

func (a *App) fetchChildrenRecursive(parentID string, currentDepth, maxDepth int) []GraphNode {
	if currentDepth > maxDepth {
		return nil
	}

	// 1. Tel het TOTAAL aantal kinderen in de database voor deze parent
	var totalCount int
	err := a.db.QueryRow(`
		SELECT COUNT(*)
		FROM relation_values rv
		JOIN objects o ON o.id = rv.target_id
		WHERE rv.source_id = ? 
		  AND rv.deleted_at IS NULL 
		  AND o.deleted_at IS NULL
	`, parentID).Scan(&totalCount)

	if err != nil || totalCount == 0 {
		return nil
	}

	// 2. Haal alleen de eerste N kinderen op
	rows, err := a.db.Query(`
		SELECT 
			o.id, 
			o.label, 
			COALESCE(r.label, '') AS relation_type, 
			rv.volgorde
		FROM relation_values rv
		JOIN objects o ON o.id = rv.target_id
		LEFT JOIN relations r ON r.id = rv.relation_id AND r.deleted_at IS NULL
		WHERE rv.source_id = ? 
		  AND rv.deleted_at IS NULL 
		  AND o.deleted_at IS NULL
		ORDER BY rv.volgorde ASC, o.label ASC
		LIMIT ?
	`, parentID, ChildLimit)

	if err != nil {
		return nil
	}
	defer rows.Close()

	var children []GraphNode
	for rows.Next() {
		var child GraphNode
		if err := rows.Scan(&child.ID, &child.Label, &child.RelationType, &child.RelationValue); err == nil {
			// Recursie voor de volgende laag
			if currentDepth < maxDepth {
				child.Children = a.fetchChildrenRecursive(child.ID, currentDepth+1, maxDepth)
			}
			children = append(children, child)
		}
	}

	// 3. Voeg virtuele "Toon meer" fiche toe als er meer objecten zijn dan ChildLimit
	if totalCount > ChildLimit {
		remaining := totalCount - ChildLimit
		children = append(children, GraphNode{
			ID:            parentID, // Verwijst naar de ouder zelf om deze centraal te stellen
			Label:         fmt.Sprintf("+ %d meer objecten...", remaining),
			RelationType:  "OVERFLOW",
			TotalChildren: totalCount,
			HasMore:       true,
		})
	}

	return children
}