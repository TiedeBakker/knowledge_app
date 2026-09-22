// src/modules/reporting/maroto_exporter.go
package report

import (
	"fmt"
	"strings"


	"github.com/johnfercher/maroto/v2/pkg/consts/align"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/core"

	"github.com/johnfercher/maroto/v2"
    "github.com/johnfercher/maroto/v2/pkg/components/text"
    "github.com/johnfercher/maroto/v2/pkg/config"
    "github.com/johnfercher/maroto/v2/pkg/props"
	
	"knowledge-app"
)

type MarotoExporter struct{}

func NewMarotoExporter() *MarotoExporter {
	return &MarotoExporter{}
}

func (m *MarotoExporter) GenerateReportPDF(tree *models.ReportTreeNode, template *models.ReportTemplate, outputPath string) error {
	cfg := config.NewBuilder().
		WithPageNumber().
		WithLeftMargin(15).
		WithRightMargin(15).
		WithTopMargin(15).
		WithBottomMargin(15).
		Build()

	marotoDoc := maroto.NewMaroto(cfg)

	// Recursief de boom doorlopen en toevoegen aan het document
	m.appendNode(marotoDoc, tree, template, 0)

	document, err := marotoDoc.Generate()
	if err != nil {
		return fmt.Errorf("fout bij genereren maroto document: %w", err)
	}

	if err := document.Save(outputPath); err != nil {
		return fmt.Errorf("fout bij opslaan PDF: %w", err)
	}

	return nil
}

func (m *MarotoExporter) appendNode(doc core.Maroto, node *models.ReportTreeNode, template *models.ReportTemplate, level int) {
	if node == nil {
		return
	}

	// 1. Bepaal regel/lettergrootte op basis van niveau
	fontSize := 12.0
	if template != nil {
		for _, rule := range template.HierarchyRules {
			if rule.Level == level {
				fontSize = float64(rule.FontSize)
				break
			}
		}
	}

	// 2. Titel van het object toevoegen
	doc.AddRows(
		text.NewRow(10, node.Object.Label, 
			text.WithFontSize(fontSize), 
			text.WithStyle(fontstyle.Bold),
			text.WithAlign(align.Left),
		),
	)

	// 3. Toelichting (RichText) ophalen en HTML-tags vereenvoudigen voor platte tekst
	targetKey := strings.ToLower(template.ContentParameterCode)
	var content string
	for _, p := range node.Parameters {
		if strings.ToLower(p.ParameterCode) == targetKey || strings.ToLower(p.ParameterLabel) == targetKey {
			content = p.Value
			break
		}
	}

	if content != funcCleanHTML(content); content != "" {
		// Eenvoudige omzetting van HTML naar tekst voor de Maroto-preview
		cleanText := stripHTML(content)
		doc.AddRows(
			text.NewRow(8, cleanText, text.WithFontSize(10.0)),
		)
	}

	// 4. Kind-nodes recursief toevoegen
	for _, child := range node.Children {
		m.appendNode(doc, child, template, level+1)
	}
}

// Hulpmiddeltje om HTML te strippen voor Maroto
func stripHTML(input string) string {
	// Eenvoudige vervanging van alinea's en breken
	r := strings.NewReplacer("<p>", "", "</p>", "\n", "<br>", "\n", "<br/>", "\n")
	res := r.Replace(input)
	
	// Verwijder overige HTML-tags
	var result strings.Builder
	inTag := false
	for _, char := range res {
		if char == '<' {
			inTag = true
		} else if char == '>' {
			inTag = false
		} else if !inTag {
			result.WriteRune(char)
		}
	}
	return strings.TrimSpace(result.String())
}