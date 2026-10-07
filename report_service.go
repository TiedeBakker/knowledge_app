package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"html"
	"regexp"
	"strings"
	"time"
)

type TemplateFieldConfig struct {
	Field        string `json:"field"`
	Fallback     string `json:"fallback,omitempty"`
	FallbackText string `json:"fallback_text,omitempty"` // Nieuw: statische terugvaltekst
	Type         string `json:"type"`                    // 'rich_text' | 'text' | 'inline_bold'
	CSSClass     string `json:"css_class,omitempty"`
	Role         string `json:"role,omitempty"`
}
type TemplateFilter struct {
	AllowedObjectTypes  []string `json:"allowed_object_types,omitempty"`
	ExcludedObjectTypes []string `json:"excluded_object_types,omitempty"`
}

type TOCConfig struct {
	Enabled          bool   `json:"enabled"`
	MaxDepth         int    `json:"max_depth"`
	Title            string `json:"title"`
	IncludeNumbering bool   `json:"include_numbering"` // <-- NIEUW: nummering in TOC aan-/uitzetten
}

// NumberingConfig bepaalt hoe niveaus of het gehele document genummerd worden
type NumberingConfig struct {
	Type          string `json:"type"`           // "decimal", "upper_alpha", "lower_alpha", "roman"
	Separator     string `json:"separator"`      // bijv. "." of "-"
	StopAtLevel   int    `json:"stop_at_level"`  // tot welk niveau nummeren
	InheritParent *bool  `json:"inherit_parent"` // nieuw: true = A.1, false = 1
}

// TemplateLevelRule uitbreiden met een optionele specifieke nummering per niveau
type TemplateLevelRule struct {
	Level           int                   `json:"level"`
	Name            string                `json:"name"`
	HeadingTag      *string               `json:"heading_tag"`
	PageBreakBefore bool                  `json:"page_break_before"`
	IncludeInTOC    bool                  `json:"include_in_toc"`
	Numbering       *NumberingConfig      `json:"numbering,omitempty"`
	TOC             *TOCConfig            `json:"toc,omitempty"` // <-- NIEUW: Optioneel per niveau
	Filter          *TemplateFilter       `json:"filter,omitempty"`
	Fields          []TemplateFieldConfig `json:"fields"`
}
type GlobalSettings struct {
	TOC       TOCConfig       `json:"toc"`
	Numbering NumberingConfig `json:"numbering"`
}

// GlobalSettings voor v2 sjablonen
type V2GlobalSettings struct {
	TOC      TOCConfig `json:"toc"`
	MaxDepth int       `json:"max_depth"` // <- Nieuw: instelbare maximale diepte
}

type LevelConfig struct {
	NumberingStyle string       `json:"numbering_style"` // "numeric", "alpha_upper", "alpha_lower", "roman_upper", "roman_lower", "none"
	InheritParent  *bool        `json:"inherit_parent"`  // Pointer zodat we nil (default true) kunnen onderscheiden van explicit false
	HeaderCSS      string       `json:"header_css"`
	Fields         []V2FieldDef `json:"fields"`
}

type V2ReportConfig struct {
	Version    int    `json:"version"`
	Type       string `json:"type"`
	DataSource struct {
		ViewName   string `json:"view_name"`
		PrimaryKey string `json:"primary_key"`
	} `json:"data_source"`
	GlobalSettings V2GlobalSettings       `json:"global_settings"`
	Fields         []V2FieldDef           `json:"fields"`
	Levels         map[string]LevelConfig `json:"levels"`
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
	SourceView          string              `json:"source_view,omitempty"`
	RootLevel           RootLevelConfig     `json:"root_level"`
	LevelRules          []TemplateLevelRule `json:"level_rules"`
	DefaultFallbackRule DefaultFallbackRule `json:"default_fallback_rule"`
}

// --- DATABASE RECORD STRUCT ---

type DbTemplateRecord struct {
	ID          string  `json:"id"`
	Label       string  `json:"label"`
	Description *string `json:"description"` // *string i.v.m. null (optioneel)
	Type        string  `json:"type"`
	ConfigJSON  *string `json:"config_json"` // *string i.v.m. null (optioneel)
	UpdatedAt   string  `json:"updated_at"`
	DeletedAt   *string `json:"deleted_at"` // *string i.v.m. null (optioneel)
}

// ReportNode stelt een knoop in de rapportageboom voor
type ReportNode struct {
	ObjectID  string            `json:"objectId"`
	Label     string            `json:"label"`
	Numbering string            `json:"numbering"`
	Level     int               `json:"level"`
	FieldData map[string]string `json:"fieldData"` // Optie A: Alle veldwaarden (titel, toelichting, samenvatting, etc.)
	ParamIDs  map[string]string `json:"paramIds"`  // Optie A: Bijbehorende param_value_id's voor editing
	Children  []ReportNode      `json:"children,omitempty"`
}

// GenerateBookReport haalt data op en bouwt een interactieve HTML string
func (a *App) GenerateBookReport(rootID string, maxDepth int, templateID string) (string, error) {
	startTime := time.Now()

	// 1. Haal eventueel het geparste template op
	var templateConfig *ReportTemplateConfig
	if templateID != "" {
		cfg, err := a.GetParsedTemplateById(templateID)
		if err == nil {
			templateConfig = cfg

			// ✅ V2 ROUTERING CHECK:
			// als het template v2 is, takken we af naar de nieuwe V2 engine
			if templateConfig.Version == 2 || templateConfig.Type == "report_v2" {
				return a.V2_GenerateBookReport(rootID, templateID)
			}
		}
	}

	// =========================================================================
	// VANAF HIER: UNTOUCHED V1 PIPELINE (Bestaande code blijft 100% gelijk)
	// =========================================================================

	// 2. Haal de boomstructuur op (start prefix is leeg "")
	rootNode, err := a.fetchReportNodeRecursive(rootID, 1, maxDepth, "", templateConfig)
	if err != nil {
		return "", fmt.Errorf("fout bij ophalen rapportageboom: %w", err)
	}

	// 3. Genereer HTML & Inhoudsopgave
	var htmlBuilder strings.Builder
	var tocBuilder strings.Builder

	// Bepaal TOC-instellingen uit template (met veilige standaarden als config nil is)
	tocEnabled := true
	tocTitle := "Inhoudsopgave"
	tocMaxDepth := maxDepth // fallback op de algemene maxDepth

	if templateConfig != nil {
		tocEnabled = templateConfig.GlobalSettings.TOC.Enabled
		if templateConfig.GlobalSettings.TOC.Title != "" {
			tocTitle = templateConfig.GlobalSettings.TOC.Title
		}
		if templateConfig.GlobalSettings.TOC.MaxDepth > 0 {
			tocMaxDepth = templateConfig.GlobalSettings.TOC.MaxDepth
		}
	}

	// Bouw alleen de TOC op als enabled == true
	tocHTML := ""
	if tocEnabled {
		tocBuilder.WriteString(fmt.Sprintf(`<nav class="report-toc"><h2>%s</h2><ul>`, html.EscapeString(tocTitle)))
		a.buildReportHTML(rootNode, &htmlBuilder, &tocBuilder, templateConfig, tocMaxDepth)
		tocBuilder.WriteString(`</ul></nav><hr class="toc-divider" />`)
		tocHTML = tocBuilder.String()
	} else {
		// Wel de body bouwen (zonder TOC)
		a.buildReportHTML(rootNode, &htmlBuilder, nil, templateConfig, tocMaxDepth)
	}

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
		tocHTML,
		htmlBuilder.String(),
	)
	fmt.Printf("[PERFORMANCE] Rapportage (%s) gegenereerd in %v voor root: %s\n", templateID, time.Since(startTime), rootID)

	return finalHTML, nil
}

// resolveFieldValue zoekt de waarde en paramID op volgens de ingestelde fallback-keten
func resolveFieldValue(node *ReportNode, fieldCfg TemplateFieldConfig) (val string, paramID string) {
	if node.FieldData == nil {
		return "", ""
	}

	// 1. Probeer het primaire DB-veld
	if content, exists := node.FieldData[fieldCfg.Field]; exists && strings.TrimSpace(content) != "" {
		return content, node.ParamIDs[fieldCfg.Field]
	}

	// 2. Probeer het fallback DB-veld (indien opgegeven)
	if fieldCfg.Fallback != "" {
		if content, exists := node.FieldData[fieldCfg.Fallback]; exists && strings.TrimSpace(content) != "" {
			return content, node.ParamIDs[fieldCfg.Fallback]
		}
	}

	// 3. Valt terug op de statische fallback-tekst uit de template JSON
	if fieldCfg.FallbackText != "" {
		return fieldCfg.FallbackText, ""
	}

	// 4. Anders niks renderen
	return "", ""
}

// getLevelFields haalt de geselecteerde fields op voor een specifiek niveau uit de template config
func getLevelFields(config *ReportTemplateConfig, level int) []TemplateFieldConfig {
	if config != nil {
		for _, rule := range config.LevelRules {
			if rule.Level == level && len(rule.Fields) > 0 {
				return rule.Fields
			}
		}
	}
	// Standaard fallback als er geen fields zijn gedefinieerd in het sjabloon
	return []TemplateFieldConfig{
		{Field: "toelichting", Type: "rich_text"},
	}
}

func (a *App) fetchReportNodeRecursive(objectID string, currentDepth, maxDepth int, prefix string, config *ReportTemplateConfig) (*ReportNode, error) {
	node := &ReportNode{
		ObjectID:  objectID,
		Level:     currentDepth,
		Numbering: prefix,
		FieldData: make(map[string]string),
		ParamIDs:  make(map[string]string),
	}

	// 1. Bepaal de viewnaam met fallback op "v_objecten_met_details"
	viewName := "v_objecten_met_details"
	if config != nil && strings.TrimSpace(config.SourceView) != "" {
		viewName = strings.TrimSpace(config.SourceView)
	}

	// Veiligheidscheck: zorg dat de viewnaam alleen toegestane tekens bevat (a-z, A-Z, 0-9, _)
	matched, _ := regexp.MatchString(`^[a-zA-Z0-9_]+$`, viewName)
	if !matched {
		return nil, fmt.Errorf("ongeldige viewnaam in sjabloongegevens: %s", viewName)
	}

	// 2. Bouw de dynamische query op
	query := fmt.Sprintf(`
		SELECT 
			label, 
			object_type_label, 
			param_titel_id, 
			titel, 
			param_toelichting_id, 
			toelichting,
			param_tekst_id,
			tekst,
			param_samenvatting_id,
			samenvatting,
			param_conclusie_id,
			conclusie,
			param_notities_id,
			notities
		FROM %s 
		WHERE object_id = ?
	`, viewName)

	var label, objectTypeLabel sql.NullString
	var paramTitelID, titel sql.NullString
	var paramToelichtingID, toelichting sql.NullString
	var paramTekstID, tekst sql.NullString
	var paramSamenvattingID, samenvatting sql.NullString
	var paramConclusieID, conclusie sql.NullString
	var paramNotitiesID, notities sql.NullString

	err := a.db.QueryRow(query, objectID).Scan(
		&label, &objectTypeLabel,
		&paramTitelID, &titel,
		&paramToelichtingID, &toelichting,
		&paramTekstID, &tekst,
		&paramSamenvattingID, &samenvatting,
		&paramConclusieID, &conclusie,
		&paramNotitiesID, &notities,
	)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen details uit %s voor object %s: %w", viewName, objectID, err)
	}

	if label.Valid {
		node.Label = label.String
	}

	// FieldData en ParamIDs mappen vullen
	if titel.Valid {
		node.FieldData["titel"] = titel.String
	}
	if paramTitelID.Valid {
		node.ParamIDs["titel"] = paramTitelID.String
	}

	if toelichting.Valid {
		node.FieldData["toelichting"] = toelichting.String
	}
	if paramToelichtingID.Valid {
		node.ParamIDs["toelichting"] = paramToelichtingID.String
	}

	if tekst.Valid {
		node.FieldData["tekst"] = tekst.String
	}
	if paramTekstID.Valid {
		node.ParamIDs["tekst"] = paramTekstID.String
	}

	if samenvatting.Valid {
		node.FieldData["samenvatting"] = samenvatting.String
	}
	if paramSamenvattingID.Valid {
		node.ParamIDs["samenvatting"] = paramSamenvattingID.String
	}

	if conclusie.Valid {
		node.FieldData["conclusie"] = conclusie.String
	}
	if paramConclusieID.Valid {
		node.ParamIDs["conclusie"] = paramConclusieID.String
	}

	if notities.Valid {
		node.FieldData["notities"] = notities.String
	}
	if paramNotitiesID.Valid {
		node.ParamIDs["notities"] = paramNotitiesID.String
	}

	// 3. Haal kinderen op als maxDepth nog niet is bereikt
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
					targetChildLevel := currentDepth
					childPrefix := calculateChildPrefix(prefix, targetChildLevel, childIdx, config)

					childNode, err := a.fetchReportNodeRecursive(childID, currentDepth+1, maxDepth, childPrefix, config)
					if err == nil && childNode != nil {
						node.Children = append(node.Children, *childNode)
						childIdx++
					}
				}
			}
			if err := rows.Err(); err != nil {
				return nil, fmt.Errorf("fout tijdens itereren van kinderen: %w", err)
			}
		}
	}

	return node, nil
}
func (a *App) buildReportHTML(node *ReportNode, body *strings.Builder, toc *strings.Builder, config *ReportTemplateConfig, tocMaxDepth int) {
	if node.Level > 1 {
		ruleLevel := node.Level - 1
		title := getDisplayTitle(node)
		anchorID := fmt.Sprintf("node-%s", node.ObjectID)

		headingTag, includeInTOC := getLevelRule(config, ruleLevel)

		// 1. Globale Inhoudsopgave item toevoegen
		if toc != nil && includeInTOC && ruleLevel <= tocMaxDepth {
			indentClass := fmt.Sprintf("toc-level-%d", ruleLevel)

			// Check of nummering getoond moet worden in TOC
			showNum := true
			if config != nil {
				showNum = config.GlobalSettings.TOC.IncludeNumbering
			}

			numHTML := ""
			if showNum && node.Numbering != "" {
				numHTML = fmt.Sprintf(`<span class="toc-num">%s</span> `, html.EscapeString(node.Numbering))
			}

			toc.WriteString(fmt.Sprintf(
				`<li class="%s"><a href="#%s">%s%s</a></li>`,
				indentClass, anchorID, numHTML, html.EscapeString(title),
			))
		}
		// 2. HTML Sectie openen
		body.WriteString(fmt.Sprintf(`<section id="%s" class="report-section level-%d" data-object-id="%s">`, anchorID, ruleLevel, node.ObjectID))

		// Heading
		body.WriteString(fmt.Sprintf(
			`<%s class="report-heading" data-object-id="%s"><span class="num">%s</span> %s</%s>`,
			headingTag, node.ObjectID, node.Numbering, html.EscapeString(title), headingTag,
		))

		// 3. LOKALE / SECTIE TOC RENDERING
		if localTOCCfg := getLevelTOCConfig(config, ruleLevel); localTOCCfg != nil {
			localTOChtml := renderLocalTOC(node, localTOCCfg, config)
			if localTOChtml != "" {
				body.WriteString(localTOChtml)
			}
		}

		// 4. DYNAMISCHE VELDEN RENDERING (Optie C)
		fields := getLevelFields(config, ruleLevel)
		for _, fieldCfg := range fields {
			content, paramID := resolveFieldValue(node, fieldCfg)
			if content == "" {
				continue // Leeg of geen match: niks renderen
			}

			cssClass := "report-field"
			if fieldCfg.CSSClass != "" {
				cssClass += " " + fieldCfg.CSSClass
			}

			switch fieldCfg.Type {
			case "rich_text":
				body.WriteString(fmt.Sprintf(
					`<div class="editable-richtext %s" data-param-value-id="%s" data-object-id="%s" data-field="%s">%s</div>`,
					cssClass, paramID, node.ObjectID, fieldCfg.Field, content,
				))
			case "text":
				body.WriteString(fmt.Sprintf(
					`<p class="%s">%s</p>`,
					cssClass, html.EscapeString(content),
				))
			case "inline_bold":
				body.WriteString(fmt.Sprintf(
					`<strong class="%s">%s</strong>`,
					cssClass, html.EscapeString(content),
				))
			default:
				body.WriteString(fmt.Sprintf(
					`<div class="%s">%s</div>`,
					cssClass, content,
				))
			}
		}

		body.WriteString(`</section>`)
	}

	for i := range node.Children {
		a.buildReportHTML(&node.Children[i], body, toc, config, tocMaxDepth)
	}
}

func getDisplayTitle(node *ReportNode) string {
	if val, exists := node.FieldData["titel"]; exists && strings.TrimSpace(val) != "" {
		return val
	}
	return node.Label
}

func getColophonHTML(node *ReportNode) string {
	if val, exists := node.FieldData["toelichting"]; exists && strings.TrimSpace(val) != "" {
		paramID := node.ParamIDs["toelichting"]
		return fmt.Sprintf(
			`<div class="book-colophon editable-richtext" data-param-value-id="%s" data-object-id="%s" data-field="toelichting">%s</div>`,
			paramID, node.ObjectID, val,
		)
	}
	return ""
}
func min(a, b int) int {
	if a < b {
		return a
	}
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
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("fout tijdens itereren van templates: %w", err)
		}
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

func calculateChildPrefix(parentPrefix string, targetLevel, childIndex int, config *ReportTemplateConfig) string {
	// childLevel := parentLevel + 1  <-- DEZE REGEL VERWIJDEREN!
	childLevel := targetLevel

	// 1. Standaard veilige defaults
	numType := "decimal"
	separator := "."
	inheritParent := true

	// 2. Haal ALTIJD eerst de globale instellingen op als basis
	if config != nil {
		if config.GlobalSettings.Numbering.Type != "" {
			numType = config.GlobalSettings.Numbering.Type
		}
		if config.GlobalSettings.Numbering.Separator != "" {
			separator = config.GlobalSettings.Numbering.Separator
		}
		if config.GlobalSettings.Numbering.InheritParent != nil {
			inheritParent = *config.GlobalSettings.Numbering.InheritParent
		}
	}

	// 3. Overschrijf SPECIFIEKE velden van de regel die hoort bij DIT specifieke niveau (childLevel/targetLevel)
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

	// 4. Formatteer de huidige index
	formattedIndex := formatNumberFormat(childIndex, numType)

	// 5. Geen parent (Niveau 1), of overerving staat uit voor dit niveau
	if parentPrefix == "" || !inheritParent {
		return formattedIndex
	}

	// 6. Plak parentPrefix aan formattedIndex met de separator die geldt voor DIT niveau
	return fmt.Sprintf("%s%s%s", parentPrefix, separator, formattedIndex)
}

// getLevelTOCConfig zoekt de eventuele TOC-configuratie op voor een specifiek niveau
func getLevelTOCConfig(config *ReportTemplateConfig, level int) *TOCConfig {
	if config == nil {
		return nil
	}
	for _, rule := range config.LevelRules {
		if rule.Level == level && rule.TOC != nil {
			return rule.TOC
		}
	}
	return nil
}

// buildSubTOCBuilder bouwt een recursieve <ul>/<li> structuur voor de kinderen van een specifieke node
func buildSubTOCBuilder(node *ReportNode, builder *strings.Builder, currentRelDepth, maxRelDepth int, config *ReportTemplateConfig) {
	if currentRelDepth > maxRelDepth || len(node.Children) == 0 {
		return
	}

	builder.WriteString(`<ul>`)
	for i := range node.Children {
		child := &node.Children[i]
		childRuleLevel := child.Level - 1
		_, includeInTOC := getLevelRule(config, childRuleLevel)

		if includeInTOC {
			anchorID := fmt.Sprintf("node-%s", child.ObjectID)
			title := getDisplayTitle(child)
			indentClass := fmt.Sprintf("toc-sub-level-%d", currentRelDepth)

			builder.WriteString(fmt.Sprintf(
				`<li class="%s"><a href="#%s"><span class="toc-num">%s</span> %s</a>`,
				indentClass, anchorID, child.Numbering, html.EscapeString(title),
			))

			// Eventuele diepere sub-kinderen verwerken
			buildSubTOCBuilder(child, builder, currentRelDepth+1, maxRelDepth, config)

			builder.WriteString(`</li>`)
		}
	}
	builder.WriteString(`</ul>`)
}

// generateLocalTOC HTML helper
func renderLocalTOC(node *ReportNode, tocCfg *TOCConfig, config *ReportTemplateConfig) string {
	if tocCfg == nil || !tocCfg.Enabled || len(node.Children) == 0 {
		return ""
	}

	title := "Inhoud"
	if tocCfg.Title != "" {
		title = tocCfg.Title
	}

	maxDepth := 2 // Standaard relatieve diepte als deze niet is opgegeven
	if tocCfg.MaxDepth > 0 {
		maxDepth = tocCfg.MaxDepth
	}

	var subTocBuilder strings.Builder
	subTocBuilder.WriteString(fmt.Sprintf(`<nav class="report-section-toc"><h3>%s</h3>`, html.EscapeString(title)))
	buildSubTOCBuilder(node, &subTocBuilder, 1, maxDepth, config)
	subTocBuilder.WriteString(`</nav>`)

	return subTocBuilder.String()
}

const DefaultV2View = "v_object_v2_test"
const DefaultV2PrimaryKey = "object_id"

// V2FieldDef representeert een velddefinitie uit de template JSON
type V2FieldDef struct {
	Field             string `json:"field"`
	Label             string `json:"label"`
	Type              string `json:"type"`
	FullWidth         bool   `json:"full_width"`
	ParamValueIDField string `json:"param_value_id_field,omitempty"` // <- Toegevoegd voor rich_text dubbelklik
	CSS               string `json:"css,omitempty"`
}

func (a *App) V2_GenerateBookReport(rootObjectId string, templateId string) (string, error) {
	var config V2ReportConfig
	config.DataSource.ViewName = DefaultV2View
	config.DataSource.PrimaryKey = DefaultV2PrimaryKey

	// 1. Template config ophalen
	if templateId != "" {
		var rawConfig sql.NullString
		err := a.db.QueryRow(`SELECT config_json FROM templates WHERE id = ? AND deleted_at IS NULL`, templateId).Scan(&rawConfig)
		if err == nil && rawConfig.Valid && rawConfig.String != "" {
			_ = json.Unmarshal([]byte(rawConfig.String), &config)
		}
	}

	viewName := config.DataSource.ViewName
	pkCol := config.DataSource.PrimaryKey
	if viewName == "" {
		viewName = DefaultV2View
	}
	if pkCol == "" {
		pkCol = DefaultV2PrimaryKey
	}

	// 2. Bepaal maximale diepte (Standaard: 5, Absoluut Maximum: 10)
	maxDepth := config.GlobalSettings.MaxDepth
	if maxDepth <= 0 {
		maxDepth = 5
	}
	if maxDepth > 10 {
		maxDepth = 10
	}

	// 3. Gehele boomstructuur ophalen tot maxDepth
	nodeTree, err := a.v2FetchReportNodeRecursive(viewName, pkCol, rootObjectId, 1, maxDepth)
	if err != nil {
		return "", fmt.Errorf("v2 boom ophalen mislukt: %w", err)
	}

	// 4. Boekomslag header
	rootTitle := fmt.Sprintf("%v", nodeTree.Data["display_title"])
	if rootTitle == "" || rootTitle == "<nil>" {
		rootTitle = fmt.Sprintf("Rapport: %s", rootObjectId)
	}

	bookHeaderHTML := fmt.Sprintf(`
		<div class="v2-book-cover-header" style="border-bottom: 3px solid #0f172a; padding-bottom: 16px; margin-bottom: 32px;">
			<h1 style="font-size: 2.2rem; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; letter-spacing: -0.02em;">%s</h1>
			<div style="font-size: 0.85rem; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Systeem Rapportage</div>
		</div>
	`, html.EscapeString(rootTitle))

	// 5. TOC & Boom HTML genereren
	tocHTML := a.v2GenerateTOC(*nodeTree, config.GlobalSettings.TOC, config.Levels)

	initialPath := []PathNode{{Index: 1, Level: 1}}
	renderedHTML, err := a.v2RenderNodeRecursive(*nodeTree, viewName, config, initialPath)
	if err != nil {
		return "", fmt.Errorf("v2 boom HTML renderen mislukt: %w", err)
	}

	fullWrapper := fmt.Sprintf(`
		<div class="v2-report-container" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; max-width: 900px; margin: 0 auto; padding: 32px 20px;">
			%s
			%s
			%s
		</div>`, bookHeaderHTML, tocHTML, renderedHTML)

	return fullWrapper, nil
}

// v2RenderHTML genereert de HTML voor de v2-weergave
// v2RenderHTML genereert de HTML voor de v2-weergave
func (a *App) v2RenderHTML(viewName string, objectId string, dataMap map[string]any, fields []V2FieldDef) (string, error) {
	var htmlBuilder strings.Builder

	// Bepaal de titel voor de header
	displayTitle := fmt.Sprintf("%v", dataMap["display_title"])
	if displayTitle == "" || displayTitle == "<nil>" {
		displayTitle = fmt.Sprintf("Object: %s", objectId)
	}

	htmlBuilder.WriteString(fmt.Sprintf(`
	<div class="v2-report-wrapper" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px;">
		<header class="v2-report-header" style="border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 24px;">
			<h1 class="book-main-title editable-object-heading" data-object-id="%s" style="margin: 0 0 6px 0; font-size: 1.8rem; color: #0f172a; cursor: pointer;">%s</h1>
            <div style="font-size: 0.85rem; color: #64748b;">View: %s | ID: %s</div>
        </header>
        
        <table style="width: 100%%; border-collapse: collapse; margin-top: 12px;">
`,
		html.EscapeString(objectId),
		html.EscapeString(displayTitle),
		html.EscapeString(viewName),
		html.EscapeString(objectId),
	))

	// Fallback als er geen velden geconfigureerd zijn
	if len(fields) == 0 {
		for key := range dataMap {
			if key == "object_id" {
				continue
			}
			fields = append(fields, V2FieldDef{Field: key, Label: key})
		}
	}

	for _, fieldDef := range fields {
		val, exists := dataMap[fieldDef.Field]
		if !exists || val == nil {
			continue
		}

		valStr := fmt.Sprintf("%v", val)
		labelToShow := fieldDef.Label
		if strings.ToLower(labelToShow) == "none" {
			labelToShow = ""
		} else if labelToShow == "" {
			labelToShow = fieldDef.Field
		}

		// Bepaal de basisswitch voor relaties of rich_text
		isRelationList := fieldDef.Type == "relation_list" || strings.HasPrefix(strings.TrimSpace(valStr), "[")

		if isRelationList && valStr != "" && valStr != "<nil>" {
			var relations []map[string]any
			if err := json.Unmarshal([]byte(valStr), &relations); err == nil {
				if len(relations) == 0 {
					valStr = "<em style='color: #94a3b8;'>Geen gekoppelde objecten</em>"
				} else {
					var relHTML strings.Builder
					relHTML.WriteString("<ul style='margin: 0; padding-left: 18px; list-style-type: disc;'>")
					for _, rel := range relations {
						relHTML.WriteString(fmt.Sprintf(
							"<li style='margin-bottom: 4px;'><strong>%v</strong> — %v <code style='font-size:0.8rem; color:#64748b;'>(%v)</code></li>",
							html.EscapeString(fmt.Sprintf("%v", rel["relation_label"])),
							html.EscapeString(fmt.Sprintf("%v", rel["target_label"])),
							html.EscapeString(fmt.Sprintf("%v", rel["target_id"])),
						))
					}
					relHTML.WriteString("</ul>")
					valStr = relHTML.String()
				}
			}
		} else if fieldDef.Type == "rich_text" {
			var paramValueID string
			if fieldDef.ParamValueIDField != "" {
				if pvVal, ok := dataMap[fieldDef.ParamValueIDField]; ok && pvVal != nil {
					paramValueID = fmt.Sprintf("%v", pvVal)
				}
			}

			// Geef eventueel de aangepaste CSS-style mee aan de richtext container
			customStyle := "cursor: pointer;"
			if fieldDef.CSS != "" {
				customStyle = fmt.Sprintf("cursor: pointer; %s", fieldDef.CSS)
			}

			if paramValueID != "" {
				valStr = fmt.Sprintf(
					`<div class="editable-richtext" data-param-value-id="%s" data-object-id="%s" style="%s">%s</div>`,
					html.EscapeString(paramValueID),
					html.EscapeString(objectId),
					html.EscapeString(customStyle),
					valStr,
				)
			} else {
				valStr = fmt.Sprintf(`<div class="static-richtext" style="%s">%s</div>`, html.EscapeString(fieldDef.CSS), valStr)
			}
		} else {
			valStr = html.EscapeString(valStr)
		}

		// ---------------------------------------------------------------------
		// RENDERING: Integreer optionele `css` op de cel/container
		// ---------------------------------------------------------------------

		// Stel de basisstijl samen voor de inhoudscel
		cellBaseStyle := "padding: 12px 8px; color: #0f172a; font-size: 0.95rem; line-height: 1.5;"
		if fieldDef.CSS != "" && fieldDef.Type != "rich_text" {
			cellBaseStyle = fmt.Sprintf("%s %s", cellBaseStyle, fieldDef.CSS)
		}

		if fieldDef.FullWidth {
			if strings.ToLower(fieldDef.Label) == "none" {
				htmlBuilder.WriteString(fmt.Sprintf(`
				<tr style="border-bottom: 1px solid #e2e8f0;">
					<td colspan="2" style="%s">%s</td>
				</tr>`, cellBaseStyle, valStr))
			} else {
				htmlBuilder.WriteString(fmt.Sprintf(`
				<tr style="border-bottom: 1px solid #e2e8f0;">
					<td colspan="2" style="padding: 12px 8px;">
						<div style="font-weight: 600; color: #334155; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">%s</div>
						<div style="%s">%s</div>
					</td>
				</tr>`, html.EscapeString(labelToShow), cellBaseStyle, valStr))
			}
		} else {
			htmlBuilder.WriteString(fmt.Sprintf(`
			<tr style="border-bottom: 1px solid #e2e8f0; vertical-align: top;">
				<td style="padding: 12px 8px; font-weight: 600; width: 28%%; color: #334155; font-size: 0.95rem;">%s</td>
				<td style="%s">%s</td>
			</tr>`, html.EscapeString(labelToShow), cellBaseStyle, valStr))
		}
	}
	htmlBuilder.WriteString(`</table></div>`)
	return htmlBuilder.String(), nil
}

// v2FetchObjectMap leest een willekeurige rij uit een view/tabel in als map[string]any
func (a *App) v2FetchObjectMap(viewName string, primaryKeyCol string, objectId string) (map[string]any, error) {
	query := fmt.Sprintf("SELECT * FROM %s WHERE %s = ? LIMIT 1", viewName, primaryKeyCol)
	rows, err := a.db.Query(query, objectId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	if !rows.Next() {
		return nil, fmt.Errorf("geen data gevonden in %s voor %s = %s", viewName, primaryKeyCol, objectId)
	}

	// Dynamische pointers voor Scan
	values := make([]any, len(cols))
	valuePtrs := make([]any, len(cols))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	if err := rows.Scan(valuePtrs...); err != nil {
		return nil, err
	}

	result := make(map[string]any)
	for i, col := range cols {
		val := values[i]
		if b, ok := val.([]byte); ok {
			result[col] = string(b)
		} else {
			result[col] = val
		}
	}

	return result, nil
}

// V2ReportNode stelt een knoop in de V2 rapportageboom voor
type V2ReportNode struct {
	ObjectID string         `json:"objectId"`
	Level    int            `json:"level"`
	Data     map[string]any `json:"data"`
	Children []V2ReportNode `json:"children,omitempty"`
}

// v2FetchReportNodeRecursive haalt de view-data op voor het huidige object en bouwt recursief de kinderen op
func (a *App) v2FetchReportNodeRecursive(viewName string, primaryKeyCol string, objectId string, currentDepth int, maxDepth int) (*V2ReportNode, error) {
	// 1. Haal de platte map[string]any op voor dit specifieke object
	dataMap, err := a.v2FetchObjectMap(viewName, primaryKeyCol, objectId)
	if err != nil {
		return nil, fmt.Errorf("fout bij ophalen V2 data voor %s: %w", objectId, err)
	}

	node := &V2ReportNode{
		ObjectID: objectId,
		Level:    currentDepth,
		Data:     dataMap,
		Children: []V2ReportNode{},
	}

	// 2. Stop als de maximale diepte is bereikt
	if currentDepth >= maxDepth {
		return node, nil
	}

	// 3. Lees de uitgaande_relaties kolom uit de dataMap
	rawRel, exists := dataMap["uitgaande_relaties"]
	if !exists || rawRel == nil {
		return node, nil
	}

	relStr := fmt.Sprintf("%v", rawRel)
	if strings.TrimSpace(relStr) == "" || relStr == "<nil>" {
		return node, nil
	}

	// 4. Parse de JSON array van uitgaande relaties
	var relations []map[string]any
	if err := json.Unmarshal([]byte(relStr), &relations); err != nil {
		// Als de view geen geldige JSON levert voor relaties, negeren we de kinderen stilzwijgend
		return node, nil
	}

	// 5. Haal voor elk gekoppeld target_id recursief de kind-node op
	for _, rel := range relations {
		targetID, ok := rel["target_id"].(string)
		if !ok || strings.TrimSpace(targetID) == "" {
			continue
		}

		childNode, err := a.v2FetchReportNodeRecursive(viewName, primaryKeyCol, targetID, currentDepth+1, maxDepth)
		if err == nil && childNode != nil {
			node.Children = append(node.Children, *childNode)
		}
	}

	return node, nil
}

// v2RenderNodeRecursive bouwt recursief de HTML op voor een knoop en al zijn kinderen
func (a *App) v2RenderNodeRecursive(node V2ReportNode, viewName string, config V2ReportConfig, path []PathNode) (string, error) {
	var htmlBuilder strings.Builder

	levelStr := fmt.Sprintf("%d", node.Level)
	levelCfg, hasLevelCfg := config.Levels[levelStr]

	// Velden bepalen
	activeFields := config.Fields
	if hasLevelCfg && len(levelCfg.Fields) > 0 {
		activeFields = levelCfg.Fields
	}

	// Styling bepalen
	headerCSS := getHeaderCSSForLevel(node.Level)
	if hasLevelCfg && levelCfg.HeaderCSS != "" {
		headerCSS = levelCfg.HeaderCSS
	}

	// Nummering prefix opbouwen
	numberPrefix := formatHierarchyNumber(path, config.Levels)

	displayTitle := fmt.Sprintf("%v", node.Data["display_title"])
	if displayTitle == "" || displayTitle == "<nil>" {
		displayTitle = fmt.Sprintf("Object: %s", node.ObjectID)
	}
	fullTitle := numberPrefix + displayTitle

	headerTag := getHeaderTagLevel(node.Level)

	htmlBuilder.WriteString(fmt.Sprintf(`
	<div class="v2-node-wrapper level-%d" style="margin-bottom: 36px;">
		<header class="v2-report-header" style="margin-bottom: 16px;">
			<h%d id="node-%s" class="book-main-title editable-object-heading" data-object-id="%s" style="margin: 0 0 4px 0; cursor: pointer; %s">%s</h%d>
			<div style="font-size: 0.8rem; color: #64748b;">Niveau %d | ID: %s</div>
		</header>
		
		<table style="width: 100%%; border-collapse: collapse; margin-top: 8px;">
`,
		node.Level,
		headerTag,
		html.EscapeString(node.ObjectID),
		html.EscapeString(node.ObjectID),
		headerCSS,
		html.EscapeString(fullTitle),
		headerTag,
		node.Level,
		html.EscapeString(node.ObjectID),
	))

	fieldsHTML := a.renderFieldsHTML(node.ObjectID, node.Data, activeFields)
	htmlBuilder.WriteString(fieldsHTML)
	htmlBuilder.WriteString(`</table></div>`)

	// Kinderen recursief verwerken met uitgebreid pad
	for i, child := range node.Children {
		childPath := append(append([]PathNode{}, path...), PathNode{Index: i + 1, Level: child.Level})
		childHTML, err := a.v2RenderNodeRecursive(child, viewName, config, childPath)
		if err == nil {
			htmlBuilder.WriteString(childHTML)
		}
	}

	return htmlBuilder.String(), nil
}

// Hulpmethodes voor opmaak per niveau
// Helper om HTML header tag te bepalen (h1 t/m h6)
func getHeaderTagLevel(level int) int {
	if level >= 6 {
		return 6
	}
	return level
}

// // Helper om de lettergrootte van de kop subtiel te laten schalen per niveau
// func getHeaderFontSize(level int) string {
// 	switch level {
// 	case 1:
// 		return "1.8rem"
// 	case 2:
// 		return "1.5rem"
// 	case 3:
// 		return "1.25rem"
// 	case 4:
// 		return "1.1rem"
// 	case 5:
// 		return "1.0rem"
// 	default: // Niveau 6 t/m 10
// 		return "0.9rem"
// 	}
// }

// Helper voor standaard CSS van de koppen als er geen custom header_css in de template staat
func getHeaderCSSForLevel(level int) string {
	switch level {
	case 1:
		return "font-size: 1.8rem; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 6px;"
	case 2:
		return "font-size: 1.5rem; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;"
	case 3:
		return "font-size: 1.25rem; color: #334155;"
	case 4:
		return "font-size: 1.1rem; color: #475569;"
	case 5:
		return "font-size: 1.0rem; color: #64748b;"
	default:
		return "font-size: 0.9rem; color: #64748b;"
	}
}

func getBorderForLevel(level int) string {
	if level == 1 {
		return "none"
	}
	return "3px solid #cbd5e1; padding-left: 16px" // Lichte kantlijn voor sub-niveaus
}

func (a *App) renderFieldsHTML(objectId string, dataMap map[string]any, fields []V2FieldDef) string {
	var htmlBuilder strings.Builder

	// Fallback als er geen velden geconfigureerd zijn
	if len(fields) == 0 {
		for key := range dataMap {
			if key == "object_id" || key == "uitgaande_relaties" {
				continue
			}
			fields = append(fields, V2FieldDef{Field: key, Label: key})
		}
	}

	for _, fieldDef := range fields {
		val, exists := dataMap[fieldDef.Field]
		if !exists || val == nil {
			continue
		}

		valStr := fmt.Sprintf("%v", val)
		labelToShow := fieldDef.Label
		if strings.ToLower(labelToShow) == "none" {
			labelToShow = ""
		} else if labelToShow == "" {
			labelToShow = fieldDef.Field
		}

		isRelationList := fieldDef.Type == "relation_list" || strings.HasPrefix(strings.TrimSpace(valStr), "[")

		if isRelationList && valStr != "" && valStr != "<nil>" {
			var relations []map[string]any
			if err := json.Unmarshal([]byte(valStr), &relations); err == nil {
				if len(relations) == 0 {
					valStr = "<em style='color: #94a3b8;'>Geen gekoppelde objecten</em>"
				} else {
					var relHTML strings.Builder
					relHTML.WriteString("<ul style='margin: 0; padding-left: 18px; list-style-type: disc;'>")
					for _, rel := range relations {
						relHTML.WriteString(fmt.Sprintf(
							"<li style='margin-bottom: 4px;'><strong>%v</strong> — %v <code style='font-size:0.8rem; color:#64748b;'>(%v)</code></li>",
							html.EscapeString(fmt.Sprintf("%v", rel["relation_label"])),
							html.EscapeString(fmt.Sprintf("%v", rel["target_label"])),
							html.EscapeString(fmt.Sprintf("%v", rel["target_id"])),
						))
					}
					relHTML.WriteString("</ul>")
					valStr = relHTML.String()
				}
			}
		} else if fieldDef.Type == "rich_text" {
			var paramValueID string
			if fieldDef.ParamValueIDField != "" {
				if pvVal, ok := dataMap[fieldDef.ParamValueIDField]; ok && pvVal != nil {
					paramValueID = fmt.Sprintf("%v", pvVal)
				}
			}

			customStyle := "cursor: pointer;"
			if fieldDef.CSS != "" {
				customStyle = fmt.Sprintf("cursor: pointer; %s", fieldDef.CSS)
			}

			if paramValueID != "" {
				valStr = fmt.Sprintf(
					`<div class="editable-richtext" data-param-value-id="%s" data-object-id="%s" style="%s">%s</div>`,
					html.EscapeString(paramValueID),
					html.EscapeString(objectId),
					html.EscapeString(customStyle),
					valStr,
				)
			} else {
				valStr = fmt.Sprintf(`<div class="static-richtext" style="%s">%s</div>`, html.EscapeString(fieldDef.CSS), valStr)
			}
		} else {
			valStr = html.EscapeString(valStr)
		}

		cellBaseStyle := "padding: 8px; color: #0f172a; font-size: 0.95rem; line-height: 1.5;"
		if fieldDef.CSS != "" && fieldDef.Type != "rich_text" {
			cellBaseStyle = fmt.Sprintf("%s %s", cellBaseStyle, fieldDef.CSS)
		}

		if fieldDef.FullWidth {
			if strings.ToLower(fieldDef.Label) == "none" {
				htmlBuilder.WriteString(fmt.Sprintf(`
					<tr style="border-bottom: 1px solid #e2e8f0;">
						<td colspan="2" style="%s">%s</td>
					</tr>`, cellBaseStyle, valStr))
			} else {
				htmlBuilder.WriteString(fmt.Sprintf(`
					<tr style="border-bottom: 1px solid #e2e8f0;">
						<td colspan="2" style="padding: 8px;">
							<div style="font-weight: 600; color: #334155; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">%s</div>
							<div style="%s">%s</div>
						</td>
					</tr>`, html.EscapeString(labelToShow), cellBaseStyle, valStr))
			}
		} else {
			htmlBuilder.WriteString(fmt.Sprintf(`
				<tr style="border-bottom: 1px solid #e2e8f0; vertical-align: top;">
					<td style="padding: 8px; font-weight: 600; width: 28%%; color: #334155; font-size: 0.9rem;">%s</td>
					<td style="%s">%s</td>
				</tr>`, html.EscapeString(labelToShow), cellBaseStyle, valStr))
		}
	}

	return htmlBuilder.String()
}

// v2GenerateTOC bouwt recursief de HTML-inhoudsopgave op
func (a *App) v2GenerateTOC(node V2ReportNode, config TOCConfig, levels map[string]LevelConfig) string {
	if !config.Enabled {
		return ""
	}

	title := config.Title
	if strings.TrimSpace(title) == "" {
		title = "Inhoudsopgave"
	}

	maxDepth := config.MaxDepth
	if maxDepth <= 0 {
		maxDepth = 2 // Standaard fallback als niet opgegeven
	}

	var tocBuilder strings.Builder
	tocBuilder.WriteString(fmt.Sprintf(`
		<nav class="v2-toc-container" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px 24px; margin-bottom: 32px;">
			<h2 style="margin-top: 0; margin-bottom: 12px; font-size: 1.25rem; color: #1e293b;">%s</h2>
			<ul style="list-style-type: none; padding-left: 0; margin: 0;">
	`, html.EscapeString(title)))

	initialPath := []PathNode{{Index: 1, Level: 1}}
	a.v2BuildTOCItems(node, 1, maxDepth, initialPath, config, levels, &tocBuilder)

	tocBuilder.WriteString(`</ul></nav>`)
	return tocBuilder.String()
}

// v2BuildTOCItems helpt recursief bij het toevoegen van regels in de TOC
func (a *App) v2BuildTOCItems(node V2ReportNode, currentDepth int, maxDepth int, path []PathNode, config TOCConfig, levels map[string]LevelConfig, builder *strings.Builder) {
	if currentDepth > maxDepth {
		return
	}

	displayTitle := fmt.Sprintf("%v", node.Data["display_title"])
	if displayTitle == "" || displayTitle == "<nil>" {
		displayTitle = fmt.Sprintf("Object: %s", node.ObjectID)
	}

	// Nummering ophalen indien gewenst
	numberPrefix := ""
	if config.IncludeNumbering {
		numberPrefix = formatHierarchyNumber(path, levels)
	}

	fullTitle := numberPrefix + displayTitle
	indentPx := (currentDepth - 1) * 16

	builder.WriteString(fmt.Sprintf(`
		<li style="margin-bottom: 6px; padding-left: %dpx;">
			<a href="#node-%s" style="color: #2563eb; text-decoration: none; font-size: 0.95rem;">%s</a>
		</li>
	`, indentPx, html.EscapeString(node.ObjectID), html.EscapeString(fullTitle)))

	for i, child := range node.Children {
		childPath := append(append([]PathNode{}, path...), PathNode{Index: i + 1, Level: child.Level})
		a.v2BuildTOCItems(child, currentDepth+1, maxDepth, childPath, config, levels, builder)
	}
}
func formatSegment(num int, style string) string {
	switch style {
	case "alpha_upper":
		return string(rune('A' + (num-1)%26))
	case "alpha_lower":
		return string(rune('a' + (num-1)%26))
	case "roman_upper":
		return toRoman(num)
	case "roman_lower":
		return strings.ToLower(toRoman(num))
	case "none":
		return ""
	default: // "numeric"
		return fmt.Sprintf("%d", num)
	}
}

func toRoman(number int) string {
	maximalDict := []struct {
		value  int
		symbol string
	}{
		{1000, "M"}, {900, "CM"}, {500, "D"}, {400, "CD"},
		{100, "C"}, {90, "XC"}, {50, "L"}, {40, "XL"},
		{10, "X"}, {9, "IX"}, {5, "V"}, {4, "IV"}, {1, "I"},
	}
	roman := ""
	for _, item := range maximalDict {
		for number >= item.value {
			roman += item.symbol
			number -= item.value
		}
	}
	return roman
}

type PathNode struct {
	Index int
	Level int
}

func formatHierarchyNumber(path []PathNode, levels map[string]LevelConfig) string {
	if len(path) == 0 {
		return ""
	}

	currentLevel := path[len(path)-1].Level
	currentLevelStr := fmt.Sprintf("%d", currentLevel)
	currentCfg, hasCurrentCfg := levels[currentLevelStr]

	// Check inherit_parent (default is true)
	inheritParent := true
	if hasCurrentCfg && currentCfg.InheritParent != nil {
		inheritParent = *currentCfg.InheritParent
	}

	currentStyle := "numeric"
	if hasCurrentCfg && currentCfg.NumberingStyle != "" {
		currentStyle = currentCfg.NumberingStyle
	}

	if currentStyle == "none" {
		return ""
	}

	// Als er niet overgeërfd wordt, tonen we alleen het eigen segment (bijv. "a.")
	if !inheritParent {
		segment := formatSegment(path[len(path)-1].Index, currentStyle)
		if segment == "" {
			return ""
		}
		return segment + ". "
	}

	// Wel overerving: bouw het volledige pad op (bijv. "1.1.a")
	var parts []string
	for _, p := range path {
		lvlStr := fmt.Sprintf("%d", p.Level)
		cfg, hasCfg := levels[lvlStr]

		style := "numeric"
		if hasCfg && cfg.NumberingStyle != "" {
			style = cfg.NumberingStyle
		}

		if style != "none" {
			seg := formatSegment(p.Index, style)
			if seg != "" {
				parts = append(parts, seg)
			}
		}
	}

	if len(parts) == 0 {
		return ""
	}

	return strings.Join(parts, ".") + " "
}
