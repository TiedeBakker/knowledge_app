//src/modules/reporting/exporter.go
package report

import (
	"knowledge-app"
)

// PDFExporter is de interface waar alle PDF-engines aan moeten voldoen
type PDFExporter interface {
	GenerateReportPDF(tree *models.ReportTreeNode, template *models.ReportTemplate, outputPath string) error
}