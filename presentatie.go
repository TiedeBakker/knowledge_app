package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

// EChartsSeriesTemplate definieert een serie met een eigen labelnaam en parametercode
type EChartsSeriesTemplate struct {
	Name  string `json:"name"`
	Code  string `json:"code"`
	Type  string `json:"type"`
	Stack string `json:"stack,omitempty"`
}

// PresentatieTemplateData leest de flexibele JSON template in
type PresentatieTemplateData struct {
	Codes          []string                `json:"codes,omitempty"`
	Series         []EChartsSeriesTemplate `json:"series,omitempty"`
	DateFrom       string                  `json:"dateFrom,omitempty"`
	DateTo         string                  `json:"dateTo,omitempty"`
	ConnectNulls   bool                    `json:"connectNulls,omitempty"`
	IgnoreZero     bool                    `json:"ignoreZeroValues,omitempty"`
}

type PresentatieDataPoint struct {
	Timestamp string                 `json:"timestamp"`
	Values    map[string]interface{} `json:"values"`
}

// PresentatieResult is het totale antwoord dat naar de React frontend gaat
type PresentatieResult struct {
	Codes        []string               `json:"codes"`
	Points       []PresentatieDataPoint `json:"points"`
	ConnectNulls bool                   `json:"connectNulls"`
	IgnoreZero   bool                   `json:"ignoreZeroValues"`
	RawOption    string                 `json:"rawOption"` // De ruwe JSON-string voor de ECharts viewer
}

// GetPresentatieData verwerkt de template
func (a *App) GetPresentatieData(meetreeksID string, templateJSON string) (*PresentatieResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database niet verbonden")
	}

	// 1. Parse de JSON template
	var tpl PresentatieTemplateData
	if err := json.Unmarshal([]byte(templateJSON), &tpl); err != nil {
		return nil, fmt.Errorf("ongeldige JSON template: %v", err)
	}

	// Haal codes op uit de series-definitie als die daar zijn opgegeven, anders uit de root 'codes' array
	var targetCodes []string
	if len(tpl.Series) > 0 {
		for _, s := range tpl.Series {
			if s.Code != "" {
				targetCodes = append(targetCodes, strings.TrimSpace(s.Code))
			}
		}
	}
	if len(targetCodes) == 0 {
		for _, c := range tpl.Codes {
			targetCodes = append(targetCodes, strings.TrimSpace(c))
		}
	}
	tpl.Codes = targetCodes

	if len(tpl.Codes) == 0 {
		return nil, fmt.Errorf("geen parameter codes opgegeven in template of series")
	}

	// 2. Haal parameter ID's op
	placeholders := make([]string, len(tpl.Codes))
	args := make([]interface{}, len(tpl.Codes))
	idToCodeMap := make(map[string]string)

	for i, code := range tpl.Codes {
		placeholders[i] = "?"
		args[i] = strings.ToUpper(code)
	}

	queryParamIDs := fmt.Sprintf(`
		SELECT id, code 
		FROM parameters 
		WHERE UPPER(code) IN (%s)
		  AND deleted_at IS NULL
	`, strings.Join(placeholders, ","))

	rowsParams, err := a.db.Query(queryParamIDs, args...)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen parameter ID's: %v", err)
	}
	defer rowsParams.Close()

	for rowsParams.Next() {
		var pID, pCode string
		if err := rowsParams.Scan(&pID, &pCode); err == nil {
			idToCodeMap[pID] = strings.ToUpper(pCode)
		}
	}

	// 3. Haal meetwaarden op
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

	for rows.Next() {
		var recID, timestamp, valueJSON string
		if err := rows.Scan(&recID, &timestamp, &valueJSON); err != nil {
			continue
		}

		var rawValues map[string]interface{}
		if err := json.Unmarshal([]byte(valueJSON), &rawValues); err != nil {
			continue
		}

		pointValues := make(map[string]interface{})
		for pID, rawVal := range rawValues {
			if code, exists := idToCodeMap[pID]; exists {
				if rawVal == nil {
					pointValues[code] = nil
					continue
				}

				if strVal, ok := rawVal.(string); ok {
					strVal = strings.TrimSpace(strVal)
					if strVal == "" {
						pointValues[code] = nil
						continue
					}
					var floatVal float64
					if _, err := fmt.Sscanf(strVal, "%f", &floatVal); err == nil {
						pointValues[code] = floatVal
					} else {
						pointValues[code] = strVal
					}
				} else {
					pointValues[code] = rawVal
				}
			}
		}

		points = append(points, PresentatieDataPoint{
			Timestamp: timestamp,
			Values:    pointValues,
		})
	}

	return &PresentatieResult{
		Codes:        tpl.Codes,
		Points:       points,
		ConnectNulls: tpl.ConnectNulls,
		IgnoreZero:   tpl.IgnoreZero,
		RawOption:    templateJSON, // Stuur de exacte ruwe JSON-string mee voor de frontend
	}, nil
}