package main

import (
	"fmt"
)

type SimpleObject struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// GetObjectsForSelector haalt actieve objecten op (Soft-deleted uitgesloten)
func (a *App) GetObjectsForSelector() ([]SimpleObject, error) {
	query := `
		SELECT id, label 
		FROM objects 
		WHERE deleted_at IS NULL 
		ORDER BY label ASC
	`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen objecten: %w", err)
	}
	defer rows.Close()

	var results []SimpleObject
	for rows.Next() {
		var obj SimpleObject
		if err := rows.Scan(&obj.ID, &obj.Label); err != nil {
			return nil, err
		}
		results = append(results, obj)
	}

	return results, nil
}