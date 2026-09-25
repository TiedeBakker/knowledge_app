// render-pdf.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

function getExecutablePath() {
  // 1. Zoek naar meegeleverde Chromium in de app-map/distributiemap
  const localAppPath = path.join(__dirname, 'chrome', 'chrome-win64', 'chrome.exe');
  if (fs.existsSync(localAppPath)) {
    return localAppPath;
  }

  // 2. Alternatieve relatieve structuur (direct in chrome-map)
  const directChromePath = path.join(__dirname, 'chrome', 'chrome.exe');
  if (fs.existsSync(directChromePath)) {
    return directChromePath;
  }

  // 3. Fallback voor development: zoek in de Puppeteer cache op jouw pc
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const cacheBase = path.join(userHome, '.cache', 'puppeteer', 'chrome');

  if (fs.existsSync(cacheBase)) {
    const versions = fs.readdirSync(cacheBase);
    for (const version of versions) {
      const candidate = path.join(cacheBase, version, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

(async () => {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Gebruik: node render-pdf.js <input-html-pad> <output-pdf-pad>');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = path.resolve(args[1]);

  const executablePath = getExecutablePath();

  if (!executablePath) {
    console.error('Fout: Geen Chromium/Chrome executable gevonden. Zorg dat de map "chrome" aanwezig is.');
    process.exit(1);
  }

  console.log(`Gebruikte Chrome executable: ${executablePath}`);

  try {
    const browser = await puppeteer.launch({
      executablePath: executablePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Open de lokale HTML file
    await page.goto(`file://${inputPath}`, { waitUntil: 'networkidle0' });

    // Genereer PDF met A4 instellingen
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>', // Lege header
      footerTemplate: '<div style="font-size: 8pt; width: 100%; text-align: right; padding-right: 15mm; color: #888;">Pagina <span class="pageNumber"></span> van <span class="totalPages"></span></div>'
    });

    await browser.close();
    console.log(`PDF succesvol gegenereerd: ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error('Fout tijdens PDF-generatie:', error);
    process.exit(1);
  }
})();