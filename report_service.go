package main

import (
	"encoding/json"
	"database/sql"
	"fmt"
	"html"
	"strings"
	"time"
)
type TemplateFieldConfig struct {
	Field    string `json:"field"`
	Fallback string `json:"fallback,omitempty"`
	Type     string `json:"type"` // 'heading' | 'rich_text' | 'text' | 'inline_bold' | string
	CSSClass string `json:"css_class,omitempty"`
	Role     string `json:"role,omitempty"`
}

type TemplateFilter struct {
	AllowedObjectTypes  []string `json:"allowed_object_types,omitempty"`
	ExcludedObjectTypes []string `json:"excluded_object_types,omitempty"`
}

type TOCConfig struct {
	Enabled  bool   `json:"enabled"`
	MaxDepth int    `json:"max_depth"`
	Title    string `json:"title"`
}

// NumberingConfig bepaalt hoe niveaus of het gehele document genummerd worden
type NumberingConfig struct {
	Type          string `json:"type"`            // "decimal", "upper_alpha", "lower_alpha", "roman"
	Separator     string `json:"separator"`       // bijv. "." of "-"
	StopAtLevel   int    `json:"stop_at_level"`   // tot welk niveau nummeren
	InheritParent *bool  `json:"inherit_parent"` // nieuw: true = A.1, false = 1
}

// TemplateLevelRule uitbreiden met een optionele specifieke nummering per niveau
type TemplateLevelRule struct {
	Level           int                   `json:"level"`
	Name            string                `json:"name"`
	HeadingTag      *string               `json:"heading_tag"`
	PageBreakBefore bool                  `json:"page_break_before"`
	IncludeInTOC    bool                  `json:"include_in_toc"`
	Numbering       *NumberingConfig      `json:"numbering,omitempty"` // <-- NIEUW: Optioneel per niveau
	Filter          *TemplateFilter       `json:"filter,omitempty"`
	Fields          []TemplateFieldConfig `json:"fields"`
}
type GlobalSettings struct {
	TOC       TOCConfig       `json:"toc"`
	Numbering NumberingConfig `json:"numbering"`
}

type RootLevelConfig struct {
	TitleField         string                `json:"title_field"`
	FallbackTitleField string                `json:"fallback_title_field,omitempty"`
	SubTitleField      *string               `json:"sub_title_field"` // *string i.v.m. null waarde
	Elements           []TemplateFieldConfig `json:"elements"`
}

type DefaultFallbackRule struct {
	HeadingTag   *string               `json:"heading_tag"` // *string i.v.m. null waarde
	IncludeInTOC bool                  `json:"include_in_toc"`
	ShowHeading  bool                  `json:"show_heading"`
	Fields       []TemplateFieldConfig `json:"fields"`
}

type ReportTemplateConfig struct {
	ID                  string              `json:"id"`
	Naam                string              `json:"naam"`
	Type                string              `json:"type"` // 'book' | 'table' | 'list' | string
	Version             int                 `json:"version"`
	GlobalSettings      GlobalSettings      `json:"global_settings"`
	RootLevel           RootLevelConfig     `json:"root_level"`
	LevelRules          []TemplateLevelRule `json:"level_rules"`
	DefaultFallbackRule DefaultFallbackRule `json:"default_fallback_rule"`
}

// --- DATABASE RECORD STRUCT ---

type DbTemplateRecord struct {
	ID         string  `json:"id"`
	Label      string  `json:"label"`
	Description *string `json:"description"` // *string i.v.m. null (optioneel)
	Type       string  `json:"type"`
	ConfigJSON *string `json:"config_json"`  // *string i.v.m. null (optioneel)
	UpdatedAt  string  `json:"updated_at"`
	DeletedAt  *string `json:"deleted_at"`  // *string i.v.m. null (optioneel)
}

// ReportNode stelt een knoop in de rapportageboom voor
type ReportNode struct {
	ObjectID           string       `json:"objectId"`
	Label              string       `json:"label"`
	ObjectTypeLabel    sql.NullString `json:"objectTypeLabel"`
	ParamTitelID       sql.NullString `json:"paramTitelId"`
	Titel              sql.NullString `json:"titel"`
	ParamToelichtingID sql.NullString `json:"paramToelichtingId"`
	Toelichting        sql.NullString `json:"toelichting"`
	Numbering          string       `json:"numbering"`
	Level              int          `json:"level"`
	Children           []ReportNode `json:"children,omitempty"`
}

// GenerateBookReport haalt data op en bouwt een interactieve HTML string  GenerateBookReport accepteert nu ook templateID
func (a *App) GenerateBookReport(rootID string, maxDepth int, templateID string) (string, error) {
	startTime := time.Now()

	// 1. Haal eventueel het geparste template op
	var templateConfig *ReportTemplateConfig
	if templateID != "" {
		cfg, err := a.GetParsedTemplateById(templateID)
		if err == nil {
			templateConfig = cfg
		}
	}

	// 2. Haal de boomstructuur op (aangepast met templateConfig als 5e argument)
rootNode, err := a.fetchReportNodeRecursive(rootID, 1, maxDepth, "1", templateConfig)
if err != nil {
    return "", fmt.Errorf("fout bij ophalen rapportageboom: %w", err)
}
	// 3. Genereer HTML & Inhoudsopgave
	var htmlBuilder strings.Builder
	var tocBuilder strings.Builder

	tocBuilder.WriteString(`<nav class="report-toc"><h2>Inhoudsopgave</h2><ul>`)
	a.buildReportHTML(rootNode, &htmlBuilder, &tocBuilder, templateConfig)
	tocBuilder.WriteString(`</ul></nav><hr class="toc-divider" />`)

	// 4. Bundel tot complete HTML document-body
	finalHTML := fmt.Sprintf(`
		<div class="book-report-wrapper template-%s">
			<header class="book-header" data-object-id="%s">
				<h1 class="book-main-title">%s</h1>
				%s
			</header>
			%s
			<main class="book-body">
				%s
			</main>
		</div>
	`, 
		templateID,
		rootNode.ObjectID,
		getDisplayTitle(rootNode),
		getColophonHTML(rootNode),
		tocBuilder.String(),
		htmlBuilder.String(),
	)

	fmt.Printf("[PERFORMANCE] Rapportage (%s) gegenereerd in %v voor root: %s\n", templateID, time.Since(startTime), rootID)

	return finalHTML, nil
}
func (a *App) fetchReportNodeRecursive(objectID string, currentDepth, maxDepth int, prefix string, config *ReportTemplateConfig) (*ReportNode, error) {
	node := &ReportNode{
		ObjectID:  objectID,
		Level:     currentDepth,
		Numbering: prefix,
	}

	// 1. Lees object uit de view
	query := `
		SELECT 
			label, object_type_label, param_titel_id, titel, param_toelichting_id, toelichting 
		FROM v_objecten_met_details 
		WHERE object_id = ?
	`
	err := a.db.QueryRow(query, objectID).Scan(
		&node.Label, &node.ObjectTypeLabel, &node.ParamTitelID, 
		&node.Titel, &node.ParamToelichtingID, &node.Toelichting,
	)
	if err != nil {
		return nil, err
	}

	// 2. Haal kinderen op als maxDepth nog niet is bereikt
	if currentDepth < maxDepth {
		rows, err := a.db.Query(`
			SELECT rv.target_id 
			FROM relation_values rv
			JOIN objects o ON o.id = rv.target_id
			WHERE rv.source_id = ? 
			  AND rv.deleted_at IS NULL 
			  AND o.deleted_at IS NULL
			ORDER BY rv.volgorde ASC, o.label ASC
		`, objectID)

		if err == nil {
			defer rows.Close()
			childIdx := 1
			for rows.Next() {
				var childID string
				if err := rows.Scan(&childID); err == nil {
					
					// Bepaal nummeringsstijl voor het volgende niveau
					childPrefix := calculateChildPrefix(prefix, currentDepth, childIdx, config)

					childNode, err := a.fetchReportNodeRecursive(childID, currentDepth+1, maxDepth, childPrefix, config)
					if err == nil && childNode != nil {
						node.Children = append(node.Children, *childNode)
						childIdx++
					}
				}
			}
		}
	}

	return node, nil
}

func (a *App) buildReportHTML(node *ReportNode, body *strings.Builder, toc *strings.Builder, config *ReportTemplateConfig) {
	if node.Level > 1 {
		title := getDisplayTitle(node)
		anchorID := fmt.Sprintf("node-%s", node.ObjectID)

		// 1. Haal dynamische instellingen voor dit niveau op
		headingTag, includeInTOC := getLevelRule(config, node.Level)

		// 2. Inhoudsopgave item (gebruikt nu include_in_toc uit het template)
		if includeInTOC {
			indentClass := fmt.Sprintf("toc-level-%d", node.Level-1)
			toc.WriteString(fmt.Sprintf(
				`<li class="%s"><a href="#%s"><span class="toc-num">%s</span> %s</a></li>`,
				indentClass, anchorID, node.Numbering, html.EscapeString(title),
			))
		}

		// 3. HTML Sectie
		body.WriteString(fmt.Sprintf(`<section id="%s" class="report-section level-%d" data-object-id="%s">`, anchorID, node.Level, node.ObjectID))
		
		// Koptekst met dynamische HTML-tag (h1, h2, h3, etc.)
		body.WriteString(fmt.Sprintf(
			`<%s class="report-heading" data-object-id="%s"><span class="num">%s.</span> %s</%s>`,
			headingTag, node.ObjectID, node.Numbering, html.EscapeString(title), headingTag,
		))

		// Toelichting
		if node.Toelichting.Valid && strings.TrimSpace(node.Toelichting.String) != "" {
			paramID := ""
			if node.ParamToelichtingID.Valid {
				paramID = node.ParamToelichtingID.String
			}
			body.WriteString(fmt.Sprintf(
				`<div class="editable-richtext" data-param-value-id="%s" data-object-id="%s" data-field="toelichting">%s</div>`,
				paramID, node.ObjectID, node.Toelichting.String,
			))
		}

		body.WriteString(`</section>`)
	}

	for i := range node.Children {
		a.buildReportHTML(&node.Children[i], body, toc, config)
	}
}
func getDisplayTitle(node *ReportNode) string {
	if node.Titel.Valid && strings.TrimSpace(node.Titel.String) != "" {
		return node.Titel.String
	}
	return node.Label
}

func getColophonHTML(node *ReportNode) string {
	if node.Toelichting.Valid && strings.TrimSpace(node.Toelichting.String) != "" {
		paramID := ""
		if node.ParamToelichtingID.Valid {
			paramID = node.ParamToelichtingID.String
		}
		return fmt.Sprintf(
			`<div class="book-colophon editable-richtext" data-param-value-id="%s" data-object-id="%s" data-field="toelichting">%s</div>`,
			paramID, node.ObjectID, node.Toelichting.String,
		)
	}
	return ""
}

func min(a, b int) int {
	if a < b { return a }
	return b
}

// In app.go (of vergelijkbaar Go bestand):

// GetTemplateById haalt één sjabloon op uit de SQLite database op basis van ID
func (a *App) GetTemplateById(id string) (*DbTemplateRecord, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database is niet verbonden")
	}

	query := `
		SELECT id, label, description, type, config_json, updated_at, deleted_at 
		FROM templates 
		WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
		LIMIT 1
	`

	var rec DbTemplateRecord
	var desc, configJSON, deletedAt sql.NullString // Vangt NULL-waarden in SQLite op

	err := a.db.QueryRow(query, id).Scan(
		&rec.ID,
		&rec.Label,
		&desc,
		&rec.Type,
		&configJSON,
		&rec.UpdatedAt,
		&deletedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("template met id '%s' niet gevonden", id)
		}
		return nil, fmt.Errorf("fout bij ophalen template: %w", err)
	}

	// Zet sql.NullString om naar pointers voor correcte JSON-conversie naar frontend
	if desc.Valid {
		rec.Description = &desc.String
	}
	if configJSON.Valid {
		rec.ConfigJSON = &configJSON.String
	}
	if deletedAt.Valid {
		rec.DeletedAt = &deletedAt.String
	}

	return &rec, nil
}

// SaveTemplateRecord slaat een gewijzigd of nieuw sjabloon op (UPSERT) en retourneert het opgeslagen record
func (a *App) SaveTemplateRecord(template DbTemplateRecord) (*DbTemplateRecord, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database is niet verbonden")
	}

	// 1. Ken automatisch een UUIDv7 toe als het een nieuw sjabloon betreft
	if template.ID == "" {
		template.ID = NewUUIDv7()
	}

	// Zorg voor een bijgewerkte RFC3339 timestamp als deze ontbreekt
	updatedAt := template.UpdatedAt
	if updatedAt == "" {
		updatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	template.UpdatedAt = updatedAt

	query := `
		INSERT INTO templates (id, label, description, type, config_json, updated_at) 
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET 
			label = excluded.label,
			description = excluded.description,
			type = excluded.type,
			config_json = excluded.config_json,
			updated_at = excluded.updated_at
	`

	// Omzetten van Go pointers naar NULL voor SQLite
	var desc interface{} = nil
	if template.Description != nil {
		desc = *template.Description
	}

	var configJSON interface{} = nil
	if template.ConfigJSON != nil {
		configJSON = *template.ConfigJSON
	}

	_, err := a.db.Exec(
		query,
		template.ID,
		template.Label,
		desc,
		template.Type,
		configJSON,
		updatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("fout bij opslaan template '%s': %w", template.ID, err)
	}

	// 2. Geef het bijgewerkte record (inclusief het gegenereerde ID) terug
	return &template, nil
}
// GetParsedTemplateById haalt het sjabloon op en decodeert de ConfigJSON direct naar ReportTemplateConfig
func (a *App) GetParsedTemplateById(id string) (*ReportTemplateConfig, error) {
	record, err := a.GetTemplateById(id)
	if err != nil {
		return nil, err
	}

	if record.ConfigJSON == nil || strings.TrimSpace(*record.ConfigJSON) == "" {
		return nil, fmt.Errorf("template '%s' heeft geen config_json inhoud", id)
	}

	var config ReportTemplateConfig
	if err := json.Unmarshal([]byte(*record.ConfigJSON), &config); err != nil {
		return nil, fmt.Errorf("fout bij parsen van config_json voor template '%s': %w", id, err)
	}

	return &config, nil
}

// SaveParsedTemplate slaat een ReportTemplateConfig direct op.
// Verwacht exact 1 return value: (error)
func (a *App) SaveParsedTemplate(label string, description *string, config ReportTemplateConfig) error {
	// 1. Zorg voor een uniek ID als het een nieuw template betreft
	if config.ID == "" {
		config.ID = NewUUIDv7()
	}

	// 2. Omzetten naar JSON
	jsonBytes, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("fout bij converteren template config: %w", err)
	}

	jsonStr := string(jsonBytes)
	record := DbTemplateRecord{
		ID:          config.ID,
		Label:       label,
		Description: description,
		Type:        config.Type,
		ConfigJSON:  &jsonStr,
		UpdatedAt:   time.Now().UTC().Format(time.RFC3339),
	}

	// 3. Opslaan via SaveTemplateRecord en eventuele error direct teruggeven
	_, err = a.SaveTemplateRecord(record)
	if err != nil {
		return err
	}

	return nil
}
// GetTemplates haalt alle actieve sjablonen op (zonder deleted_at)
func (a *App) GetTemplates() ([]DbTemplateRecord, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database is niet verbonden")
	}

	query := `
		SELECT id, label, description, type, config_json, updated_at, deleted_at 
		FROM templates 
		WHERE deleted_at IS NULL OR deleted_at = ''
		ORDER BY label ASC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen templates: %w", err)
	}
	defer rows.Close()

	var templates []DbTemplateRecord
	for rows.Next() {
		var rec DbTemplateRecord
		var desc, configJSON, deletedAt sql.NullString

		err := rows.Scan(
			&rec.ID,
			&rec.Label,
			&desc,
			&rec.Type,
			&configJSON,
			&rec.UpdatedAt,
			&deletedAt,
		)
		if err != nil {
			return nil, err
		}

		if desc.Valid {
			rec.Description = &desc.String
		}
		if configJSON.Valid {
			rec.ConfigJSON = &configJSON.String
		}
		if deletedAt.Valid {
			rec.DeletedAt = &deletedAt.String
		}

		templates = append(templates, rec)
	}

	return templates, nil
}
// getLevelRule zoekt de regel voor het specifieke niveau op uit het template,
// of valt terug op een veilige standaard als het niveau niet gedefinieerd is.
func getLevelRule(config *ReportTemplateConfig, level int) (tag string, includeInTOC bool) {
	// Standaard fallbacks
	defaultTags := map[int]string{1: "h1", 2: "h2", 3: "h3", 4: "h4"}
	tag = defaultTags[level]
	if tag == "" {
		tag = "h5"
	}
	includeInTOC = true

	if config == nil {
		return tag, includeInTOC
	}

	for _, rule := range config.LevelRules {
		if rule.Level == level {
			if rule.HeadingTag != nil && *rule.HeadingTag != "" {
				tag = *rule.HeadingTag
			}
			includeInTOC = rule.IncludeInTOC
			return tag, includeInTOC
		}
	}

	return tag, includeInTOC
}
// formatNumberFormat zet een index (1-based) om naar het gewenste formaat
func formatNumberFormat(index int, style string) string {
	switch style {
	case "upper_alpha":
		return string(rune('A' + index - 1))
	case "lower_alpha":
		return string(rune('a' + index - 1))
	case "roman":
		return toRoman(index)
	case "decimal":
		fallthrough
	default:
		return fmt.Sprintf("%d", index)
	}
}

// toRoman converteert een getal naar Romeinse cijfers (I, II, III, IV, etc.)
func toRoman(num int) string {
	values := []int{1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1}
	symbols := []string{"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"}
	var result strings.Builder
	for i := 0; i < len(values); i++ {
		for num >= values[i] {
			num -= values[i]
			result.WriteString(symbols[i])
		}
	}
	return result.String()
}

func calculateChildPrefix(parentPrefix string, parentLevel, childIndex int, config *ReportTemplateConfig) string {
	childLevel := parentLevel + 1

	// Defaults volgens jouw specificaties:
	// - Type: decimal (1, 2, 3)
	// - Separator: .
	// - InheritParent: true (1.1, A.1, etc.)
	numType := "decimal"
	separator := "."
	inheritParent := true

	// 1. Controleer of er een globale instelling is
	if config != nil && config.GlobalSettings.Numbering.Type != "" {
		numType = config.GlobalSettings.Numbering.Type
		if config.GlobalSettings.Numbering.Separator != "" {
			separator = config.GlobalSettings.Numbering.Separator
		}
		if config.GlobalSettings.Numbering.InheritParent != nil {
			inheritParent = *config.GlobalSettings.Numbering.InheritParent
		}
	}

	// 2. Overschrijf eventueel met niveau-specifieke regel uit LevelRules (specifiek heeft voorrang!)
	if config != nil {
		for _, rule := range config.LevelRules {
			if rule.Level == childLevel && rule.Numbering != nil {
				if rule.Numbering.Type != "" {
					numType = rule.Numbering.Type
				}
				if rule.Numbering.Separator != "" {
					separator = rule.Numbering.Separator
				}
				if rule.Numbering.InheritParent != nil {
					inheritParent = *rule.Numbering.InheritParent
				}
				break
			}
		}
	}

	// 3. Geformeerde index opbouwen (bijv. "1", "A", "I")
	formattedIndex := formatNumberFormat(childIndex, numType)

	// Als dit het eerste niveau is onder de root (niveau 1 heeft meestal geen parent prefix)
	if parentLevel == 1 || parentPrefix == "" || !inheritParent {
		return formattedIndex
	}

	// Bovenliggende nummering wel meenemen (default gedrag)
	return fmt.Sprintf("%s%s%s", parentPrefix, separator, formattedIndex)
}