import { readFileSync } from 'fs';

const pdfPath = 'c:/Users/Fabio/OneDrive - SORANA COMERCIAL E IMPORTADORA LTDA/DRE Audi.pdf';
const data = new Uint8Array(readFileSync(pdfPath));

const pdfjsLib = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const workerPath = new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
console.log('Total de páginas:', doc.numPages);

for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  console.log('\n=== PÁGINA', i, '===');

  // Agrupa itens por linha (mesmo Y)
  const lineMap = new Map();
  for (const item of content.items) {
    const y = Math.round(item.transform[5]);
    if (!lineMap.has(y)) lineMap.set(y, []);
    lineMap.get(y).push({ x: Math.round(item.transform[4]), text: item.str });
  }

  // Ordena por Y decrescente (topo para baixo) e dentro da linha por X
  const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
  for (const y of sortedYs) {
    const items = lineMap.get(y).sort((a, b) => a.x - b.x);
    const line = items.map(i => i.text).join('\t');
    if (line.trim()) console.log(line);
  }
}
