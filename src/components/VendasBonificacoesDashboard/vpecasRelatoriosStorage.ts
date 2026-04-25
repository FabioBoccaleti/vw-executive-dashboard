import * as pdfjsLib from 'pdfjs-dist';
import { kvGet, kvSet, kvDelete } from '@/lib/kvClient';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VPecasRelatorioData {
  headers:    string[];
  rows:       string[][];  // each row: [condPagto, valOperacao (BR format "1.234,56")]
  importedAt: string;
  fileName:   string;
}

export type VPecasRelMarca   = 'audi' | 'vw';
export type VPecasRelSection = 'pecas' | 'acessorios' | 'oficina' | 'funilaria';

// ── KV ───────────────────────────────────────────────────────────────────────

function kvKey(
  marca:   VPecasRelMarca,
  section: VPecasRelSection,
  year:    number,
  month:   number,
): string {
  return `vpecas_rel:${marca}:${section}:${year}:${month}`;
}

export async function getVPecasRelatorio(
  marca:   VPecasRelMarca,
  section: VPecasRelSection,
  year:    number,
  month:   number,
): Promise<VPecasRelatorioData | null> {
  return kvGet<VPecasRelatorioData>(kvKey(marca, section, year, month));
}

export async function setVPecasRelatorio(
  marca:   VPecasRelMarca,
  section: VPecasRelSection,
  year:    number,
  month:   number,
  data:    VPecasRelatorioData,
): Promise<void> {
  return kvSet(kvKey(marca, section, year, month), data);
}

export async function deleteVPecasRelatorio(
  marca:   VPecasRelMarca,
  section: VPecasRelSection,
  year:    number,
  month:   number,
): Promise<void> {
  await kvDelete(kvKey(marca, section, year, month));
}

// ── PDF parsing ───────────────────────────────────────────────────────────────

type RawItem = { x: number; y: number; str: string };

/**
 * Returns true if the string looks like a Brazilian currency value,
 * e.g. "77,20" | "8.938,55" | "1.000.648,26"
 */
export function isBRLValue(str: string): boolean {
  return /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(str.trim());
}

/** Rows to skip when building the condition/value pairs */
function isIgnoredText(s: string): boolean {
  const low = s.toLowerCase().trim();
  return (
    low === 'total' ||
    low.startsWith('total geral') ||
    low.startsWith('cond') ||        // "Cond.Pagto" header
    low.startsWith('val oper') ||    // "Val Operação" header
    low.startsWith('val. oper') ||
    low.includes('resumo por') ||
    low.includes('página') ||
    low.includes('data de entrada') ||
    low.includes('data ent') ||
    low.includes('dtaent') ||
    low.includes('vendedor') ||
    low.includes('cliente') ||
    low.includes('total nota') ||
    low.includes('série') ||
    s.length < 3
  );
}

function detectLineThreshold(items: RawItem[]): number {
  const uniqueYs = [...new Set(items.map(i => Math.round(i.y)))].sort((a, b) => a - b);
  if (uniqueYs.length < 3) return 6;
  const gaps = uniqueYs.slice(1).map((y, i) => y - uniqueYs[i]);
  const cnt  = new Map<number, number>();
  for (const g of gaps) {
    const r = Math.round(g / 2) * 2;
    cnt.set(r, (cnt.get(r) ?? 0) + 1);
  }
  let modeGap = 0, modeCount = 0;
  for (const [g, c] of cnt) { if (c > modeCount) { modeGap = g; modeCount = c; } }
  return Math.max(4, modeGap * 0.7);
}

function groupIntoLineBands(items: RawItem[], thresh: number): RawItem[][] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const bands: RawItem[][] = [];
  for (const item of sorted) {
    const last = bands[bands.length - 1];
    if (last && Math.abs(item.y - last[0].y) <= thresh) {
      last.push(item);
    } else {
      bands.push([item]);
    }
  }
  return bands;
}

/**
 * Smart parser for "Resumo por Condição de Pagamento" PDFs.
 *
 * Strategy per line band (sorted left → right):
 *  - Accumulate all text tokens (including numeric codes) until a BRL value is found
 *  - BRL value → emit (condition, value) pair and reset buffer
 *  - Works for both layouts:
 *      Format A: "COND NAME  8.938,55  88  COND NAME  1.235,33"  (code between blocks)
 *      Format B: "119 COND NAME  257.486,62  120 COND NAME  353.636,22" (code prefixed)
 */
function parseCondPagtoReport(allItems: RawItem[]): { headers: string[]; rows: string[][] } {
  const lineSep = detectLineThreshold(allItems);
  const bands   = groupIntoLineBands(allItems, lineSep);

  const pairs: [string, string][] = [];

  for (const band of bands) {
    const sorted = [...band].sort((a, b) => a.x - b.x);
    let textBuf: string[] = [];

    for (const item of sorted) {
      const s = item.str.trim();
      if (!s) continue;

      if (isBRLValue(s)) {
        // Found a monetary value → pair with accumulated text
        if (textBuf.length > 0) {
          const cond = textBuf.join(' ').trim();
          if (cond.length >= 3 && !isIgnoredText(cond)) {
            pairs.push([cond, s]);
          }
        }
        textBuf = []; // reset buffer for next pair in the same line
      } else {
        // Accumulate all tokens — codes like "120" are part of the condition name
        if (!isIgnoredText(s)) {
          textBuf.push(s);
        }
      }
    }
  }

  if (pairs.length === 0) return { headers: [], rows: [] };

  return {
    headers: ['Cond. Pagamento', 'Val. Operação'],
    rows:    pairs.map(([cond, val]) => [cond, val]),
  };
}

/**
 * Public entry point: reads all pages and extracts structured Cond.Pagto data.
 */
export async function parsePdfRelatorio(
  file:        File,
  onProgress?: (msg: string) => void,
): Promise<{ headers: string[]; rows: string[][] }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let   yOffset  = 0;
  const allItems: RawItem[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(`Lendo página ${pageNum} de ${pdf.numPages}...`);
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content  = await page.getTextContent();

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const str = (item as { str: string }).str.trim();
      if (!str) continue;
      const t = (item as { transform: number[] }).transform;
      allItems.push({ x: t[4], y: viewport.height - t[5] + yOffset, str });
    }
    yOffset += viewport.height + 20;
  }

  if (allItems.length === 0) return { headers: [], rows: [] };
  return parseCondPagtoReport(allItems);
}
