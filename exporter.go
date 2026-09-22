package main

// PDFExporter is de interface waar alle PDF-engines aan moeten voldoen
type PDFExporter interface {
	GenerateReportPDF(tree *ReportTreeNode, template *ReportTemplate, outputPath string) error
}