package main

import (
	"fmt"
	"regexp"
	"strings"
	"time"
	"log"
)

type SQLQueryRequest struct {
	Query string `json:"query"`
}

type SQLQueryPreviewResult struct {
	Count   int      `json:"count"`
	Columns []string `json:"columns"`
	Error   string   `json:"error,omitempty"`
}

type SQLExecutionResult struct {
	AffectedRows int64  `json:"affectedRows"`
	Success      bool   `json:"success"`
	Message      string `json:"message"`
}

// PreviewSQLQuery inspecteert de query en telt het aantal te verwachten records
func (a *App) PreviewSQLQuery(req SQLQueryRequest) SQLQueryPreviewResult {
	if strings.TrimSpace(req.Query) == "" {
		return SQLQueryPreviewResult{Error: "Query mag niet leeg zijn."}
	}

	rows, err := a.db.Query(req.Query)
	if err != nil {
		return SQLQueryPreviewResult{Error: fmt.Sprintf("SQL fout: %v", err)}
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return SQLQueryPreviewResult{Error: fmt.Sprintf("Kolommen ophalen mislukt: %v", err)}
	}

	count := 0
	for rows.Next() {
		count++
	}

	return SQLQueryPreviewResult{
		Count:   count,
		Columns: cols,
	}
}

// ExecuteBatchInsertWithUUIDv7 voert de insert/generatie uit met je eigen NewUUIDv7()
func (a *App) ExecuteBatchInsertWithUUIDv7(query string, expectedCount int) SQLExecutionResult {
	if strings.TrimSpace(query) == "" {
		return SQLExecutionResult{Success: false, Message: "Query is leeg."}
	}

	// 1. Start een database-transactie
	tx, err := a.db.Begin()
	if err != nil {
		return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Transactie starten mislukt: %v", err)}
	}
	defer tx.Rollback() // Rolbackt automatisch als we niet expliciet tx.Commit() bereiken

	// 2. Als de query een SELECT is (om target_id's op te halen voor de relatie)
	if strings.HasPrefix(strings.ToUpper(strings.TrimSpace(query)), "SELECT") {
		rows, err := tx.Query(query)
		if err != nil {
			return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Ophalen records mislukt: %v", err)}
		}
		defer rows.Close()

		var targetIDs []string
		for rows.Next() {
			var targetID string
			// We gaan er vanuit dat de eerste kolom het target_id is
			if err := rows.Scan(&targetID); err == nil {
				targetIDs = append(targetIDs, targetID)
			}
		}
		rows.Close()

		if len(targetIDs) == 0 {
			return SQLExecutionResult{Success: true, AffectedRows: 0, Message: "Geen records gevonden om in te voegen."}
		}

		// Prepareer de INSERT met jouw vaste relation_id en source_id
		stmt, err := tx.Prepare(`
			INSERT INTO relation_values (
				id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, updated_at
			) VALUES (?, '019fcdd3-721a-7512-b755-cddd67f43eb6', '019fcd20-b1ae-703f-9f24-4ec5fb070853', ?, 0, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
		`)
		if err != nil {
			return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Prepare mislukt: %v", err)}
		}
		defer stmt.Close()

		insertedCount := 0
		for _, targetID := range targetIDs {
			// Genereer voor ELK record een verse UUIDv7 via jouw functie!
			newUUID := NewUUIDv7()

			_, err := stmt.Exec(newUUID, targetID)
			if err != nil {
				return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Fout bij invoegen van record %s: %v", targetID, err)}
			}
			insertedCount++
		}

		// 3. Commit de transactie definitief naar de database
		if err := tx.Commit(); err != nil {
			return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Commit mislukt: %v", err)}
		}

		return SQLExecutionResult{
			Success:      true,
			AffectedRows: int64(insertedCount),
			Message:      fmt.Sprintf("Succesvol %d records aangemaakt met unieke UUIDv7 sleutels.", insertedCount),
		}
	}

	// Directe non-SELECT queries (bijv. directe INSERT/UPDATE statements)
	res, err := tx.Exec(query)
	if err != nil {
		return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Uitvoeren query mislukt: %v", err)}
	}

	if err := tx.Commit(); err != nil {
		return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Commit mislukt: %v", err)}
	}

	affected, _ := res.RowsAffected()
	return SQLExecutionResult{
		Success:      true,
		AffectedRows: affected,
		Message:      fmt.Sprintf("Succesvol %d records verwerkt.", affected),
	}
}

// GenerateSingleUUIDv7 stelt jouw bestaande NewUUIDv7 ook beschikbaar aan de frontend
func (a *App) GenerateSingleUUIDv7() string {
	return NewUUIDv7()
}
// Generieke functie die een INSERT ... SELECT statement met {uuidv7} verwerkt
func (a *App) ExecuteGenericInsertWithUUIDv7(sqlQuery string) SQLExecutionResult {
	queryTrimmed := strings.TrimSpace(sqlQuery)
	// Verwijder eventuele puntkomma aan het einde om syntactische afkapfouten te voorkomen
	queryTrimmed = strings.TrimSuffix(queryTrimmed, ";")

	log.Printf("[DEBUG Toolbox] Ontvangen SQL:\n%s\n", queryTrimmed)

	if queryTrimmed == "" {
		return SQLExecutionResult{Success: false, Message: "SQL-query mag niet leeg zijn."}
	}

	// 1. Vervang {now} door ISO-8601 UTC
	nowISO := time.Now().UTC().Format(time.RFC3339)
	formattedQuery := strings.ReplaceAll(queryTrimmed, "{now}", fmt.Sprintf("'%s'", nowISO))

	// 2. Extraheer het SELECT-gedeelte uit het INSERT-statement
	reSelect := regexp.MustCompile(`(?i)\bSELECT\b[\s\S]*`)
	selectMatch := reSelect.FindString(formattedQuery)
	if selectMatch == "" {
		log.Printf("[DEBUG Toolbox ERROR] Geen SELECT-gedeelte gevonden.")
		return SQLExecutionResult{Success: false, Message: "Geen geldig SELECT-gedeelte gevonden in de query."}
	}

	// Vervang {uuidv7} door NULL voor de SELECT-query
	cleanSelectQuery := strings.ReplaceAll(selectMatch, "{uuidv7}", "NULL")
	log.Printf("[DEBUG Toolbox] Uit te voeren SELECT voor data:\n%s\n", cleanSelectQuery)

	// 3. Start transactie
	tx, err := a.db.Begin()
	if err != nil {
		return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Transactie mislukt: %v", err)}
	}
	defer tx.Rollback()

	// 4. Haal de bronrijen op
	rows, err := tx.Query(cleanSelectQuery)
	if err != nil {
		log.Printf("[DEBUG Toolbox ERROR] SELECT Mislukt: %v", err)
		return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Fout bij uitvoeren SELECT: %v", err)}
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Kolommen uitlezen mislukt: %v", err)}
	}

	var dataset [][]interface{}
	for rows.Next() {
		columns := make([]interface{}, len(cols))
		columnPointers := make([]interface{}, len(cols))
		for i := range columns {
			columnPointers[i] = &columns[i]
		}

		if err := rows.Scan(columnPointers...); err != nil {
			return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Scanfout: %v", err)}
		}

		dataset = append(dataset, columns)
	}
	rows.Close()

	log.Printf("[DEBUG Toolbox] Aantal rijen opgehaald via SELECT: %d", len(dataset))

	if len(dataset) == 0 {
		return SQLExecutionResult{Success: true, AffectedRows: 0, Message: "0 records gevonden om in te voegen."}
	}

	// 5. Bepaal doeltabel en kolommen uit INSERT-gedeelte
	reInsert := regexp.MustCompile(`(?i)INSERT\s+INTO\s+([^\s\(]+)\s*\(([^)]+)\)`)
	matches := reInsert.FindStringSubmatch(formattedQuery)
	if len(matches) < 3 {
		log.Printf("[DEBUG Toolbox ERROR] Kon INSERT structuur niet parsen uit query.")
		return SQLExecutionResult{Success: false, Message: "Kon INSERT INTO tabel- en kolomstructuur niet parsen."}
	}

	tableName := matches[1]
	columnNames := matches[2]

	// Bepaal de index van {uuidv7}
	uuidIndex := -1
	selectClause := strings.Split(selectMatch, "FROM")[0]
	selectCols := strings.Split(strings.TrimPrefix(strings.TrimSpace(selectClause), "SELECT"), ",")

	for i, col := range selectCols {
		if strings.Contains(col, "{uuidv7}") {
			uuidIndex = i;
			break
		}
	}

	placeholders := make([]string, len(cols))
	for i := range placeholders {
		placeholders[i] = "?"
	}

	insertSQL := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", tableName, columnNames, strings.Join(placeholders, ", "))
	log.Printf("[DEBUG Toolbox] Opgebouwde Prepared INSERT SQL:\n%s\n", insertSQL)

	stmt, err := tx.Prepare(insertSQL)
	if err != nil {
		log.Printf("[DEBUG Toolbox ERROR] Prepare mislukt: %v", err)
		return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Prepare mislukt: %v", err)}
	}
	defer stmt.Close()

	// 6. Voer de INSERTs uit
	inserted := 0
	for _, row := range dataset {
		if uuidIndex != -1 {
			row[uuidIndex] = NewUUIDv7()
		}

		_, err := stmt.Exec(row...)
		if err != nil {
			log.Printf("[DEBUG Toolbox ERROR] Invoegen rij %d mislukt: %v", inserted+1, err)
			return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Fout bij invoegen rij %d: %v", inserted+1, err)}
		}
		inserted++
	}

	if err := tx.Commit(); err != nil {
		return SQLExecutionResult{Success: false, Message: fmt.Sprintf("Commit mislukt: %v", err)}
	}

	log.Printf("[DEBUG Toolbox SUCCESS] %d records succesvol verwerkt!", inserted)

	return SQLExecutionResult{
		Success:      true,
		AffectedRows: int64(inserted),
		Message:      fmt.Sprintf("Succesvol %d records ingevoegd met unieke UUIDv7 sleutels.", inserted),
	}
}