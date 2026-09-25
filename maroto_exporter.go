package main

import (
	"fmt"
	"strings"

	"github.com/johnfercher/maroto/v2"
	"github.com/johnfercher/maroto/v2/pkg/components/line"
	"github.com/johnfercher/maroto/v2/pkg/components/row"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	"github.com/johnfercher/maroto/v2/pkg/config"
	"github.com/johnfercher/maroto/v2/pkg/consts/align"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/core"
	"github.com/johnfercher/maroto/v2/pkg/props"
)

type TOCItem struct {
	Number string
	Title  string
	Level  int
}

type MarotoExporter struct{}

func NewMarotoExporter() *MarotoExporter {
	return &MarotoExporter{}
}

func (m *MarotoExporter) GenerateReportPDF(tree *ReportTreeNode, template *ReportTemplate, outputPath string) error {
	cfg := config.NewBuilder().
		WithPageNumber().
		WithLeftMargin(15).
		WithRightMargin(15).
		WithTopMargin(15).
		WithBottomMargin(15).
		Build()

	marotoDoc := maroto.New(cfg)

	// 1. Verzamel eerst alle koppen voor de Inhoudsopgave
	var tocItems []TOCItem
	
	// Als de root zelf een virtuele container is (geen label), verwerken we alleen de kinderen op niveau 0
	if tree != nil {
		if tree.Object.Label == "" {
			for i, child := range tree.Children {
				m.collectTOCItems(child, 0, fmt.Sprintf("%d", i+1), &tocItems)
			}
		} else {
			m.collectTOCItems(tree, 0, "1", &tocItems)
		}
	}

	// 2. Genereer de Inhoudsopgave
	if len(tocItems) > 0 {
		m.renderTableOfContents(marotoDoc, tocItems)
	}

	// 3. Hoofdinhoud toevoegen
	if tree != nil {
		if tree.Object.Label == "" {
			for i, child := range tree.Children {
				m.appendNode(marotoDoc, child, template, 0, fmt.Sprintf("%d", i+1))
			}
		} else {
			m.appendNode(marotoDoc, tree, template, 0, "1")
		}
	}

	document, err := marotoDoc.Generate()
	if err != nil {
		return fmt.Errorf("fout bij genereren maroto document: %w", err)
	}

	if err := document.Save(outputPath); err != nil {
		return fmt.Errorf("fout bij opslaan PDF: %w", err)
	}

	return nil
}

func (m *MarotoExporter) collectTOCItems(node *ReportTreeNode, level int, numberPrefix string, items *[]TOCItem) {
	if node == nil {
		return
	}

	if node.Object.Label != "" {
		*items = append(*items, TOCItem{
			Number: numberPrefix,
			Title:  node.Object.Label,
			Level:  level,
		})
	}

	// Geef elk kind een uniek volgnummer op basis van de index in de Children-array
	for i, child := range node.Children {
		childNumber := fmt.Sprintf("%s.%d", numberPrefix, i+1)
		m.collectTOCItems(child, level+1, childNumber, items)
	}
}

func (m *MarotoExporter) renderTableOfContents(doc core.Maroto, items []TOCItem) {
	doc.AddRows(
		row.New(12).Add(
			text.NewCol(12, "Inhoudsopgave", props.Text{
				Size:  16.0,
				Style: fontstyle.Bold,
				Align: align.Left,
			}),
		),
	)

	for _, item := range items {
		indent := strings.Repeat("  ", item.Level*2)
		label := fmt.Sprintf("%s%s %s", indent, item.Number, item.Title)

		style := fontstyle.Normal
		if item.Level == 0 {
			style = fontstyle.Bold
		}

		doc.AddRows(
			row.New(6).Add(
				text.NewCol(12, label, props.Text{
					Size:  10.0,
					Style: style,
					Align: align.Left,
				}),
			),
		)
	}

	doc.AddRows(
		row.New(4).Add(
			line.NewCol(12),
		),
		row.New(8),
	)
}

func (m *MarotoExporter) appendNode(doc core.Maroto, node *ReportTreeNode, template *ReportTemplate, level int, numberPrefix string) {
	if node == nil {
		return
	}

	displayTitle := fmt.Sprintf("%s %s", numberPrefix, node.Object.Label)

	fontSize := 12.0
	if template != nil {
		for _, rule := range template.HierarchyRules {
			if rule.Level == level {
				fontSize = float64(rule.FontSize)
				break
			}
		}
	} else {
		switch level {
		case 0:
			fontSize = 18.0
		case 1:
			fontSize = 14.0
		default:
			fontSize = 11.0
		}
	}

	// Kop toevoegen
	if node.Object.Label != "" {
		titleHeight := calculateRowHeight(displayTitle, fontSize, 10.0)
		doc.AddRows(
			row.New(titleHeight).Add(
				text.NewCol(12, displayTitle, props.Text{
					Size:  fontSize,
					Style: fontstyle.Bold,
					Align: align.Left,
				}),
			),
		)
	}

	// Content / Toelichting toevoegen
	targetKey := "toelichting"
	if template != nil && template.ContentParameterCode != "" {
		targetKey = strings.ToLower(template.ContentParameterCode)
	}

	var content string
	for _, p := range node.Parameters {
		if strings.ToLower(p.ParameterCode) == targetKey || strings.ToLower(p.ParameterLabel) == targetKey {
			content = p.Value
			break
		}
	}

	if content != "" {
		cleanText := stripHTML(content)
		if cleanText != "" {
			contentFontSize := 10.0
			contentHeight := calculateRowHeight(cleanText, contentFontSize, 8.0)

			doc.AddRows(
				row.New(contentHeight).Add(
					text.NewCol(12, cleanText, props.Text{
						Size:  contentFontSize,
						Align: align.Left,
					}),
				),
			)
		}
	}

	// Kinderen verwerken met de expliciete string-prefix (bijv. "1.1", "1.2", etc.)
	for i, child := range node.Children {
		childNumber := fmt.Sprintf("%s.%d", numberPrefix, i+1)
		m.appendNode(doc, child, template, level+1, childNumber)
	}
}

func calculateRowHeight(txt string, fontSize float64, minHeight float64) float64 {
	if txt == "" {
		return minHeight
	}

	charsPerLine := int(85.0 * (10.0 / fontSize))
	if charsPerLine < 20 {
		charsPerLine = 20
	}

	linesByLength := (len(txt) / charsPerLine) + 1
	linesByNewline := strings.Count(txt, "\n") + 1

	totalLines := linesByLength
	if linesByNewline > totalLines {
		totalLines = linesByNewline
	}

	lineHeightMm := fontSize * 0.42
	calculatedHeight := float64(totalLines) * lineHeightMm

	if calculatedHeight < minHeight {
		return minHeight
	}

	return calculatedHeight
}

func stripHTML(input string) string {
	r := strings.ReplaceAll(input, "<p>", "")
	r = strings.ReplaceAll(r, "</p>", "\n")
	r = strings.ReplaceAll(r, "<br>", "\n")
	r = strings.ReplaceAll(r, "<br/>", "\n")

	var result strings.Builder
	inTag := false
	for _, char := range r {
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