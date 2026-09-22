// src/modules/reporting/puppeteer_exporter.go
package report

import (
	"fmt"
	"os"
	"os/exec"
	"knowledge-app"
)

type PuppeteerExporter struct {
	NodeScriptPath string
}

func NewPuppeteerExporter(scriptPath string) *PuppeteerExporter {
	return &PuppeteerExporter{NodeScriptPath: scriptPath}
}

func (p *PuppeteerExporter) GenerateReportPDF(tree *models.ReportTreeNode, template *models.ReportTemplate, outputPath string) error {
	// 1. Genereer een tijdelijk HTML-bestand op basis van de tree (CSS Paged Media opgemaakt)
	tempHTMLPath := outputPath + ".tmp.html"
	htmlContent := renderTreeToHTML(tree, template)
	
	if err := os.WriteFile(tempHTMLPath, []byte(htmlContent), 0644); err != nil {
		return fmt.Errorf("kan temp HTML niet opslaan: %w", err)
	}
	defer os.Remove(tempHTMLPath) // Netjes opruimen

	// 2. Roep de Puppeteer CLI/Node-script aan
	cmd := exec.Command("node", p.NodeScriptPath, tempHTMLPath, outputPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("puppeteer fout: %s (%w)", string(output), err)
	}

	return nil
}

func renderTreeToHTML(tree *models.ReportTreeNode, template *models.ReportTemplate) string {
	// Hier genereer je de volledige HTML pagina inclusief <style> met @page regels
	return "<html><body>...</body></html>"
}