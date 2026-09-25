// export_service.go
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ExportBookReportToHTML opent een SaveFileDialog en slaat het rapport op als zelfstandig HTML-bestand
func (a *App) ExportBookReportToHTML(rootID string, maxDepth int, templateID string) (string, error) {
	reportHTML, err := a.GenerateBookReport(rootID, maxDepth, templateID)
	if err != nil {
		return "", fmt.Errorf("fout bij genereren rapport: %w", err)
	}

	fullDocumentHTML := wrapInFullHTMLDocument(reportHTML)

	defaultFileName := fmt.Sprintf("Rapport_%s_%s.html", rootID, time.Now().Format("20060102_1504"))
	savePath, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Sla HTML-rapport op",
		DefaultFilename: defaultFileName,
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "HTML Bestanden (*.html)", Pattern: "*.html"},
		},
	})

	if err != nil || savePath == "" {
		return "", fmt.Errorf("export geannuleerd door gebruiker")
	}

	err = os.WriteFile(savePath, []byte(fullDocumentHTML), 0644)
	if err != nil {
		return "", fmt.Errorf("fout bij wegschrijven HTML bestand: %w", err)
	}

	return savePath, nil
}

// ExportBookReportToPDF genereert via Puppeteer/Chromium een A4 PDF-bestand
func (a *App) ExportBookReportToPDF(rootID string, maxDepth int, templateID string) (string, error) {
	defaultFileName := fmt.Sprintf("Rapport_%s_%s.pdf", rootID, time.Now().Format("20060102_1504"))
	targetPDFPath, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Sla PDF-rapport op",
		DefaultFilename: defaultFileName,
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "PDF Documenten (*.pdf)", Pattern: "*.pdf"},
		},
	})

	if err != nil || targetPDFPath == "" {
		return "", fmt.Errorf("export geannuleerd door gebruiker")
	}

	tempDir := os.TempDir()
	tempHTMLPath := filepath.Join(tempDir, fmt.Sprintf("temp_report_%d.html", time.Now().UnixNano()))
	defer os.Remove(tempHTMLPath)

	reportHTML, err := a.GenerateBookReport(rootID, maxDepth, templateID)
	if err != nil {
		return "", fmt.Errorf("fout bij genereren rapport: %w", err)
	}

	fullHTML := wrapInFullHTMLDocument(reportHTML)
	if err := os.WriteFile(tempHTMLPath, []byte(fullHTML), 0644); err != nil {
		return "", fmt.Errorf("fout bij maken tijdelijke HTML: %w", err)
	}

	// -------------------------------------------------------------------
	// DYNAMISCHE DETECTIE: Standalone Executable vs. Development Mode
	// -------------------------------------------------------------------
	exePath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("kan applicatiemap niet bepalen: %w", err)
	}
	appDir := filepath.Dir(exePath)

	var cmd *exec.Cmd

	// Optie 1: Volledig gecompileerde standalone render-pdf.exe aanwezig?
	standaloneExe := filepath.Join(appDir, "render-pdf.exe")

	// Optie 2: Portable node-runner met gebundeld script aanwezig?
	portableRunner := filepath.Join(appDir, "node-runner.exe")
	bundledScript := filepath.Join(appDir, "dist-render-pdf.js")

	if _, err := os.Stat(standaloneExe); err == nil {
		// PRODUCTIE (Optie 1): Gebruik standalone render-pdf.exe
		cmd = exec.Command(standaloneExe, tempHTMLPath, targetPDFPath)
	} else if _, err := os.Stat(portableRunner); err == nil {
		// PRODUCTIE (Optie 2): Gebruik node-runner.exe + dist-render-pdf.js
		cmd = exec.Command(portableRunner, bundledScript, tempHTMLPath, targetPDFPath)
	} else {
		// DEVELOPMENT: Valt automatisch terug op lokale node + render-pdf.js
		cmd = exec.Command("node", "render-pdf.js", tempHTMLPath, targetPDFPath)
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("Puppeteer PDF generatie mislukt: %v (details: %s)", err, string(output))
	}

	return targetPDFPath, nil
}
// wrapInFullHTMLDocument blijft ongewijzigd
func wrapInFullHTMLDocument(bodyHTML string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kennis- & Informatiesysteem Rapportage</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background-color: #ffffff;
            margin: 0;
            padding: 20mm;
        }

        @page {
            size: A4;
            margin: 20mm 15mm 20mm 15mm;
        }

        .book-report-wrapper { max-width: 800px; margin: 0 auto; }
        .book-main-title { font-size: 2.2rem; color: #111; margin-bottom: 0.5rem; }
        .book-colophon { font-style: italic; color: #555; margin-bottom: 2rem; border-left: 3px solid #ccc; padding-left: 12px; }
        
        .report-toc { background: #f9f9f9; padding: 1.5rem; border-radius: 6px; margin-bottom: 2.5rem; page-break-after: always; }
        .report-toc h2 { margin-top: 0; font-size: 1.2rem; }
        .report-toc ul { list-style: none; padding-left: 0; }
        .report-toc li { margin-bottom: 0.4rem; }
        .report-toc a { text-decoration: none; color: #0056b3; }
        
        .report-section { margin-bottom: 2rem; }
        .report-section.level-1 { page-break-before: always; }
        
        h1, h2, h3, h4 { color: #222; page-break-after: avoid; }
        
        @media print {
            body { padding: 0; }
            .report-toc { background: none; border: 1px solid #ddd; }
        }
    </style>
</head>
<body>
    %s
</body>
</html>`, bodyHTML)
}