package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime" // Standaard Go runtime package (voor runtime.GOOS)
	"strings"
	"time"
	"encoding/json"
	

	_ "github.com/glebarez/go-sqlite"

	// Wails runtime met een alias 'wailsruntime':
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
	Comment              string          `json:"_comment,omitempty"` // Toelichting/commentaar op het sjabloon
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
// GetObjectById haalt één specifiek object op aan de hand van zijn ID
func (a *App) GetObjectById(id string) (*ObjectEntity, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database niet verbonden")
	}

	var o ObjectEntity
	var validTo sql.NullString

	query := `
		SELECT id, label, is_confidential, valid_from, valid_to 
		FROM objects 
		WHERE id = ? AND deleted_at IS NULL`

	err := a.db.QueryRow(query, id).Scan(&o.ID, &o.Label, &o.IsConfidential, &o.ValidFrom, &validTo)
	if err != nil {
		return nil, fmt.Errorf("object %s niet gevonden: %w", id, err)
	}

	if validTo.Valid {
		o.ValidTo = &validTo.String
	}

	return &o, nil
}

// GetLocalImageBase64 leest een lokaal bestand en geeft een Data URL terug (data:image/jpeg;base64,...)
func (a *App) GetLocalImageBase64(filePath string) (string, error) {
	// 1. Maak er een schoon Windows-pad van
	cleanPath := filepath.FromSlash(strings.TrimSpace(filePath))

	// 2. Lees de bestandsinhoud
	bytes, err := os.ReadFile(cleanPath)
	if err != nil {
		return "", fmt.Errorf("kan bestand niet lezen: %w", err)
	}

	// 3. Bepaal het MIME-type (image/jpeg, image/png, etc.)
	mimeType := http.DetectContentType(bytes)
	if strings.HasPrefix(mimeType, "text/plain") {
		// Fallback op basis van extensie
		ext := strings.ToLower(filepath.Ext(cleanPath))
		switch ext {
		case ".jpg", ".jpeg":
			mimeType = "image/jpeg"
		case ".png":
			mimeType = "image/png"
		case ".webp":
			mimeType = "image/webp"
		case ".svg":
			mimeType = "image/svg+xml"
		}
	}

	// 4. Zet om naar base64 data URL
	encoded := base64.StdEncoding.EncodeToString(bytes)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, encoded), nil
}

// SelectImageFile opent het Windows verkenner venster voor afbeeldingen
func (a *App) SelectImageFile() (string, error) {
	selection, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Selecteer een afbeelding",
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "Afbeeldingen (*.jpg; *.jpeg; *.png; *.webp; *.gif)",
				Pattern:     "*.jpg;*.jpeg;*.png;*.webp;*.gif",
			},
		},
	})

	if err != nil {
		return "", err
	}

	// Geeft het geselecteerde absolute pad terug (of een lege string als gecanceld is)
	return selection, nil
}

// --- STRUCTS VOOR MASTER DATA ---

type ParameterMaster struct {
	ID        string  `json:"id"`
	Label     string  `json:"label"`
	Code      string  `json:"code"`
	DataType  string  `json:"dataType"`
	Unit      *string `json:"unit,omitempty"`
	UpdatedAt string  `json:"updatedAt"`
}

type UnitMaster struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Symbol    string `json:"symbol"`
	UpdatedAt string `json:"updatedAt"`
}

type RelationMaster struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	UpdatedAt string `json:"updatedAt"`
}

// --- PARAMETERS CRUD ---

func (a *App) GetAllMasterParameters() ([]ParameterMaster, error) {
	query := `SELECT id, label, code, data_type, unit, updated_at FROM parameters WHERE deleted_at IS NULL ORDER BY label ASC`
	rows, err := a.db.QueryContext(a.ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ParameterMaster
	for rows.Next() {
		var p ParameterMaster
		var unit sql.NullString
		if err := rows.Scan(&p.ID, &p.Label, &p.Code, &p.DataType, &unit, &p.UpdatedAt); err != nil {
			continue
		}
		if unit.Valid {
			p.Unit = &unit.String
		}
		list = append(list, p)
	}
	return list, nil
}

func (a *App) SaveMasterParameter(p ParameterMaster) error {
	now := time.Now().UTC().Format(time.RFC3339)
	if p.ID == "" {
		p.ID = NewUUIDv7()
		query := `INSERT INTO parameters (id, label, code, data_type, unit, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
		_, err := a.db.ExecContext(a.ctx, query, p.ID, p.Label, p.Code, p.DataType, p.Unit, now)
		return err
	}

	query := `UPDATE parameters SET label = ?, code = ?, data_type = ?, unit = ?, updated_at = ? WHERE id = ?`
	_, err := a.db.ExecContext(a.ctx, query, p.Label, p.Code, p.DataType, p.Unit, now, p.ID)
	return err
}

// --- UNITS CRUD ---

func (a *App) GetAllMasterUnits() ([]UnitMaster, error) {
	query := `SELECT id, label, symbol, updated_at FROM units WHERE deleted_at IS NULL ORDER BY label ASC`
	rows, err := a.db.QueryContext(a.ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []UnitMaster
	for rows.Next() {
		var u UnitMaster
		if err := rows.Scan(&u.ID, &u.Label, &u.Symbol, &u.UpdatedAt); err != nil {
			continue
		}
		list = append(list, u)
	}
	return list, nil
}

func (a *App) SaveMasterUnit(u UnitMaster) error {
	now := time.Now().UTC().Format(time.RFC3339)
	if u.ID == "" {
		u.ID = NewUUIDv7()
		query := `INSERT INTO units (id, label, symbol, updated_at) VALUES (?, ?, ?, ?)`
		_, err := a.db.ExecContext(a.ctx, query, u.ID, u.Label, u.Symbol, now)
		return err
	}

	query := `UPDATE units SET label = ?, symbol = ?, updated_at = ? WHERE id = ?`
	_, err := a.db.ExecContext(a.ctx, query, u.Label, u.Symbol, now, u.ID)
	return err
}

// --- RELATIONS CRUD ---

func (a *App) GetAllMasterRelations() ([]RelationMaster, error) {
	query := `SELECT id, label, updated_at FROM relations WHERE deleted_at IS NULL ORDER BY label ASC`
	rows, err := a.db.QueryContext(a.ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []RelationMaster
	for rows.Next() {
		var r RelationMaster
		if err := rows.Scan(&r.ID, &r.Label, &r.UpdatedAt); err != nil {
			continue
		}
		list = append(list, r)
	}
	return list, nil
}

func (a *App) SaveMasterRelation(r RelationMaster) error {
	now := time.Now().UTC().Format(time.RFC3339)
	if r.ID == "" {
		r.ID = NewUUIDv7()
		query := `INSERT INTO relations (id, label, updated_at) VALUES (?, ?, ?)`
		_, err := a.db.ExecContext(a.ctx, query, r.ID, r.Label, now)
		return err
	}

	query := `UPDATE relations SET label = ?, updated_at = ? WHERE id = ?`
	_, err := a.db.ExecContext(a.ctx, query, r.Label, now, r.ID)
	return err
}

type BatchCreateSubObjectsInput struct {
	ParentID       string `json:"parentId"`       // Het startobject uit de Node-editor
	Count          int    `json:"count"`          // Aantal toe te voegen objecten (interactief)
	BaseLabel      string `json:"baseLabel"`      // Bijv. "Paragraaf" of "Tekstitem"
	RelationID     string `json:"relationID"`     // Bijv. "is een uitwerking van" (01a03afa-...)
	ObjectTypeID   string `json:"objectTypeID"`   // Bijv. "tekstitem" objecttype (01a144fd-...)
	ParameterID    string `json:"parameterID"`    // Bijv. "Tekstblok" parameter (01a0d3ba-...)
	ParameterValue string `json:"parameterValue"` // Bijv. "<p>Tekstblok</p>"
}

func (a *App) BatchCreateSubObjects(input BatchCreateSubObjectsInput) (int64, error) {
	if input.Count <= 0 {
		return 0, fmt.Errorf("aantal moet groter zijn dan 0")
	}
	if input.ParentID == "" {
		return 0, fmt.Errorf("geen parentID opgegeven")
	}

	// Standaardwaarden als ze niet zijn meegegeven
	relID := input.RelationID
	if relID == "" {
		relID = "01a03afa-fa76-76de-a973-18d94bc873e3"	 // "is een uitwerking van"
	}
	objTypeID := input.ObjectTypeID
	if objTypeID == "" {
		objTypeID = "01a144fd-8c55-7d92-baa1-0a0716ce60fb" // "tekstitem"
	}
	paramID := input.ParameterID
	if paramID == "" {
		paramID = "01a0d3ba-c761-755a-b6c4-537c29a5e902" // "Tekstblok"
	}
	paramVal := input.ParameterValue
	if paramVal == "" {
		paramVal = "<p>Tekstblok</p>"
	}
	baseLab := input.BaseLabel
	if baseLab == "" {
		baseLab = "Nieuw object"
	}

	nowISO := time.Now().UTC().Format(time.RFC3339)

	// Start transactie
	tx, err := a.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("transactie starten mislukt: %w", err)
	}
	defer tx.Rollback()

	// 1. Bepaal het huidige aantal uitgaande relaties voor dit parent-object om achteraan te beginnen
	var existingCount int
	err = tx.QueryRow(`
		SELECT COUNT(*) 
		FROM relation_values 
		WHERE source_id = ? AND deleted_at IS NULL
	`, input.ParentID).Scan(&existingCount)
	if err != nil {
		return 0, fmt.Errorf("fout bij opvragen bestaande uitgaande relaties: %w", err)
	}

	var insertedCount int64 = 0

	for i := 0; i < input.Count; i++ {
		newObjID := NewUUIDv7()
		label := fmt.Sprintf("%s %d", baseLab, i+1)
		
		// Bepaal de volgorde: begin na de reeds bestaande uitgaande relaties
		currentOrder := existingCount + i + 1

		// STAP 1: Maak het nieuwe object aan
		_, err := tx.Exec(`
			INSERT INTO objects (id, label, is_confidential, valid_from, updated_at)
			VALUES (?, ?, 0, ?, ?)
		`, newObjID, label, nowISO, nowISO)
		if err != nil {
			return 0, fmt.Errorf("fout bij invoegen object (stap 1): %w", err)
		}

		// STAP 2: Leg Relatie 1 naar het startobject (Parent) met doorlopende volgorde
		rel1ID := NewUUIDv7()
		_, err = tx.Exec(`
			INSERT INTO relation_values (id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, updated_at)
			VALUES (?, ?, ?, ?, ?, 0, ?, ?)
		`, rel1ID, relID, input.ParentID, newObjID, currentOrder, nowISO, nowISO)
		if err != nil {
			return 0, fmt.Errorf("fout bij leggen relatie 1 (stap 2): %w", err)
		}

		// STAP 3: Leg Relatie 2 naar het objecttype
		rel2ID := NewUUIDv7()
		_, err = tx.Exec(`
			INSERT INTO relation_values (id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, updated_at)
			VALUES (?, '019fcdd3-721a-7512-b755-cddd67f43eb6', ?, ?, 0, 0, ?, ?)
		`, rel2ID, objTypeID, newObjID, nowISO, nowISO)
		if err != nil {
			return 0, fmt.Errorf("fout bij leggen relatie 2 (stap 3): %w", err)
		}

		// STAP 4: Ken de parameterwaarde toe
		paramValID := NewUUIDv7()
		_, err = tx.Exec(`
			INSERT INTO parameter_values (id, parameter_id, target_id, target_type, value, is_confidential, valid_from, updated_at)
			VALUES (?, ?, ?, 'object', ?, 0, ?, ?)
		`, paramValID, paramID, newObjID, paramVal, nowISO, nowISO)
		if err != nil {
			return 0, fmt.Errorf("fout bij toekennen parameter (stap 4): %w", err)
		}

		insertedCount++
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit mislukt: %w", err)
	}

	return insertedCount, nil
}
type ParameterInput struct {
	ParameterID string `json:"parameterId"`
	Value       string `json:"value"`
}

type CreateComplexSubObjectInput struct {
	ParentID       string           `json:"parentId"`
	Label          string           `json:"label"`
	RelationID     string           `json:"relationId"`
	ObjectTypeID   string           `json:"objectTypeId"`
	Parameters     []ParameterInput `json:"parameters"` // Lijst van alle in te vullen parameters (verplicht + optioneel)
}

func (a *App) CreateComplexSubObject(input CreateComplexSubObjectInput) (string, error) {
	if input.ParentID == "" {
		return "", fmt.Errorf("geen parentID opgegeven")
	}
	if input.Label == "" {
		return "", fmt.Errorf("label is verplicht")
	}

	nowISO := time.Now().UTC().Format(time.RFC3339)

	tx, err := a.db.Begin()
	if err != nil {
		return "", fmt.Errorf("transactie starten mislukt: %w", err)
	}
	defer tx.Rollback()

	newObjID := NewUUIDv7()

	// 1. Bepaal de huidige volgorde achteraan de uitgaande relaties
	var existingCount int
	err = tx.QueryRow(`
		SELECT COUNT(*) 
		FROM relation_values 
		WHERE source_id = ? AND deleted_at IS NULL
	`, input.ParentID).Scan(&existingCount)
	if err != nil {
		return "", fmt.Errorf("fout bij opvragen volgorde: %w", err)
	}
	currentOrder := existingCount + 1

	// 2. Maak het hoofdobject aan
	_, err = tx.Exec(`
		INSERT INTO objects (id, label, is_confidential, valid_from, updated_at)
		VALUES (?, ?, 0, ?, ?)
	`, newObjID, input.Label, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij aanmaken object: %w", err)
	}

	// 3. Relatie 1: Naar parent object
	rel1ID := NewUUIDv7()
	_, err = tx.Exec(`
		INSERT INTO relation_values (id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, updated_at)
		VALUES (?, ?, ?, ?, ?, 0, ?, ?)
	`, rel1ID, input.RelationID, input.ParentID, newObjID, currentOrder, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij leggen relatie 1: %w", err)
	}

	// 4. Relatie 2: Naar objecttype
	rel2ID := NewUUIDv7()
	_, err = tx.Exec(`
		INSERT INTO relation_values (id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, updated_at)
		VALUES (?, '019fcdd3-721a-7512-b755-cddd67f43eb6', ?, ?, 0, 0, ?, ?)
	`, rel2ID, input.ObjectTypeID, newObjID, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij leggen relatie 2: %w", err)
	}

	// 5. Parameterwaarden wegschrijven (alle ingevulde verplichte en optionele parameters)
	for _, p := range input.Parameters {
		if strings.TrimSpace(p.Value) == "" {
			continue // Sla lege optionele velden over
		}
		paramValID := NewUUIDv7()
		_, err = tx.Exec(`
			INSERT INTO parameter_values (id, parameter_id, target_id, target_type, value, is_confidential, valid_from, updated_at)
			VALUES (?, ?, ?, 'object', ?, 0, ?, ?)
		`, paramValID, p.ParameterID, newObjID, p.Value, nowISO, nowISO)
		if err != nil {
			return "", fmt.Errorf("fout bij wegschrijven parameter %s: %w", p.ParameterID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("commit mislukt: %w", err)
	}

	return newObjID, nil
}
// SelectAnyFile opent het verkenner venster voor elk willekeurig bestand (PDF, tekst, afbeeldingen, etc.)
func (a *App) SelectAnyFile() (string, error) {
	selection, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Selecteer een bestand",
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "Alle Ondersteunde Bestanden (*.pdf; *.txt; *.jpg; *.jpeg; *.png; *.webp)",
				Pattern:     "*.pdf;*.txt;*.jpg;*.jpeg;*.png;*.webp",
			},
			{
				DisplayName: "PDF Documenten (*.pdf)",
				Pattern:     "*.pdf",
			},
			{
				DisplayName: "Tekstbestanden (*.txt)",
				Pattern:     "*.txt",
			},
			{
				DisplayName: "Alle Bestanden (*.*)",
				Pattern:     "*.*",
			},
		},
	})

	if err != nil {
		return "", err
	}

	return selection, nil
}
// DeleteParameterValue voert een soft-delete uit op een parameterwaarde
func (a *App) DeleteParameterValue(id string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	query := `UPDATE parameter_values SET deleted_at = ?, updated_at = ? WHERE id = ?`
	_, err := a.db.ExecContext(a.ctx, query, now, now, id)
	return err
}

// GetPhotoFilePath leest de foto direct van de T:-schijf en levert een tijdelijke Base64 Data URI op
func (a *App) GetPhotoFilePath(mediaID string) string {
	if a.db == nil {
		return ""
	}

	var relativePath string
	query := `
		SELECT value 
		FROM parameter_values 
		WHERE target_id = ? 
		  AND parameter_id = '01a0108f-3880-752d-b961-9e50e167028d' 
		  AND (deleted_at IS NULL OR deleted_at = '')
		LIMIT 1
	`
	err := a.db.QueryRow(query, mediaID).Scan(&relativePath)
	if err != nil || relativePath == "" {
		return ""
	}

	cleanRelativePath := strings.TrimPrefix(relativePath, "/")
	fullPath := "T:/Media/" + cleanRelativePath

	// Lees het bestand direct in vanaf de T:-schijf
	fileBytes, err := os.ReadFile(fullPath)
	if err != nil {
		return ""
	}

	// Bepaal het juiste mime-type
	mimeType := "image/jpeg"
	lowerPath := strings.ToLower(fullPath)
	if strings.HasSuffix(lowerPath, ".png") {
		mimeType = "image/png"
	} else if strings.HasSuffix(lowerPath, ".gif") {
		mimeType = "image/gif"
	} else if strings.HasSuffix(lowerPath, ".webp") {
		mimeType = "image/webp"
	}

	// Converteer naar Base64 Data URI
	base64String := base64.StdEncoding.EncodeToString(fileBytes)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64String)
}

type ParameterGroupItem struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// GetParameterGroups haalt alle bestaande parametergroep objecten op
func (a *App) GetParameterGroups() ([]ParameterGroupItem, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database niet verbonden")
	}

	query := `
		SELECT o.id, o.label
		FROM relation_values rv
		JOIN objects o ON rv.target_id = o.id
		WHERE rv.source_id = '01a17dae-1b7a-77ff-bc9a-fb0e592dd4ef'
		  AND rv.relation_id = '019fcdd3-721a-7512-b755-cddd67f43eb6'
		  AND rv.deleted_at IS NULL
		  AND o.deleted_at IS NULL
		ORDER BY o.label ASC
	`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen parametergroepen: %w", err)
	}
	defer rows.Close()

	var groups []ParameterGroupItem
	for rows.Next() {
		var g ParameterGroupItem
		if err := rows.Scan(&g.ID, &g.Label); err != nil {
			continue
		}
		groups = append(groups, g)
	}
	return groups, nil
}

// GetParametersForGroup haalt de parameterset op die aan een parametergroep is gekoppeld
// (via parameter_values met parameter_id = '01a17db5-0aa5-73d6-9200-b03be26a9eac')
func (a *App) GetParametersForGroup(groupID string) ([]ParameterDefinition, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database niet verbonden")
	}

	// 1. Haal de JSON/reeks string op uit parameter_values
	var rawValue string
	queryVal := `
		SELECT value 
		FROM parameter_values 
		WHERE target_id = ? 
		  AND parameter_id = '01a17db5-0aa5-73d6-9200-b03be26a9eac'
		  AND (deleted_at IS NULL OR deleted_at = '')
		LIMIT 1
	`
	err := a.db.QueryRow(queryVal, groupID).Scan(&rawValue)
	if err != nil {
		// Als er nog geen waarde is, is de lijst leeg (geen fout)
		return []ParameterDefinition{}, nil
	}

	// Stel dat rawValue een komma-gescheiden lijst of JSON array is van parameter IDs.
	// Laten we aannemen dat het IDs bevat. We splitsen of parsen ze.
	// (Als het JSON is, kun je evt.encoding/json gebruiken, of als het comma-separated IDs zijn:)
	ids := strings.Split(rawValue, ",")
	if len(ids) == 0 || (len(ids) == 1 && strings.TrimSpace(ids[0]) == "") {
		return []ParameterDefinition{}, nil
	}

	// 2. Ha detalhes op voor deze parameters in de juiste volgorde
	var results []ParameterDefinition
	for _, pid := range ids {
		pid = strings.TrimSpace(pid)
		if pid == "" {
			continue
		}
		var p ParameterDefinition
		qParam := `SELECT id, label, code, data_type, unit FROM parameters WHERE id = ? AND deleted_at IS NULL`
		err := a.db.QueryRow(qParam, pid).Scan(&p.ID, &p.Label, &p.Code, &p.DataType, &p.Unit)
		if err == nil {
			results = append(results, p)
		}
	}

	return results, nil
}

type SaveParameterGroupInput struct {
	GroupID      string   `json:"groupId"`      // Leeg bij nieuw
	GroupLabel   string   `json:"groupLabel"`   // Naam van de groep
	ParameterIDs []string `json:"parameterIds"` // Volgorde van parameter IDs
}

// SaveParameterGroup maakt een nieuwe parametergroep aan of werkt een bestaande bij
func (a *App) SaveParameterGroup(input SaveParameterGroupInput) (string, error) {
	if a.db == nil {
		return "", fmt.Errorf("database niet verbonden")
	}

	nowISO := time.Now().UTC().Format(time.RFC3339)
	groupID := input.GroupID

	tx, err := a.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	// 1. Als groupID leeg is, maak een nieuw object aan én koppel aan stam-node
	if groupID == "" {
		groupID = NewUUIDv7()

		// Maak object
		_, err = tx.Exec(`
			INSERT INTO objects (id, label, is_confidential, valid_from, updated_at)
			VALUES (?, ?, 0, ?, ?)
		`, groupID, input.GroupLabel, nowISO, nowISO)
		if err != nil {
			return "", fmt.Errorf("fout bij aanmaken parametergroep object: %w", err)
		}

		// Tel uitgaande relaties voor volgorde
		var existingCount int
		_ = tx.QueryRow(`
			SELECT COUNT(*) FROM relation_values WHERE source_id = '01a17dae-1b7a-77ff-bc9a-fb0e592dd4ef' AND deleted_at IS NULL
		`, groupID).Scan(&existingCount)

		// Leg relatie naar stam-node (relatie_id = 019fcdd3-721a-7512-b755-cddd67f43eb6)
		relID := NewUUIDv7()
		_, err = tx.Exec(`
			INSERT INTO relation_values (id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, updated_at)
			VALUES (?, '019fcdd3-721a-7512-b755-cddd67f43eb6', '01a17dae-1b7a-77ff-bc9a-fb0e592dd4ef', ?, ?, 0, ?, ?)
		`, relID, groupID, existingCount+1, nowISO, nowISO)
		if err != nil {
			return "", fmt.Errorf("fout bij leggen relatie naar stam-node: %w", err)
		}
	} else {
		// Update label van bestaand object
		_, err = tx.Exec(`UPDATE objects SET label = ?, updated_at = ? WHERE id = ?`, input.GroupLabel, nowISO, groupID)
		if err != nil {
			return "", fmt.Errorf("fout bij bijwerken object label: %w", err)
		}
	}

	// 2. Sla de parameterset op als parameter_value (parameter_id = '01a17db5-0aa5-73d6-9200-b03be26a9eac')
	paramValuesStr := strings.Join(input.ParameterIDs, ",")

	// Check of er al een parameter_value bestaat voor deze parameter en target
	var pvID string
	err = tx.QueryRow(`
		SELECT id FROM parameter_values 
		WHERE target_id = ? AND parameter_id = '01a17db5-0aa5-73d6-9200-b03be26a9eac' AND (deleted_at IS NULL OR deleted_at = '')
		LIMIT 1
	`, groupID).Scan(&pvID)

	if err == sql.ErrNoRows {
		// Insert nieuwe parameter_value
		pvID = NewUUIDv7()
		_, err = tx.Exec(`
			INSERT INTO parameter_values (id, parameter_id, target_id, target_type, value, is_confidential, valid_from, updated_at)
			VALUES (?, '01a17db5-0aa5-73d6-9200-b03be26a9eac', ?, 'object', ?, 0, ?, ?)
		`, pvID, groupID, paramValuesStr, nowISO, nowISO)
		if err != nil {
			return "", fmt.Errorf("fout bij invoegen parameterset waarde: %w", err)
		}
	} else if err == nil {
		// Update bestaande parameter_value
		_, err = tx.Exec(`
			UPDATE parameter_values SET value = ?, updated_at = ? WHERE id = ?
		`, paramValuesStr, nowISO, pvID)
		if err != nil {
			return "", fmt.Errorf("fout bij bijwerken parameterset waarde: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}

	return groupID, nil
}

type MeetreeksOption struct {
	Key            string `json:"key"`            // Unieke sleutel voor frontend selectie (bijv. "existing:<id>" of "new:<objectId>")
	ObjectID       string `json:"objectId"`       // Doelobject ID
	ObjectLabel    string `json:"objectLabel"`    // Label van doelobject
	MeetreeksID    string `json:"meetreeksId,omitempty"` // Leeg bij "Nieuwe meetreeks"
	MeetreeksLabel string `json:"meetreeksLabel,omitempty"`
	DisplayLabel   string `json:"displayLabel"`   // "[object-label]: [meetreeks-label]" of "[object-label]: Nieuwe meetreeks"
	IsNew          bool   `json:"isNew"`
}

// GetMeetreeksOptions haalt bestaande meetreeksen op én opties om nieuwe aan te maken per object
func (a *App) GetMeetreeksOptions(searchTerm string) ([]MeetreeksOption, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database niet verbonden")
	}

	var options []MeetreeksOption

	// 1. Zoek alle bestaande meetreeksen (objecten met objecttype 01a17dac-905c-7519-8859-e44d13630ac4)
	queryExisting := `
		SELECT 
			m.id AS meetreeks_id,
			m.label AS meetreeks_label,
			o.id AS object_id,
			o.label AS object_label
		FROM objects m
		JOIN relation_values rv_type ON rv_type.target_id = m.id AND rv_type.source_id = '01a17dac-905c-7519-8859-e44d13630ac4' AND rv_type.deleted_at IS NULL
		JOIN relation_values rv_obj ON rv_obj.target_id = m.id AND rv_obj.relation_id = '01a014fc-6b2a-7447-b643-740bc09ad213' AND rv_obj.deleted_at IS NULL
		JOIN objects o ON o.id = rv_obj.source_id AND o.deleted_at IS NULL
		WHERE m.deleted_at IS NULL
	`

	if searchTerm != "" {
		queryExisting += ` AND (LOWER(m.label) LIKE LOWER(?) OR LOWER(o.label) LIKE LOWER(?))`
	}
	queryExisting += ` ORDER BY o.label ASC, m.label ASC LIMIT 50`

	var rows *sql.Rows
	var err error
	if searchTerm != "" {
		st := "%" + searchTerm + "%"
		rows, err = a.db.Query(queryExisting, st, st)
	} else {
		rows, err = a.db.Query(queryExisting)
	}

	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var mID, mLabel, oID, oLabel string
			if err := rows.Scan(&mID, &mLabel, &oID, &oLabel); err == nil {
				options = append(options, MeetreeksOption{
					Key:            "existing:" + mID,
					ObjectID:       oID,
					ObjectLabel:    oLabel,
					MeetreeksID:    mID,
					MeetreeksLabel: mLabel,
					DisplayLabel:   fmt.Sprintf("%s : %s", oLabel, mLabel),
					IsNew:          false,
				})
			}
		}
	}

	// 2. Voeg tevens objecten toe als optie om een "Nieuwe meetreeks" te starten
	queryObjects := `
		SELECT id, label 
		FROM objects 
		WHERE deleted_at IS NULL 
	`
	if searchTerm != "" {
		queryObjects += ` AND LOWER(label) LIKE LOWER(?)`
	}
	queryObjects += ` ORDER BY label ASC LIMIT 50`

	var objRows *sql.Rows
	if searchTerm != "" {
		st := "%" + searchTerm + "%"
		objRows, err = a.db.Query(queryObjects, st)
	} else {
		objRows, err = a.db.Query(queryObjects)
	}

	if err == nil {
		defer objRows.Close()
		for objRows.Next() {
			var oID, oLabel string
			if err := objRows.Scan(&oID, &oLabel); err == nil {
				options = append(options, MeetreeksOption{
					Key:          "new:" + oID,
					ObjectID:     oID,
					ObjectLabel:  oLabel,
					DisplayLabel: fmt.Sprintf("%s : Nieuwe meetreeks", oLabel),
					IsNew:        true,
				})
			}
		}
	}

	return options, nil
}

type CreateMeetreeksInput struct {
	ObjectID         string `json:"objectId"`
	MeetreeksLabel   string `json:"meetreeksLabel"`
	ParameterGroupID string `json:"parameterGroupId"`
}

// CreateMeetreeks maakt een nieuw meetreeks object aan en legt alle benodigde relaties
func (a *App) CreateMeetreeks(input CreateMeetreeksInput) (string, error) {
	if a.db == nil {
		return "", fmt.Errorf("database niet verbonden")
	}

	nowISO := time.Now().UTC().Format(time.RFC3339)
	tx, err := a.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	meetreeksID := NewUUIDv7()
	label := input.MeetreeksLabel
	if label == "" {
		label = "Nieuwe Meetreeks"
	}

	// 1. Maak het meetreeks object aan
	_, err = tx.Exec(`
		INSERT INTO objects (id, label, is_confidential, valid_from, updated_at)
		VALUES (?, ?, 0, ?, ?)
	`, meetreeksID, label, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij aanmaken meetreeks object: %w", err)
	}

	// 2. Koppeling naar Object type: Meetreeks ID = 01a17dac-905c-7519-8859-e44d13630ac4 (als source, meetreeks als target)
	typeRelUUID := NewUUIDv7()
	_, err = tx.Exec(`
		INSERT INTO relation_values (id, relation_id, source_id, target_id, valid_from, updated_at)
		VALUES (?, '019fcdd3-721a-7512-b755-cddd67f43eb6', '01a17dac-905c-7519-8859-e44d13630ac4', ?, ?, ?)
	`, typeRelUUID, meetreeksID, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij koppelen objecttype meetreeks: %w", err)
	}

	// 3. Koppeling naar het doelobject (source = objectID, target = meetreeksID, relation_id = 01a014fc-6b2a-7447-b643-740bc09ad213)
	var existingCount int
	_ = tx.QueryRow(`SELECT COUNT(*) FROM relation_values WHERE source_id = ? AND deleted_at IS NULL`, input.ObjectID).Scan(&existingCount)

	objRelUUID := NewUUIDv7()
	_, err = tx.Exec(`
		INSERT INTO relation_values (id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, updated_at)
		VALUES (?, '01a014fc-6b2a-7447-b643-740bc09ad213', ?, ?, ?, 0, ?, ?)
	`, objRelUUID, input.ObjectID, meetreeksID, existingCount+1, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij koppelen aan doelobject: %w", err)
	}

	// 4. Koppeling naar het parameter_groep object (source = meetreeksID, target = parameterGroupID, relation_id = 01a014fc-6b2a-7447-b643-740bc09ad213)
	if input.ParameterGroupID != "" {
		groupRelUUID := NewUUIDv7()
		_, err = tx.Exec(`
			INSERT INTO relation_values (id, relation_id, source_id, target_id, volgorde, is_confidential, valid_from, updated_at)
			VALUES (?, '01a014fc-6b2a-7447-b643-740bc09ad213', ?, ?, 1, 0, ?, ?)
		`, groupRelUUID, meetreeksID, input.ParameterGroupID, nowISO, nowISO)
		if err != nil {
			return "", fmt.Errorf("fout bij koppelen parametergroep aan meetreeks: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}

	return meetreeksID, nil
}
type MeetwaardenRow struct {
	ID        string            `json:"id"`        // ID van het parameter_values record
	Timestamp string            `json:"timestamp"` // valid_from / meetmoment T
	Values    map[string]string `json:"values"`    // map van [parameterId] = waarde
}

// GetMeetwaardenForMeetreeks haalt meetwaarden-sets op voor een meetreeks met optionele limiet
func (a *App) GetMeetwaardenForMeetreeks(meetreeksID string, limit int) ([]MeetwaardenRow, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database niet verbonden")
	}

	query := `
		SELECT id, valid_from, value
		FROM parameter_values
		WHERE target_id = ?
		  AND valid_from = valid_to
		  AND (deleted_at IS NULL OR deleted_at = '')
		ORDER BY valid_from DESC
	`
	
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := a.db.Query(query, meetreeksID)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen meetwaarden: %w", err)
	}
	defer rows.Close()

	var result []MeetwaardenRow
	for rows.Next() {
		var id, validFrom, jsonStr string
		if err := rows.Scan(&id, &validFrom, &jsonStr); err != nil {
			continue
		}

		var valMap map[string]string
		if err := json.Unmarshal([]byte(jsonStr), &valMap); err != nil {
			valMap = make(map[string]string)
		}

		result = append(result, MeetwaardenRow{
			ID:        id,
			Timestamp: validFrom,
			Values:    valMap,
		})
	}

	return result, nil
}
type SaveMeetwaardenInput struct {
	RecordID    string            `json:"recordId"`    // Leeg bij nieuwe rij, gevuld bij update
	MeetreeksID string            `json:"meetreeksId"` // Doel meetreeks ID
	Timestamp   string            `json:"timestamp"`   // Meetmoment T (RFC3339 / ISO string)
	Values      map[string]string `json:"values"`      // Map van [parameterId] = waarde
}

// SaveOrUpdateMeetwaardenRow slaat een meetronde op of werkt deze bij
func (a *App) SaveOrUpdateMeetwaardenRow(input SaveMeetwaardenInput) (string, error) {
	if a.db == nil {
		return "", fmt.Errorf("database niet verbonden")
	}

	nowISO := time.Now().UTC().Format(time.RFC3339)
	timestamp := input.Timestamp
	if timestamp == "" {
		timestamp = nowISO
	}

	// Converteer de values map naar JSON string
	jsonBytes, err := json.Marshal(input.Values)
	if err != nil {
		return "", fmt.Errorf("fout bij serialiseren meetwaarden: %w", err)
	}
	jsonStr := string(jsonBytes)

	tx, err := a.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	recordID := input.RecordID

	if recordID == "" {
		// Nieuwe meetwaarde rij aanmaken
		recordID = NewUUIDv7()
		// Let op: valid_from EN valid_to krijgen dezelfde timestamp T!
		_, err = tx.Exec(`
			INSERT INTO parameter_values (id, parameter_id, target_id, target_type, value, valid_from, valid_to, is_confidential, updated_at)
			VALUES (?, '01a17db5-0aa5-73d6-9200-b03be26a9eac', ?, 'object', ?, ?, ?, 0, ?)
		`, recordID, input.MeetreeksID, jsonStr, timestamp, timestamp, nowISO)
		if err != nil {
			return "", fmt.Errorf("fout bij invoegen meetwaarde: %w", err)
		}
	} else {
		// Bestaande meetwaarde rij bijwerken (correctie, aanvulling of datum/tijd wijziging)
		_, err = tx.Exec(`
			UPDATE parameter_values 
			SET value = ?, valid_from = ?, valid_to = ?, updated_at = ?
			WHERE id = ?
		`, jsonStr, timestamp, timestamp, nowISO, recordID)
		if err != nil {
			return "", fmt.Errorf("fout bij bijwerken meetwaarde: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}

	return recordID, nil
}
// GetParametersForMeetreeks haalt de parameterset op die gekoppeld is aan een meetreeks
func (a *App) GetParametersForMeetreeks(meetreeksID string) ([]ParameterDefinition, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database niet verbonden")
	}

	// Zoek het parameter_groep ID dat gekoppeld is aan de meetreeks via relatie 01a014fc-6b2a-7447-b643-740bc09ad213
	var groupID string
	err := a.db.QueryRow(`
		SELECT target_id 
		FROM relation_values 
		WHERE source_id = ? 
		  AND relation_id = '01a014fc-6b2a-7447-b643-740bc09ad213' 
		  AND deleted_at IS NULL
		LIMIT 1
	`, meetreeksID).Scan(&groupID)

	if err != nil {
		return []ParameterDefinition{}, nil
	}

	// Hergebruik de bestaande functie om de parameters voor deze groep op te halen
	return a.GetParametersForGroup(groupID)
}