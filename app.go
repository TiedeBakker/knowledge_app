package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	_ "github.com/glebarez/go-sqlite"
	
	// Geef Wails runtime een alias:
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
	db  *sql.DB
}

func NewApp() *App {
	return &App{}
}

// startup wordt automatisch aangeroepen door Wails bij het starten van de app
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Bepaal het pad naar de database (relatief t.o.v. de .exe)
	exePath, err := os.Executable()
	if err != nil {
		fmt.Println("Fout bij bepalen pad:", err)
		return
	}
	baseDir := filepath.Dir(exePath)
	dbPath := filepath.Join(baseDir, "knowledge.db")

	// Voor development: als de DB niet naast de exe staat, zoek in de huidige werkmap
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		dbPath = "knowledge.db"
	}

	// Open de SQLite database
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Println("Fout bij openen van SQLite DB:", err)
		return
	}
	a.db = db
	fmt.Println("Succesvol verbonden met SQLite database op:", dbPath)
}
// Haalt een netwerk (nodes + edges + optioneel hun parameters) op
func (a *App) GetGraphNetwork(includeConfidential bool, limit int) (GraphData, error) {
	var data GraphData

	if a.db == nil {
		return data, fmt.Errorf("Database is niet verbonden")
	}

	// 1. OBJECTEN (Nodes)
	// Negeer soft-deleted records en filter eventueel op vertrouwelijkheid
	nodeQuery := `
		SELECT id, label, is_confidential, valid_from, valid_to 
		FROM objects 
		WHERE deleted_at IS NULL`
	
	if !includeConfidential {
		nodeQuery += " AND is_confidential = 0"
	}
	nodeQuery += " LIMIT ?"

	nodeRows, err := a.db.Query(nodeQuery, limit)
	if err != nil {
		return data, fmt.Errorf("fout bij ophalen objecten: %w", err)
	}
	defer nodeRows.Close()

	for nodeRows.Next() {
		var o ObjectEntity
		var validTo sql.NullString
		if err := nodeRows.Scan(&o.ID, &o.Label, &o.IsConfidential, &o.ValidFrom, &validTo); err != nil {
			continue
		}
		if validTo.Valid {
			o.ValidTo = &validTo.String
		}
		data.Nodes = append(data.Nodes, o)
	}

	// 2. RELATIES (Edges) met JOIN naar 'relations' voor het label
	edgeQuery := `
		SELECT 
			rv.id, rv.relation_id, r.label, rv.source_id, rv.target_id, 
			rv.volgorde, rv.is_confidential, rv.valid_from, rv.valid_to
		FROM relation_values rv
		JOIN relations r ON rv.relation_id = r.id
		WHERE rv.deleted_at IS NULL AND r.deleted_at IS NULL`

	if !includeConfidential {
		edgeQuery += " AND rv.is_confidential = 0"
	}
	edgeQuery += " LIMIT ?"

	edgeRows, err := a.db.Query(edgeQuery, limit)
	if err != nil {
		return data, fmt.Errorf("fout bij ophalen relaties: %w", err)
	}
	defer edgeRows.Close()

	for edgeRows.Next() {
		var e RelationValueEntity
		var validTo sql.NullString
		if err := edgeRows.Scan(
			&e.ID, &e.RelationID, &e.RelationLabel, &e.SourceID, &e.TargetID,
			&e.Volgorde, &e.IsConfidential, &e.ValidFrom, &validTo,
		); err != nil {
			continue
		}
		if validTo.Valid {
			e.ValidTo = &validTo.String
		}
		data.Edges = append(data.Edges, e)
	}

	return data, nil
}

// Haalt alle actuele parameterwaarden van één specifiek object of relatie op
func (a *App) GetParametersForTarget(targetID string) ([]ParameterValueEntity, error) {
	var result []ParameterValueEntity

	query := `
		SELECT 
			pv.id, pv.parameter_id, p.code, p.label,p.data_type, pv.target_id, pv.target_type, 
			pv.value, p.unit, pv.is_confidential, pv.valid_from, pv.valid_to
		FROM parameter_values pv
		JOIN parameters p ON pv.parameter_id = p.id
		WHERE pv.target_id = ? AND pv.deleted_at IS NULL AND p.deleted_at IS NULL`

	rows, err := a.db.Query(query, targetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var pv ParameterValueEntity
		var unit, validTo sql.NullString
		if err := rows.Scan(
			&pv.ID, &pv.ParameterID, &pv.ParameterCode, &pv.ParameterLabel, &pv.DataType,
			&pv.TargetID, &pv.TargetType, &pv.Value, &unit, &pv.IsConfidential,
			&pv.ValidFrom, &validTo,
		); err != nil {
			continue
		}
		if unit.Valid {
			pv.Unit = &unit.String
		}
		if validTo.Valid {
			pv.ValidTo = &validTo.String
		}
		result = append(result, pv)
	}

	return result, nil
}

// SearchNodesForSelect zoekt op label en sorteert op relevantie (exact > begint met > bevat)
func (a *App) SearchNodesForSelect(searchTerm string, limit int) ([]ObjectEntity, error) {
	var results []ObjectEntity
	if a.db == nil {
		return results, fmt.Errorf("database niet verbonden")
	}

	// Als er geen zoekterm is ingesteld, geef gewoon de eerste N op alfabetische volgorde
	if searchTerm == "" {
		query := `
			SELECT id, label, is_confidential, valid_from, valid_to 
			FROM objects 
			WHERE deleted_at IS NULL 
			ORDER BY label ASC 
			LIMIT ?`

		rows, err := a.db.Query(query, limit)
		if err != nil {
			return results, err
		}
		defer rows.Close()

		for rows.Next() {
			var o ObjectEntity
			var validTo sql.NullString
			if err := rows.Scan(&o.ID, &o.Label, &o.IsConfidential, &o.ValidFrom, &validTo); err != nil {
				continue
			}
			if validTo.Valid {
				o.ValidTo = &validTo.String
			}
			results = append(results, o)
		}
		return results, nil
	}

	// Met zoekterm: Prioriteer op match-kwaliteit via CASE statement
	query := `
		SELECT id, label, is_confidential, valid_from, valid_to,
			CASE 
				WHEN LOWER(label) = LOWER(?) THEN 1          -- Exacte match (ongevoelig voor hoofdletters)
				WHEN LOWER(label) LIKE LOWER(?) THEN 2      -- Begint met zoekterm
				ELSE 3                                      -- Bevat zoekterm elders
			END AS relevance
		FROM objects 
		WHERE deleted_at IS NULL AND label LIKE ? 
		ORDER BY relevance ASC, label ASC 
		LIMIT ?`

	exactMatch := searchTerm
	startsWith := searchTerm + "%"
	contains := "%" + searchTerm + "%"

	rows, err := a.db.Query(query, exactMatch, startsWith, contains, limit)
	if err != nil {
		return results, err
	}
	defer rows.Close()

	for rows.Next() {
		var o ObjectEntity
		var validTo sql.NullString
		var relevance int // Vangen we op uit de SELECT query

		if err := rows.Scan(&o.ID, &o.Label, &o.IsConfidential, &o.ValidFrom, &validTo, &relevance); err != nil {
			continue
		}
		if validTo.Valid {
			o.ValidTo = &validTo.String
		}
		results = append(results, o)
	}

	return results, nil
}
type TreeResponse struct {
	CentralNode ObjectEntity          `json:"centralNode"`
	Inbound     []RelationValueEntity `json:"inbound"`
	Outbound    []RelationValueEntity `json:"outbound"`
	Nodes       map[string]ObjectEntity `json:"nodes"` // Alle betrokken nodes op ID
}

// GetTreeForNode haalt inkomende en uitgaande relaties op tot N niveaus diep
func (a *App) GetTreeForNode(centralNodeID string, inLevels int, outLevels int) (TreeNodeData, error) {
	var result TreeNodeData
	result.CentralNodeID = centralNodeID
	result.InLevels = inLevels
	result.OutLevels = outLevels

	if a.db == nil {
		return result, fmt.Errorf("database niet verbonden")
	}

	// Map om dubbele nodes en edges te voorkomen
	nodeMap := make(map[string]ObjectEntity)
	edgeMap := make(map[string]RelationValueEntity)

	// 1. Haal de centrale node zelf op
	var centralNode ObjectEntity
	var validTo sql.NullString
	err := a.db.QueryRow(`
		SELECT id, label, is_confidential, valid_from, valid_to 
		FROM objects 
		WHERE id = ? AND deleted_at IS NULL`, centralNodeID).Scan(
		&centralNode.ID, &centralNode.Label, &centralNode.IsConfidential, &centralNode.ValidFrom, &validTo,
	)
	if err != nil {
		return result, fmt.Errorf("centrale node niet gevonden: %w", err)
	}
	if validTo.Valid {
		centralNode.ValidTo = &validTo.String
	}
	nodeMap[centralNode.ID] = centralNode

	// 2. UITGAANDE RELATIES (Traverse via target_id, tot outLevels diep)
	if outLevels > 0 {
		outQuery := `
			WITH RECURSIVE outbound_tree(id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, valid_to, depth) AS (
				-- Anchor: start bij relaties waar source_id = centrale node
				SELECT id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, valid_to, 1 AS depth
				FROM relation_values
				WHERE source_id = ? AND deleted_at IS NULL
				
				UNION ALL
				
				-- Recursive step: volg uitgaande relaties verder
				SELECT rv.id, rv.relation_id, rv.source_id, rv.target_id, rv.volgorde, rv.is_confidential, rv.valid_from, rv.valid_to, ot.depth + 1
				FROM relation_values rv
				JOIN outbound_tree ot ON rv.source_id = ot.target_id
				WHERE rv.deleted_at IS NULL AND ot.depth < ?
			)
			SELECT 
				ot.id, ot.relation_id, r.label, ot.source_id, ot.target_id, 
				ot.volgorde, ot.is_confidential, ot.valid_from, ot.valid_to
			FROM outbound_tree ot
			JOIN relations r ON ot.relation_id = r.id
			WHERE r.deleted_at IS NULL;`

		rows, err := a.db.Query(outQuery, centralNodeID, outLevels)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var e RelationValueEntity
				var vTo sql.NullString
				if err := rows.Scan(&e.ID, &e.RelationID, &e.RelationLabel, &e.SourceID, &e.TargetID, &e.Volgorde, &e.IsConfidential, &e.ValidFrom, &vTo); err == nil {
					if vTo.Valid {
						e.ValidTo = &vTo.String
					}
					edgeMap[e.ID] = e
				}
			}
		}
	}

	// 3. INKOMENDE RELATIES (Traverse via source_id, tot inLevels diep)
	if inLevels > 0 {
		inQuery := `
			WITH RECURSIVE inbound_tree(id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, valid_to, depth) AS (
				-- Anchor: start bij relaties waar target_id = centrale node
				SELECT id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, valid_to, 1 AS depth
				FROM relation_values
				WHERE target_id = ? AND deleted_at IS NULL
				
				UNION ALL
				
				-- Recursive step: volg inkomende relaties verder terug
				SELECT rv.id, rv.relation_id, rv.source_id, rv.target_id, rv.volgorde, rv.is_confidential, rv.valid_from, rv.valid_to, it.depth + 1
				FROM relation_values rv
				JOIN inbound_tree it ON rv.target_id = it.source_id
				WHERE rv.deleted_at IS NULL AND it.depth < ?
			)
			SELECT 
				it.id, it.relation_id, r.label, it.source_id, it.target_id, 
				it.volgorde, it.is_confidential, it.valid_from, it.valid_to
			FROM inbound_tree it
			JOIN relations r ON it.relation_id = r.id
			WHERE r.deleted_at IS NULL;`

		rows, err := a.db.Query(inQuery, centralNodeID, inLevels)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var e RelationValueEntity
				var vTo sql.NullString
				if err := rows.Scan(&e.ID, &e.RelationID, &e.RelationLabel, &e.SourceID, &e.TargetID, &e.Volgorde, &e.IsConfidential, &e.ValidFrom, &vTo); err == nil {
					if vTo.Valid {
						e.ValidTo = &vTo.String
					}
					edgeMap[e.ID] = e
				}
			}
		}
	}

	// 4. Verzamel de gegevens van alle betrokken gerelateerde objecten (nodes)
	nodeIDsToFetch := make(map[string]bool)
	for _, edge := range edgeMap {
		nodeIDsToFetch[edge.SourceID] = true
		nodeIDsToFetch[edge.TargetID] = true
	}
	delete(nodeIDsToFetch, centralNodeID) // Centrale node hadden we al

	if len(nodeIDsToFetch) > 0 {
		// Bouw dynamische IN query voor alle gevonden node IDs
		var ids []interface{}
		queryPlaceholders := ""
		for id := range nodeIDsToFetch {
			ids = append(ids, id)
			if queryPlaceholders != "" {
				queryPlaceholders += ","
			}
			queryPlaceholders += "?"
		}

		nodeQuery := fmt.Sprintf(`
			SELECT id, label, is_confidential, valid_from, valid_to 
			FROM objects 
			WHERE id IN (%s) AND deleted_at IS NULL`, queryPlaceholders)

		rows, err := a.db.Query(nodeQuery, ids...)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var o ObjectEntity
				var vTo sql.NullString
				if err := rows.Scan(&o.ID, &o.Label, &o.IsConfidential, &o.ValidFrom, &vTo); err == nil {
					if vTo.Valid {
						o.ValidTo = &vTo.String
					}
					nodeMap[o.ID] = o
				}
			}
		}
	}

	// Convert maps naar slices voor de JSON respons
	for _, node := range nodeMap {
		result.Nodes = append(result.Nodes, node)
	}
	for _, edge := range edgeMap {
		result.Edges = append(result.Edges, edge)
	}

	return result, nil
}
// UpdateObject werk een bestaand object bij in de SQLite database
func (a *App) UpdateObject(obj ObjectEntity) error {
	query := `
		UPDATE objects 
		SET 
			label = ?, 
			is_confidential = ?, 
			valid_from = ?, 
			valid_to = ?, 
			updated_at = ?, 
			deleted_at = ?
		WHERE id = ?`

	_, err := a.db.Exec(query, 
		obj.Label, 
		obj.IsConfidential, 
		obj.ValidFrom, 
		obj.ValidTo, 
		obj.UpdatedAt, 
		obj.DeletedAt, 
		obj.ID,
	)
	if err != nil {
		log.Printf("Fout bij bijwerken object %s: %v", obj.ID, err)
		return err
	}

	return nil
}
func (a *App) GetRelationsForTarget(targetID string) ([]RelationValueEntity, error) {
	query := `
		SELECT 
			rv.id,
			rv.relation_id,
			r.label AS relation_label,
			rv.source_id,
			COALESCE(so.label, '') AS source_label,
			rv.target_id,
			COALESCE(to_obj.label, '') AS target_label,
			rv.volgorde,
			rv.is_confidential,
			rv.valid_from,
			rv.valid_to,
			rv.updated_at,
			rv.deleted_at
		FROM relation_values rv
		JOIN relations r ON r.id = rv.relation_id
		LEFT JOIN objects so ON so.id = rv.source_id
		LEFT JOIN objects to_obj ON to_obj.id = rv.target_id
		WHERE (rv.source_id = ? OR rv.target_id = ?)
		  AND rv.deleted_at IS NULL
		ORDER BY rv.volgorde ASC
	`

	rows, err := a.db.QueryContext(a.ctx, query, targetID, targetID)
	if err != nil {
		log.Printf("Fout bij ophalen relaties voor target %s: %v", targetID, err)
		return nil, fmt.Errorf("fout bij ophalen relaties: %w", err)
	}
	defer rows.Close()

	var relations []RelationValueEntity
	for rows.Next() {
		var rel RelationValueEntity
		var validTo, updatedAt, deletedAt sql.NullString

		err := rows.Scan(
			&rel.ID,
			&rel.RelationID,
			&rel.RelationLabel,
			&rel.SourceID,
			&rel.SourceLabel,
			&rel.TargetID,
			&rel.TargetLabel,
			&rel.Volgorde,
			&rel.IsConfidential,
			&rel.ValidFrom,
			&validTo,
			&updatedAt,
			&deletedAt,
		)
		if err != nil {
			log.Printf("Fout bij scannen relatie: %v", err)
			continue
		}

		if validTo.Valid {
			rel.ValidTo = &validTo.String
		}
		if updatedAt.Valid {
			rel.UpdatedAt = updatedAt.String
		}
		if deletedAt.Valid {
			rel.DeletedAt = &deletedAt.String
		}

		relations = append(relations, rel)
	}

	return relations, nil
}
// GetAllRelationsTypes haalt de lijst met beschikbare relatietypes op (uit tabel 'relations')
func (a *App) GetAllRelationsTypes() ([]RelationTypeEntity, error) {
	query := `
		SELECT id, label, updated_at, deleted_at 
		FROM relations 
		WHERE deleted_at IS NULL 
		ORDER BY label ASC
	`
	rows, err := a.db.QueryContext(a.ctx, query)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen relatietypes: %w", err)
	}
	defer rows.Close()

	var types []RelationTypeEntity
	for rows.Next() {
		var rt RelationTypeEntity
		var deletedAt sql.NullString

		if err := rows.Scan(&rt.ID, &rt.Label, &rt.UpdatedAt, &deletedAt); err != nil {
			continue
		}
		if deletedAt.Valid {
			rt.DeletedAt = &deletedAt.String
		}
		types = append(types, rt)
	}
	return types, nil
}
// GetAllObjectsSimple haalt een eenvoudige lijst van alle objecten op (voor de dropdown bij aanmaken/bewerken)
func (a *App) GetAllObjectsSimple() ([]ObjectEntity, error) {
	query := `SELECT id, label FROM objects WHERE deleted_at IS NULL ORDER BY label ASC`
	rows, err := a.db.QueryContext(a.ctx, query)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen objecten: %w", err)
	}
	defer rows.Close()

	var list []ObjectEntity
	for rows.Next() {
		var o ObjectEntity
		if err := rows.Scan(&o.ID, &o.Label); err != nil {
			continue
		}
		list = append(list, o)
	}
	return list, nil
}

// SaveRelationValue maakt een nieuwe relatie aan of werkt een bestaande bij
// NewUUIDv7 genereert een expliciete UUIDv7 (time-ordered)
func NewUUIDv7() string {
	var uuid [16]byte
	
	// Timestamp in milliseconden (48 bits)
	now := uint64(time.Now().UnixMilli())
	uuid[0] = byte(now >> 40)
	uuid[1] = byte(now >> 32)
	uuid[2] = byte(now >> 24)
	uuid[3] = byte(now >> 16)
	uuid[4] = byte(now >> 8)
	uuid[5] = byte(now)

	// Random bytes invullen voor de overige bits
	_, _ = rand.Read(uuid[6:])

	// Version 7 instellen (0111 in de hoge 4 bits van byte 6)
	uuid[6] = (uuid[6] & 0x0f) | 0x70
	// Variant 1 instellen (10xx in de hoge 2 bits van byte 8)
	uuid[8] = (uuid[8] & 0x3f) | 0x80

	// Format als standaard UUID-string: 8-4-4-4-12
	buf := make([]byte, 36)
	hex.Encode(buf[0:8], uuid[0:4])
	buf[8] = '-'
	hex.Encode(buf[9:13], uuid[4:6])
	buf[13] = '-'
	hex.Encode(buf[14:18], uuid[6:8])
	buf[18] = '-'
	hex.Encode(buf[19:23], uuid[8:10])
	buf[23] = '-'
	hex.Encode(buf[24:36], uuid[10:16])

	return string(buf)
}

func (a *App) SaveRelationValue(rel RelationValueEntity) error {
	now := time.Now().UTC().Format(time.RFC3339)

	if rel.ID == "" {
		// Expliciet UUIDv7 genereren voor nieuwe relaties
		newID := NewUUIDv7()

		query := `
			INSERT INTO relation_values (id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, valid_to, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
		_, err := a.db.ExecContext(a.ctx, query, newID, rel.RelationID, rel.SourceID, rel.TargetID, rel.Volgorde, rel.IsConfidential, rel.ValidFrom, rel.ValidTo, now)
		return err
	}

	// Bestaande relatie bijwerken
	query := `
		UPDATE relation_values 
		SET relation_id = ?, source_id = ?, target_id = ?, volgorde = ?, is_confidential = ?, valid_from = ?, valid_to = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := a.db.ExecContext(a.ctx, query, rel.RelationID, rel.SourceID, rel.TargetID, rel.Volgorde, rel.IsConfidential, rel.ValidFrom, rel.ValidTo, now, rel.ID)
	return err
}
// DeleteRelationValue voert een soft-delete uit
func (a *App) DeleteRelationValue(id string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	query := `UPDATE relation_values SET deleted_at = ? WHERE id = ?`
	_, err := a.db.ExecContext(a.ctx, query, now, id)
	return err
}
// ParameterDefinition struct voor autocomplete & selecties
type ParameterDefinition struct {
	ID        string  `json:"id"`
	Label     string  `json:"label"`
	Code      string  `json:"code"`
	DataType  string  `json:"dataType"`
	Unit      *string `json:"unit,omitempty"`
}

// SearchParametersForSelect zoekt in stamgegevens tabel 'parameters'
func (a *App) SearchParametersForSelect(query string) ([]ParameterDefinition, error) {
	sqlQuery := `
		SELECT id, label, code, data_type, unit 
		from parameters 
		WHERE deleted_at IS NULL 
		  AND (label LIKE ? OR code LIKE ?)
		LIMIT 25
	`
	searchTerm := "%" + query + "%"
	rows, err := a.db.Query(sqlQuery, searchTerm, searchTerm)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ParameterDefinition
	for rows.Next() {
		var p ParameterDefinition
		if err := rows.Scan(&p.ID, &p.Label, &p.Code, &p.DataType, &p.Unit); err != nil {
			return nil, err
		}
		results = append(results, p)
	}
	return results, nil
}

// SaveParameterValue voegt een nieuwe parameterwaarde toe of werkt deze bij
func (a *App) SaveParameterValue(pv ParameterValueEntity) error {
	if pv.ID == "" {
		pv.ID = NewUUIDv7()
	}
	
	query := `
		INSERT INTO parameter_values (
			id, parameter_id, target_id, target_type, value, 
			is_confidential, valid_from, valid_to, updated_at, deleted_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			value = excluded.value,
			is_confidential = excluded.is_confidential,
			valid_from = excluded.valid_from,
			valid_to = excluded.valid_to,
			updated_at = excluded.updated_at,
			deleted_at = excluded.deleted_at
	`
	
	_, err := a.db.Exec(query,
		pv.ID, pv.ParameterID, pv.TargetID, pv.TargetType, pv.Value,
		pv.IsConfidential, pv.ValidFrom, pv.ValidTo, pv.UpdatedAt, pv.DeletedAt,
	)
	return err
}
// Matcht zowel "/" als "\" (bijv: 2024/W29/ of 2024\W29\)
var mediaPathRegex = regexp.MustCompile(`^\d{4}[/\\]W\d{1,2}[/\\]`)

func (a *App) OpenFile(filePath string) error {
	cleanPath := strings.TrimSpace(filePath)

	// 1. DArchieven omzetten
	if strings.HasPrefix(cleanPath, "http://localhost/DArchieven") {
		cleanPath = strings.Replace(cleanPath, "http://localhost/DArchieven", "../DArchieven", 1)
	} else if mediaPathRegex.MatchString(cleanPath) {
		// 2. Media paden (YYYY/Wxx/...) omzetten
		cleanPath = "../media/" + cleanPath
	}

	// Zet eventuele slashes om naar de juiste OS path separators (\ voor Windows)
	cleanPath = filepath.FromSlash(cleanPath)

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// cmd /c start vereist dubbele quotes voor de titel-parameter als het pad spaties/quotes bevat
		cmd = exec.Command("cmd", "/c", "start", "", cleanPath)
	case "darwin":
		cmd = exec.Command("open", cleanPath)
	default:
		cmd = exec.Command("xdg-open", cleanPath)
	}

	err := cmd.Run()
	if err != nil {
		// Toon in de foutmelding het EXACTE pad dat Go heeft geprobeerd te openen
		return fmt.Errorf("kan bestand niet openen op pad '%s': %v", cleanPath, err)
	}
	return nil
}
// CreateNewObject struct/payload voor de Wails binding
type CreateObjectInput struct {
	Label        string `json:"label"`
	ObjectTypeID string `json:"objectTypeId"`
}

// CreateNewObject maakt direct een object én de verplichte type-relatie aan in SQLite,
// exact zoals dat in media_import.go gebeurt.
func (a *App) CreateNewObject(label string, objectTypeID string) (string, error) {
	newUUID := NewUUIDv7()

	nowISO := time.Now().UTC().Format(time.RFC3339)

	// 1. Invoegen in 'objects'
	queryObj := `
		INSERT INTO objects (id, label, valid_from, updated_at)
		VALUES (?, ?, ?, ?)
	`
	_, err := a.db.Exec(queryObj, newUUID, label, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij invoegen object: %w", err)
	}

	// 2. Koppeling naar ObjectType (Relation ID: 019fcd1d-c633-76bc-ac68-5ecf3a9ac76f / RelIDMediaKoppeling)
	// Let op de exacte verdeling: source = objectTypeID, target = newUUID (conform insertMediaRecord)
	relTypeUUID := "019fcd1d-c633-76bc-ac68-5ecf3a9ac76f"
	typeRelUUID := NewUUIDv7()

	
	queryTypeRel := `
		INSERT INTO relation_values (id, relation_id, source_id, target_id, valid_from, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	_, err = a.db.Exec(queryTypeRel, typeRelUUID, relTypeUUID, objectTypeID, newUUID, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij koppelen van object-type relatie: %w", err)
	}

	return newUUID, nil
}

type ObjectTypeOption struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// GetObjectTypes haalt uitsluitend de geldige objecttypen op via de stam-node
func (a *App) GetObjectTypes() ([]ObjectTypeOption, error) {
	query := `
		SELECT oj.id, oj.label 
		FROM objects 
		JOIN relation_values ON objects.id = relation_values.source_id 
		JOIN objects oj ON relation_values.target_id = oj.id 
		WHERE objects.id = '019fcd1d-c633-76bc-ac68-5ecf3a9ac76f'
		ORDER BY oj.label ASC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen objecttypen: %w", err)
	}
	defer rows.Close()

	var types []ObjectTypeOption
	for rows.Next() {
		var item ObjectTypeOption
		if err := rows.Scan(&item.ID, &item.Label); err != nil {
			return nil, err
		}
		types = append(types, item)
	}

	return types, nil
}

type ObjectSummary struct {
	ID             string  `json:"id"`
	Label          string  `json:"label"`
	IsConfidential bool    `json:"is_confidential"`
	ValidFrom      string  `json:"valid_from"`
	ValidTo        *string `json:"valid_to,omitempty"`
	UpdatedAt      string  `json:"updated_at"`
}

type ParameterSummary struct {
	ID             string  `json:"id"`
	ParameterID    string  `json:"parameter_id"`
	ParameterCode  string  `json:"parameter_code"`
	ParameterLabel string  `json:"parameter_label"`
	DataType       string  `json:"data_type"`
	TargetID       string  `json:"target_id"`
	TargetType     string  `json:"target_type"`
	Value          string  `json:"value"`
	Unit           string  `json:"unit"`
	IsConfidential bool    `json:"is_confidential"`
	ValidFrom      string  `json:"valid_from"`
	ValidTo        *string `json:"valid_to,omitempty"`
}

type RelationSummary struct {
	ID             string  `json:"id"`
	RelationID     string  `json:"relation_id"`
	RelationLabel  string  `json:"relation_label"`
	SourceID       string  `json:"source_id"`
	SourceLabel    string  `json:"source_label"`
	TargetID       string  `json:"target_id"`
	TargetLabel    string  `json:"target_label"`
	Volgorde       int     `json:"volgorde"`
	IsConfidential bool    `json:"is_confidential"`
	ValidFrom      string  `json:"valid_from"`
	ValidTo        *string `json:"valid_to,omitempty"`
	UpdatedAt      string  `json:"updated_at"`
}

type ReportTreeNode struct {
	Object     ObjectSummary      `json:"object"`
	Parameters []ParameterSummary `json:"parameters"`
	Relation   *RelationSummary   `json:"relation,omitempty"`
	Children   []*ReportTreeNode  `json:"children"`
}
type ReportTemplate struct {
	ID                   string          `json:"id"`
	Name                 string          `json:"name"`
	ContentParameterCode string          `json:"contentParameterCode"`
	HierarchyRules       []HierarchyRule `json:"hierarchyRules"`
}

type HierarchyRule struct {
	Level    int `json:"level"`
	FontSize int `json:"fontSize"`
}

// Helper mapping functions
func mapObjectToSummary(o ObjectEntity) ObjectSummary {
	return ObjectSummary{
		ID:             o.ID,
		Label:          o.Label,
		IsConfidential: o.IsConfidential,
		ValidFrom:      o.ValidFrom,
		ValidTo:        o.ValidTo,
		UpdatedAt:      o.UpdatedAt,
	}
}

func mapParameterToSummary(pv ParameterValueEntity) ParameterSummary {
	unitVal := ""
	if pv.Unit != nil {
		unitVal = *pv.Unit
	}

	return ParameterSummary{
		ID:             pv.ID,
		ParameterID:    pv.ParameterID,
		ParameterCode:  pv.ParameterCode,
		ParameterLabel: pv.ParameterLabel,
		DataType:       pv.DataType,
		TargetID:       pv.TargetID,
		TargetType:     pv.TargetType,
		Value:          pv.Value,
		Unit:           unitVal,
		IsConfidential: pv.IsConfidential,
		ValidFrom:      pv.ValidFrom,
		ValidTo:        pv.ValidTo,
	}
}
func mapRelationToSummary(rv *RelationValueEntity) *RelationSummary {
	if rv == nil {
		return nil
	}
	return &RelationSummary{
		ID:             rv.ID,
		RelationID:     rv.RelationID,
		RelationLabel:  rv.RelationLabel,
		SourceID:       rv.SourceID,
		SourceLabel:    rv.SourceLabel,
		TargetID:       rv.TargetID,
		TargetLabel:    rv.TargetLabel,
		Volgorde:       rv.Volgorde,
		IsConfidential: rv.IsConfidential,
		ValidFrom:      rv.ValidFrom,
		ValidTo:        rv.ValidTo,
		UpdatedAt:      rv.UpdatedAt,
	}
}

// FetchReportTree haalt recursief de boomstructuur op vanuit een startobject
func (a *App) FetchReportTree(startObjectID string, maxLevels int, contentParamCode string) (*ReportTreeNode, error) {
	if contentParamCode == "" {
		contentParamCode = "toelichting"
	}

	return a.buildReportNodeRecursive(startObjectID, nil, 0, maxLevels, contentParamCode)
}

func (a *App) buildReportNodeRecursive(objectID string, rel *RelationValueEntity, currentLevel int, maxLevels int, paramCode string) (*ReportTreeNode, error) {
	// 1. Haal ObjectEntity op
	var obj ObjectEntity
	var validTo sql.NullString
	err := a.db.QueryRow(`
		SELECT id, label, is_confidential, valid_from, valid_to, updated_at
		FROM objects 
		WHERE id = ? AND deleted_at IS NULL`, objectID).Scan(
		&obj.ID, &obj.Label, &obj.IsConfidential, &obj.ValidFrom, &validTo, &obj.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("object niet gevonden (%s): %w", objectID, err)
	}
	if validTo.Valid {
		obj.ValidTo = &validTo.String
	}

	// 2. Haal alle parameters van dit object op
	paramsEntities, _ := a.GetParametersForTarget(objectID)

	// Map parameter entities to summary entities
	paramSummaries := make([]ParameterSummary, 0, len(paramsEntities))
	for _, p := range paramsEntities {
		paramSummaries = append(paramSummaries, mapParameterToSummary(p))
	}

	treeNode := &ReportTreeNode{
		Object:     mapObjectToSummary(obj),
		Relation:   mapRelationToSummary(rel),
		Parameters: paramSummaries,
		Children:   []*ReportTreeNode{},
	}

	// Stop met dieper zoeken als het maximale niveau bereikt is
	if currentLevel >= maxLevels-1 {
		return treeNode, nil
	}

	// 3. Haal uitgaande relaties op (RelationValueEntity) vanuit dit bron-object
	relQuery := `
		SELECT 
			rv.id, rv.relation_id, r.label AS relation_label, rv.source_id, 
			COALESCE(so.label, '') AS source_label, rv.target_id, COALESCE(to_obj.label, '') AS target_label,
			rv.volgorde, rv.is_confidential, rv.valid_from, rv.valid_to, rv.updated_at
		FROM relation_values rv
		JOIN relations r ON r.id = rv.relation_id
		LEFT JOIN objects so ON so.id = rv.source_id
		LEFT JOIN objects to_obj ON to_obj.id = rv.target_id
		WHERE rv.source_id = ? AND rv.deleted_at IS NULL AND r.deleted_at IS NULL
		ORDER BY rv.volgorde ASC`

	rows, err := a.db.Query(relQuery, objectID)
	if err != nil {
		return treeNode, nil
	}
	defer rows.Close()

	for rows.Next() {
		var childRel RelationValueEntity
		var vTo sql.NullString
		if err := rows.Scan(
			&childRel.ID, &childRel.RelationID, &childRel.RelationLabel, &childRel.SourceID,
			&childRel.SourceLabel, &childRel.TargetID, &childRel.TargetLabel, &childRel.Volgorde,
			&childRel.IsConfidential, &childRel.ValidFrom, &vTo, &childRel.UpdatedAt,
		); err != nil {
			continue
		}
		if vTo.Valid {
			childRel.ValidTo = &vTo.String
		}

		// Recursieve aanroep voor het onderliggende target-object
		childNode, err := a.buildReportNodeRecursive(childRel.TargetID, &childRel, currentLevel+1, maxLevels, paramCode)
		if err == nil && childNode != nil {
			treeNode.Children = append(treeNode.Children, childNode)
		}
	}

	return treeNode, nil
}

// ExportReportToPDF maakt een eenvoudige MVP PDF op basis van de meegegeven boomstructuur
func (a *App) ExportReportToPDF(tree *ReportTreeNode, outputPath string) error {
	if tree == nil {
		return fmt.Errorf("geen rapportboom opgegeven")
	}

	// Gebruik de bestaande MarotoExporter
	// (We geven nil mee voor template, zodat hij puur de basislogica volgt)
	exporter := NewMarotoExporter()
	return exporter.GenerateReportPDF(tree, nil, outputPath)
}


// SelectSavePath opent het standaard dialoogvenster voor het opslaan van een PDF
func (a *App) SelectSavePath(defaultFilename string) (string, error) {
	filePath, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Selecteer locatie voor PDF-rapport",
		DefaultFilename: defaultFilename,
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "PDF Bestanden (*.pdf)",
				Pattern:     "*.pdf",
			},
		},
	})
	if err != nil {
		return "", err
	}
	return filePath, nil
}