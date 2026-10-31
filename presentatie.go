package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

// PresentatieTemplateData definieert de structuur van onze simpele JSON template
type PresentatieTemplateData struct {
	Title    string   `json:"title"`
	Codes    []string `json:"codes"`
	DateFrom string   `json:"dateFrom,omitempty"`
	DateTo   string   `json:"dateTo,omitempty"`
}

// PresentatieDataPoint vertegenwoordigt één meetmoment in de resultaattabel / grafiek
type PresentatieDataPoint struct {
	Timestamp string             `json:"timestamp"`
	Values    map[string]float64 `json:"values"`
}

// PresentatieResult is het totale antwoord dat naar de React frontend gaat
type PresentatieResult struct {
	Title  string                 `json:"title"`
	Codes  []string               `json:"codes"`
	Points []PresentatieDataPoint `json:"points"`
}

// GetPresentatieData verwerkt een template-JSON voor een specifieke meetreeks
func (a *App) GetPresentatieData(meetreeksID string, templateJSON string) (*PresentatieResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database niet verbonden")
	}

	// 1. Parse de JSON template
	var tpl PresentatieTemplateData
	err := json.Unmarshal([]byte(templateJSON), &tpl)
	if err != nil {
		return nil, fmt.Errorf("ongeldige JSON template: %v", err)
	}

	if len(tpl.Codes) == 0 {
		return nil, fmt.Errorf("geen parameter codes opgegeven in template")
	}

	// 2. Vraag de ID's op van de parameters die horen bij de opgegeven codes
	placeholders := make([]string, len(tpl.Codes))
	args := make([]interface{}, len(tpl.Codes))

	idToCodeMap := make(map[string]string) // parameter_id -> code

	for i, code := range tpl.Codes {
		placeholders[i] = "?"
		args[i] = strings.ToUpper(strings.TrimSpace(code))
	}

	queryParamIDs := fmt.Sprintf(`
		SELECT id, code 
		FROM parameters 
		WHERE UPPER(code) IN (%s)
		  AND deleted_at IS NULL
	`, strings.Join(placeholders, ","))

	// 🔍 DEBUG 1: Print de query en de codes waar we naar zoeken
	fmt.Printf("[DEBUG GO] Gevraagde codes in template: %v\n", tpl.Codes)
	fmt.Printf("[DEBUG GO] Query parameter IDs args: %v\n", args)

	rowsParams, err := a.db.Query(queryParamIDs, args...)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen parameter ID's: %v", err)
	}
	defer rowsParams.Close()

	for rowsParams.Next() {
		var pID, pCode string
		if err := rowsParams.Scan(&pID, &pCode); err == nil {
			upperCode := strings.ToUpper(pCode)
			idToCodeMap[pID] = upperCode
			// 🔍 DEBUG 2: Print welke parameter_id bij welke code hoort
			fmt.Printf("[DEBUG GO] Gevonden parameter -> ID: %s | Code: %s\n", pID, upperCode)
		}
	}
	fmt.Printf("[DEBUG GO] Totale idToCodeMap gevuld: %v\n", idToCodeMap)
	// 3. Haal de records op uit parameter_values voor de gekoppelde meetreeks (target_id)
	queryMeetwaarden := `
		SELECT id, valid_from, value 
		FROM parameter_values 
		WHERE target_id = ? 
		  AND deleted_at IS NULL
	`
	queryArgs := []interface{}{meetreeksID}

	if tpl.DateFrom != "" {
		queryMeetwaarden += " AND valid_from >= ?"
		queryArgs = append(queryArgs, tpl.DateFrom)
	}
	if tpl.DateTo != "" {
		queryMeetwaarden += " AND valid_from <= ?"
		queryArgs = append(queryArgs, tpl.DateTo)
	}

	queryMeetwaarden += " ORDER BY valid_from ASC"

	rows, err := a.db.Query(queryMeetwaarden, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen meetwaarden: %v", err)
	}
	defer rows.Close()

	var points []PresentatieDataPoint

	// 4. Verwerk de JSON-payload in de 'value' kolom per rij
	for rows.Next() {
		var recID, timestamp, valueJSON string
		if err := rows.Scan(&recID, &timestamp, &valueJSON); err != nil {
			continue
		}

		// 🔍 DEBUG 3: Print de ruwe JSON string uit de database per rij
		fmt.Printf("[DEBUG GO] Rij timestamp: %s | Ruwe valueJSON: %s\n", timestamp, valueJSON)

		var rawValues map[string]interface{}
		if err := json.Unmarshal([]byte(valueJSON), &rawValues); err != nil {
			fmt.Printf("[DEBUG GO] Fout bij unmarshal JSON: %v\n", err)
			continue
		}

		pointValues := make(map[string]float64)

		for pID, rawVal := range rawValues {
			if code, exists := idToCodeMap[pID]; exists {
				var floatVal float64
				switch v := rawVal.(type) {
				case float64:
					floatVal = v
				case string:
					fmt.Sscanf(v, "%f", &floatVal)
				}
				pointValues[code] = floatVal
			} else {
				// 🔍 DEBUG 4: Als een pID uit de database JSON niét in onze idToCodeMap staat
				// (Dit kan verklaren waarom values {} leeg blijft als de UUID's niet matchen!)
				// fmt.Printf("[DEBUG GO] Let op: pID %s komt niet voor in idToCodeMap\n", pID)
			}
		}

		points = append(points, PresentatieDataPoint{
			Timestamp: timestamp,
			Values:    pointValues,
		})
	}

	return &PresentatieResult{
		Title:  tpl.Title,
		Codes:  tpl.Codes,
		Points: points,
	}, nil
}
