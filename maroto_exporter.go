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
	m.collectTOCItems(tree, 0, []int{}, &tocItems)

	// 2. Genereer het Inhoudsopgave-blok vooraan in het document
	if len(tocItems) > 0 {
		m.renderTableOfContents(marotoDoc, tocItems)
	}

	// 3. Recursief de boom doorlopen en de hoofdinhoud toevoegen
	m.appendNode(marotoDoc, tree, template, 0, []int{})

	document, err := marotoDoc.Generate()
	if err != nil {
		return fmt.Errorf("fout bij genereren maroto document: %w", err)
	}

	if err := document.Save(outputPath); err != nil {
		return fmt.Errorf("fout bij opslaan PDF: %w", err)
	}

	return nil
}

// collectTOCItems bouwt de lijst van koppen op zonder het PDF-document nog te vullen
func (m *MarotoExporter) collectTOCItems(node *ReportTreeNode, level int, indices []int, items *[]TOCItem) {
	if node == nil {
		return
	}

	// Indexering bepalen
	if len(indices) <= level {
		for len(indices) <= level {
			indices = append(indices, 0)
		}
	} else {
		indices = indices[:level+1]
	}
	indices[level]++

	var numberParts []string
	for _, num := range indices {
		numberParts = append(numberParts, fmt.Sprintf("%d", num))
	}
	sectionNumber := strings.Join(numberParts, ".")

	if node.Object.Label != "" {
		*items = append(*items, TOCItem{
			Number: sectionNumber,
			Title:  node.Object.Label,
			Level:  level,
		})
	}

	for _, child := range node.Children {
		childIndices := make([]int, len(indices))
		copy(childIndices, indices)
		m.collectTOCItems(child, level+1, childIndices, items)
	}
}

// renderTableOfContents tekent de Inhoudsopgave bovenaan het document
func (m *MarotoExporter) renderTableOfContents(doc core.Maroto, items []TOCItem) {
	// Kop van de Inhoudsopgave
	doc.AddRows(
		row.New(12).Add(
			text.NewCol(12, "Inhoudsopgave", props.Text{
				Size:  16.0,
				Style: fontstyle.Bold,
				Align: align.Left,
			}),
		),
	)

	// Elk item in de inhoudsopgave weergaven met inspringing per level
	for _, item := range items {
		// Inspringing/Indentatie op basis van niveau
		indent := strings.Repeat("  ", item.Level*2)
		label := fmt.Sprintf("%s%s %s", indent, item.Number, item.Title)

		// Stijl variëren op basis van niveau (H1 is vetgedrukt)
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

	// Scheidingslijn onder de inhoudsopgave en een kleine witruimte
	doc.AddRows(
		row.New(4).Add(
			line.NewCol(12),
		),
		row.New(8), // Lege rij voor extra afstandsruimte tot de hoofdinhoud
	)
}

func (m *MarotoExporter) appendNode(doc core.Maroto, node *ReportTreeNode, template *ReportTemplate, level int, indices []int) {
	if node == nil {
		return
	}

	// 1. Nummering opbouwen
	if len(indices) <= level {
		for len(indices) <= level {
			indices = append(indices, 0)
		}
	} else {
		indices = indices[:level+1]
	}

	indices[level]++

	var numberParts []string
	for _, num := range indices {
		numberParts = append(numberParts, fmt.Sprintf("%d", num))
	}
	sectionNumber := strings.Join(numberParts, ".")
	displayTitle := fmt.Sprintf("%s %s", sectionNumber, node.Object.Label)

	// 2. Lettergrootte bepalen
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

	// 3. Titel toevoegen
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

	// 4. Content / Toelichting toevoegen
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

	// 5. Children toevoegen
	for _, child := range node.Children {
		childIndices := make([]int, len(indices))
		copy(childIndices, indices)
		m.appendNode(doc, child, template, level+1, childIndices)
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
	r := strings.NewReplacer("<p>", "", "</p>", "\n", "<br>", "\n", "<br/>", "\n")
	res := r.Replace(input)

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