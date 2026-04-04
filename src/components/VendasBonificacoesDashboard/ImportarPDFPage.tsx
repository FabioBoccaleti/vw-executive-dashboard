import { useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle, Table2, ChevronDown, ChevronRight, Download, LayoutList, TableProperties, ClipboardList, Banknote, Archive, Tag, TrendingUp, BarChart2, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker as createTesseractWorker } from 'tesseract.js';
import { TabelaDadosDashboard } from './TabelaDadosDashboard';
import { RegistroVendasDashboard } from './RegistroVendasDashboard';
import { BonusVarejoDashboard } from './BonusVarejoDashboard';
import { BonusTradeInDashboard } from './BonusTradeInDashboard';
import { JurosRotativoDashboard } from './JurosRotativoDashboard';
import VendasResultadoDashboard from './VendasResultadoDashboard';
import { CadastrosVWPage } from './CadastrosVWPage';
import { VendasNovoAnalise } from './VendasNovoAnalise';
import { VendasUsadoAnalise } from './VendasUsadoAnalise';
import { VendasDiretaAnalise } from './VendasDiretaAnalise';
import { appendTabelaDadosRows } from './tabelaDadosStorage';
import type { TabelaDadosRow } from './tabelaDadosStorage';

// Vite resolve este path para a URL correta do worker (dev e build)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

interface TableData {
  headers: string[];
  rows: string[][];
  mode: 'tabela' | 'formulario';
}

interface PageResult {
  page: number;
  total: number;
  data: TableData;      // modo selecionado pelo usuário (exibição por página)
  formData: TableData;  // sempre formulário — usado para tabela consolidada
  rawItems: RawItem[];  // itens brutos do pdfjs para busca espacial
}

interface ImportarPDFPageProps {
  onBack: () => void;
}

type RawItem = { x: number; y: number; str: string };

// ─── Mapeamento fixo: coluna → chaves de busca no PDF ────────────────────────
// exact: true → campo deve começar com a chave (não apenas conter)
// transform: função para pós-processar o valor extraído
const FIELD_MAP: { label: string; keys: string[]; exact?: boolean; joinNeighbors?: boolean; transform?: (v: string) => string }[] = [
  { label: 'Data Faturamento', keys: ['data faturamento', 'data fat'] },
  { label: 'Nota',             keys: ['nota'] },
  { label: 'ID Venda',         keys: ['id. venda', 'id venda', 'id.venda'] },
  { label: 'Pedido',           keys: ['pedido'] },
  { label: 'Arrendatário',     keys: ['arrendatário', 'arrendatario'] },
  { label: 'Fonte Pagadora',   keys: ['fonte pagadora'] },
  { label: 'Vencimento',       keys: ['vencimento'] },
  { label: 'Valor NF',         keys: ['valor n.f.', 'valor nf', 'valor n.f'] },
  // exact: true evita capturar "Base ICMS Substitutivo"
  { label: 'ICMS Substitutivo', keys: ['icms substitutivo'], exact: true },
  // joinNeighbors: junta itens consecutivos (ex: "B4B4" + "- BRANCO CRISTAL"); transform mantém só o nome após o traço
  { label: 'Cor Externa', keys: ['cor externa', 'cor ext'], joinNeighbors: true,
    transform: (v) => { const m = v.match(/-\s*(.+)$/); if (!m) return v; return m[1].replace(/\s+Ano\s.*/i, '').trim(); } },
  { label: 'Chassi',           keys: ['chassi'] },
  { label: 'Descrição Veículo', keys: ['descrição do veículo', 'descricao do veiculo', 'descrição veículo'] },
];

// Estratégia 1: busca nos pares do formData
// Estratégia 2: busca direta no texto bruto dos itens (mais robusta para campos não parseados)
function extractFieldSmart(
  formData: TableData,
  rawItems: RawItem[],
  keys: string[],
  exact = false,
  transform?: (v: string) => string,
  joinNeighbors = false,
): string {
  const applyTransform = (v: string) => (transform ? transform(v) : v);
  const matchKey = (campo: string) =>
    exact
      ? keys.some(k => campo.startsWith(k.toLowerCase()))
      : keys.some(k => campo.includes(k.toLowerCase()));

  // Estratégia 1: pares do formulário
  for (const row of formData.rows) {
    const campo = (row[0] ?? '').toLowerCase().trim();
    if (matchKey(campo)) {
      const val = (row[1] ?? '').trim();
      if (val) return applyTransform(val);
    }
  }

  if (rawItems.length === 0) return '';

  // Estratégia 2: busca espacial nos itens brutos
  // Para cada chave, procura o item que contém a chave e extrai o valor à direita
  const sorted = [...rawItems].sort((a, b) => a.y - b.y || a.x - b.x);

  for (const key of keys) {
    const keyLower = key.toLowerCase();
    // Caso A: label e valor podem estar no mesmo item: "Data Faturamento: 23/03/2026"
    for (const item of sorted) {
      const text = item.str;
      const textLower = text.toLowerCase();
      const keyIdx = textLower.indexOf(keyLower);
      if (keyIdx === -1) continue;
      // exact: garante que antes da chave não há texto alfanumérico (evita "Base ICMS...")
      if (exact && keyIdx > 0 && /[a-zà-üa-z0-9]/i.test(textLower[keyIdx - 1])) continue;
      const afterKey = text.slice(keyIdx + key.length).replace(/^\s*:\s*/, '').trim();
      if (afterKey) return applyTransform(afterKey.split(/\s{2,}/)[0].trim());
      // Label-only item: valor está no(s) próximo(s) item(s) à direita na mesma linha
      const Y_THRESH = 6;
      const rightItems = sorted
        .filter(i => Math.abs(i.y - item.y) <= Y_THRESH && i.x > item.x)
        .sort((a, b) => a.x - b.x);
      if (rightItems.length > 0) {
        let val: string;
        if (joinNeighbors) {
          // Junta itens consecutivos com gap pequeno (ex: "B4B4" + "- BRANCO CRISTAL")
          const parts: string[] = [];
          for (let ri = 0; ri < rightItems.length; ri++) {
            const curr = rightItems[ri];
            if (ri > 0) {
              const prev = rightItems[ri - 1];
              const gap = curr.x - (prev.x + prev.str.length * 5);
              if (gap > 50) break;
            }
            const s = curr.str.replace(/^:\s*/, '').trim();
            if (s) parts.push(s);
          }
          val = parts.join(' ').trim();
        } else {
          val = rightItems[0].str.replace(/^:\s*/, '').trim();
        }
        if (val) return applyTransform(val);
      }
    }

    // Caso B: busca no texto completo da página por "key: value"
    const fullText = sorted.map(i => i.str).join(' ');
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary = exact ? '(?<![a-zà-ú])' : '';
    const re = new RegExp(boundary + escaped + '\\s*:?\\s*([^\\n]{1,80}?)(?=\\s{2,}[A-ZÀ-Úa-zà-ú]|$)', 'i');
    const m = re.exec(fullText);
    if (m && m[1].trim()) return applyTransform(m[1].trim());
  }

  return '';
}

function buildConsolidated(pages: PageResult[]): { headers: string[]; rows: string[][] } {
  const headers = ['Pág.', ...FIELD_MAP.map(f => f.label)];
  const rows = pages.map(({ page, formData, rawItems }) => {
    const fontePagadoraField = FIELD_MAP.find(f => f.label === 'Fonte Pagadora');
    const fontePagadora = fontePagadoraField
      ? extractFieldSmart(formData, rawItems, fontePagadoraField.keys).toLowerCase()
      : '';
    const isSorana = fontePagadora.includes('sorana');
    return [
      String(page),
      ...FIELD_MAP.map(f => {
        if ((f.label === 'ID Venda' || f.label === 'Arrendatário') && isSorana) return '';
        return extractFieldSmart(formData, rawItems, f.keys, f.exact, f.transform, f.joinNeighbors);
      }),
    ];
  });
  return { headers, rows };
}

function exportCSV(headers: string[], rows: string[][], filename: string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Extrai itens de texto nativo de UMA página ─────────────────────────────
async function collectNativeItemsPage(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<RawItem[]> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: RawItem[] = [];
  for (const item of content.items) {
    if (!('str' in item)) continue;
    const str = (item as { str: string }).str.trim();
    if (!str) continue;
    const t = (item as { transform: number[] }).transform;
    items.push({ x: t[4], y: viewport.height - t[5], str });
  }
  return items;
}

// ─── OCR: processa texto linha a linha a partir de data.text ─────────────────
function parseOCRLinesAsForm(lines: string[]): TableData {
  const pairs: string[][] = [];
  for (const line of lines) {
    // cada linha pode ter múltiplos pares separados por espaços largos
    const parts = line.split(/\s{3,}/);
    for (const part of parts) {
      const ci = part.indexOf(':');
      if (ci > 0) {
        pairs.push([part.slice(0, ci).trim(), part.slice(ci + 1).trim()]);
      } else if (part.trim().length > 1) {
        pairs.push([part.trim(), '']);
      }
    }
  }
  if (pairs.length === 0) return { headers: [], rows: [], mode: 'formulario' };
  return { headers: ['Campo', 'Valor'], rows: pairs, mode: 'formulario' };
}

function parseOCRLinesAsTable(lines: string[]): TableData {
  const rows = lines.map(l => l.split(/\s{2,}/).filter(c => c.trim()));
  const filtered = rows.filter(r => r.length > 0);
  if (filtered.length === 0) return { headers: [], rows: [], mode: 'tabela' };
  const [headers, ...dataRows] = filtered;
  return { headers, rows: dataRows, mode: 'tabela' };
}

async function extractViaOCR(
  pdf: pdfjsLib.PDFDocumentProxy,
  forceMode: 'tabela' | 'formulario' | undefined,
  onProgress?: (msg: string) => void,
): Promise<PageResult[]> {
  onProgress?.('PDF baseado em imagem — iniciando OCR...');
  const scale = 2;
  const worker = await createTesseractWorker('eng');
  const results: PageResult[] = [];
  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress?.(`Reconhecendo texto — página ${pageNum} de ${pdf.numPages}...`);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const { data: { text } } = await worker.recognize(canvas);
      console.log('[OCR] página', pageNum, '— chars reconhecidos:', text.length);
      const pageLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
      const empty: TableData = { headers: [], rows: [], mode: forceMode ?? 'formulario' };
      if (pageLines.length === 0) {
        results.push({ page: pageNum, total: pdf.numPages, data: empty, formData: empty, rawItems: [] });
        continue;
      }
      const hasColons = pageLines.some(l => l.includes(':'));
      const mode = forceMode ?? (hasColons ? 'formulario' : 'tabela');
      const data = mode === 'formulario' ? parseOCRLinesAsForm(pageLines) : parseOCRLinesAsTable(pageLines);
      const formData = parseOCRLinesAsForm(pageLines); // sempre formulário para consolidação
      results.push({ page: pageNum, total: pdf.numPages, data, formData, rawItems: [] });
    }
  } finally {
    await worker.terminate();
  }
  return results;
}

// ─── Agrupa items em faixas horizontais por Y ────────────────────────────────
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

// ─── Detecta threshold de separação de linhas pela moda dos gaps Y ───────────
function detectLineThreshold(items: RawItem[]): number {
  const uniqueYs = [...new Set(items.map(i => Math.round(i.y)))].sort((a, b) => a - b);
  if (uniqueYs.length < 3) return 6;
  const gaps = uniqueYs.slice(1).map((y, i) => y - uniqueYs[i]);
  const cnt = new Map<number, number>();
  for (const g of gaps) {
    const r = Math.round(g / 2) * 2;
    cnt.set(r, (cnt.get(r) ?? 0) + 1);
  }
  let modeGap = 0, modeCount = 0;
  for (const [g, c] of cnt) if (c > modeCount) { modeGap = g; modeCount = c; }
  return Math.max(4, modeGap * 0.7);
}

// ─── MODO TABELA: clustering de colunas por posição X ────────────────────────
function extractAsTable(items: RawItem[]): TableData {
  const lineSep = detectLineThreshold(items);
  const bands = groupIntoLineBands(items, lineSep);
  const X_GAP = 10;
  const allXs = items.map(i => i.x).sort((a, b) => a - b);
  const colAnchors: number[] = [];
  for (const x of allXs) {
    if (!colAnchors.some(cx => Math.abs(cx - x) <= X_GAP)) colAnchors.push(x);
  }
  colAnchors.sort((a, b) => a - b);
  const matrix: string[][] = bands.map(band => {
    const cells = new Array<string>(colAnchors.length).fill('');
    const sorted = [...band].sort((a, b) => a.x - b.x || a.y - b.y);
    for (const item of sorted) {
      let nearest = 0, nearestD = Infinity;
      for (let i = 0; i < colAnchors.length; i++) {
        const d = Math.abs(colAnchors[i] - item.x);
        if (d < nearestD) { nearestD = d; nearest = i; }
      }
      cells[nearest] = cells[nearest] ? cells[nearest] + ' ' + item.str : item.str;
    }
    return cells;
  });
  const usedCols = colAnchors.map((_, i) => i).filter(i => matrix.some(r => r[i].trim()));
  const trimmed = matrix
    .map(row => usedCols.map(i => row[i]))
    .filter(row => row.some(c => c.trim()));
  if (trimmed.length === 0) return { headers: [], rows: [], mode: 'tabela' };
  const [headers, ...rows] = trimmed;
  return { headers, rows, mode: 'tabela' };
}

// ─── MODO FORMULÁRIO: extrai pares "Campo: Valor" em ordem de leitura ────────
function extractAsForm(items: RawItem[]): TableData {
  const lineSep = detectLineThreshold(items);
  const bands = groupIntoLineBands(items, lineSep);
  const pairs: { campo: string; valor: string }[] = [];
  for (const band of bands) {
    const sorted = [...band].sort((a, b) => a.x - b.x);
    const line = sorted.map(i => i.str).join(' ');
    const segmentRegex = /([A-ZÀ-Úa-zà-ú][^:]{0,60}):\s*([^:]*?)(?=\s{2,}[A-ZÀ-Úa-zà-ú][^:]{0,60}:|$)/g;
    let match;
    let found = false;
    while ((match = segmentRegex.exec(line)) !== null) {
      const campo = match[1].trim();
      const valor = match[2].trim();
      if (campo) { pairs.push({ campo, valor }); found = true; }
    }
    if (!found && line.trim()) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && colonIdx < line.length - 1) {
        pairs.push({ campo: line.slice(0, colonIdx).trim(), valor: line.slice(colonIdx + 1).trim() });
      } else {
        pairs.push({ campo: line.trim(), valor: '' });
      }
    }
  }
  if (pairs.length === 0) return { headers: [], rows: [], mode: 'formulario' };
  return { headers: ['Campo', 'Valor'], rows: pairs.map(p => [p.campo, p.valor]), mode: 'formulario' };
}

// ─── Auto-detecta o modo ─────────────────────────────────────────────────────
function detectMode(items: RawItem[]): 'tabela' | 'formulario' {
  const withColon = items.filter(i => i.str.includes(':')).length;
  const ratio = withColon / Math.max(1, items.length);
  const uniqueYs = new Set(items.map(i => Math.round(i.y))).size;
  if (ratio > 0.18 && items.length / Math.max(1, uniqueYs) < 4) return 'formulario';
  return 'tabela';
}

async function extractFromPDF(
  file: File,
  forceMode?: 'tabela' | 'formulario',
  onProgress?: (msg: string) => void,
): Promise<PageResult[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  // Testa se a primeira página tem texto nativo
  const firstPageItems = await collectNativeItemsPage(pdf, 1);
  console.log('[pdfjs] itens texto pág 1:', firstPageItems.length);
  if (firstPageItems.length > 0) {
    // PDF com texto nativo: processa cada página individualmente
    const results: PageResult[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress?.(`Processando página ${pageNum} de ${pdf.numPages}...`);
      const items = await collectNativeItemsPage(pdf, pageNum);
      const empty: TableData = { headers: [], rows: [], mode: forceMode ?? 'tabela' };
      if (items.length === 0) {
        results.push({ page: pageNum, total: pdf.numPages, data: empty, formData: empty, rawItems: [] });
        continue;
      }
      const mode = forceMode ?? detectMode(items);
      const data = mode === 'formulario' ? extractAsForm(items) : extractAsTable(items);
      const formData = extractAsForm(items); // sempre formulário para tabela consolidada
      results.push({ page: pageNum, total: pdf.numPages, data, formData, rawItems: items });
    }
    return results;
  }
  // PDF sem texto nativo → OCR página a página
  return extractViaOCR(pdf, forceMode, onProgress);
}

// ─── Conversão de data PDF (DD/MM/YYYY) → ISO (YYYY-MM-DD) ───────────────────
function pdfDateToISO(v: string): string {
  if (!v) return '';
  let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return '';
}

// ─── Conversão de valor monetário PDF → número raw ────────────────────────────
function pdfCurrencyToRaw(v: string): string {
  if (!v) return '';
  const s = v.replace(/R\$\s*/g, '').trim();
  if (!s) return '';
  const lastComma  = s.lastIndexOf(',');
  const lastPeriod = s.lastIndexOf('.');
  const normalized = lastComma > lastPeriod
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  const n = parseFloat(normalized);
  return isNaN(n) ? '' : String(n);
}

// ─── Converte resultados consolidados do PDF → TabelaDadosRow[] ───────────────
function pdfResultsToTableRows(pages: PageResult[]): Omit<TabelaDadosRow, 'id'>[] {
  const { headers, rows } = buildConsolidated(pages);
  const idx = (label: string) => headers.indexOf(label);
  return rows.map(row => ({
    dataFaturamento:  pdfDateToISO(row[idx('Data Faturamento')]  ?? ''),
    nota:             row[idx('Nota')]              ?? '',
    idVenda:          row[idx('ID Venda')]          ?? '',
    pedido:           row[idx('Pedido')]            ?? '',
    arrendatario:     row[idx('Arrendatário')]      ?? '',
    fontePagadora:    row[idx('Fonte Pagadora')]    ?? '',
    vencimento:       pdfDateToISO(row[idx('Vencimento')]       ?? ''),
    valorNF:          pdfCurrencyToRaw(row[idx('Valor NF')]     ?? ''),
    icmsSubstitutivo: pdfCurrencyToRaw(row[idx('ICMS Substitutivo')] ?? ''),
    corExterna:       row[idx('Cor Externa')]       ?? '',
    chassi:           row[idx('Chassi')]            ?? '',
    descricaoVeiculo: row[idx('Descrição Veículo')] ?? '',
  }));
}

export function ImportarPDFPage({ onBack }: ImportarPDFPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mainView, setMainView] = useState<'cadastros' | 'registros' | 'financeiro' | 'vendas' | 'analises'>('analises');
  const [analiseTab, setAnaliseTab] = useState<'novos' | 'usados' | 'direta' | 'pecas' | 'oficina'>('novos');
  const [activeTab, setActiveTab] = useState<'importar' | 'tabela' | 'registro' | 'bonus' | 'tradein' | 'juros'>('importar');
  const [registroSubTab, setRegistroSubTab] = useState<'novos' | 'frotista' | 'usados'>('novos');
  const [registroFilterYear, setRegistroFilterYear] = useState<number>(new Date().getFullYear());
  const [registroFilterMonth, setRegistroFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [pages, setPages] = useState<PageResult[] | null>(null);
  const [openPages, setOpenPages] = useState<Set<number>>(new Set([1]));
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string>('Lendo o PDF...');
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'tabela' | 'formulario' | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'paginas' | 'consolidada'>('paginas');

  function togglePage(pageNum: number) {
    setOpenPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  }

  async function processFile(file: File, forceMode?: 'tabela' | 'formulario') {
    setLoading(true);
    setLoadingMsg('Lendo o PDF...');
    setErrorMsg(null);
    setPages(null);
    try {
      const results = await extractFromPDF(file, forceMode, (msg) => setLoadingMsg(msg));
      const totalWithData = results.filter(r => r.data.rows.length > 0).length;
      if (totalWithData === 0) {
        toast.warning('Nenhum texto encontrado no PDF.');
      } else {
        const modeLabel = results[0]?.data.mode === 'formulario' ? 'Formulário' : 'Tabela';
        toast.success(`${results.length} página(s) importada(s) em modo ${modeLabel}!`);
      }
      setPages(results);
      setOpenPages(new Set(results.map(r => r.page)));

      // ─── Auto-salvar na Tabela de Dados ────────────────────────────────────
      const tableRows = pdfResultsToTableRows(results).filter(r => r.chassi.trim());
      if (tableRows.length > 0) {
        const { added, duplicates } = await appendTabelaDadosRows(tableRows);
        if (added > 0) toast.success(`${added} linha(s) salvas na Tabela de Dados.`);
        if (duplicates.length > 0)
          toast.warning(
            `${duplicates.length} chassi(s) já existiam e foram ignorados: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '…' : ''}`,
          );
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      toast.error('Erro ao processar o PDF.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isLikelyPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isLikelyPdf) { toast.error('Selecione um arquivo PDF válido.'); return; }
    setFileName(file.name);
    setLastFile(file);
    setMode(undefined);
    await processFile(file, undefined);
  }

  async function handleSwitchMode(m: 'tabela' | 'formulario') {
    if (!lastFile) return;
    setMode(m);
    await processFile(lastFile, m);
  }

  function handleClear() {
    setPages(null);
    setFileName(null);
    setErrorMsg(null);
    setLastFile(null);
    setMode(undefined);
    setViewMode('paginas');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const currentMode = pages?.[0]?.data.mode;
  const consolidated = pages ? buildConsolidated(pages) : null;

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Central de Vendas VW</h1>
          <p className="text-xs text-slate-500 mt-0.5">Gerencie registros, importações e financeiro de vendas</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Seletor de visão principal */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setMainView('cadastros')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'cadastros' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Cadastros
            </button>
            <button
              onClick={() => setMainView('registros')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'registros' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              Registros
            </button>
            <button
              onClick={() => setMainView('financeiro')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'financeiro' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              Financeiro
            </button>
            <button
              onClick={() => setMainView('vendas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'vendas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Vendas
            </button>
            <button
              onClick={() => setMainView('analises')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainView === 'analises' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Análises
            </button>
          </div>
          <button
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-3 py-1.5 transition-colors hover:bg-slate-50"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Sub-abas — apenas na visão Registros */}
      {mainView === 'registros' && (
      <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0">
        <button
          onClick={() => setActiveTab('importar')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'importar'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-4 h-4" />
          Importar PDF
        </button>
        <button
          onClick={() => setActiveTab('tabela')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'tabela'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <TableProperties className="w-4 h-4" />
          Tabela de Dados
        </button>
        <button
          onClick={() => setActiveTab('registro')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'registro'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Registro de Vendas
        </button>
        <button
          onClick={() => setActiveTab('bonus')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'bonus'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Tag className="w-4 h-4" />
          Bônus Varejo
        </button>
        <button
          onClick={() => setActiveTab('tradein')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'tradein'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Tag className="w-4 h-4" />
          Bônus Trade IN
        </button>
        <button
          onClick={() => setActiveTab('juros')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'juros'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          Juros Rotativo
        </button>
      </div>
      )}

      {/* Visão Cadastros */}
      {mainView === 'cadastros' && <CadastrosVWPage />}

      {/* Visão Financeiro — placeholder */}
      {mainView === 'financeiro' && (
        <div className="flex-1 flex items-center justify-center text-slate-300">
          <div className="flex flex-col items-center gap-3">
            <Banknote className="w-12 h-12" />
            <span className="text-sm">Em desenvolvimento</span>
          </div>
        </div>
      )}

      {/* Visão Análises — sub-tabs */}
      {mainView === 'analises' && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          {/* Sub-tabs */}
          <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0">
            {([
              { id: 'novos',   label: 'Novos' },
              { id: 'usados',  label: 'Usados' },
              { id: 'direta',  label: 'VD / Frotista' },
              { id: 'pecas',   label: 'Peças' },
              { id: 'oficina', label: 'Oficina' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setAnaliseTab(tab.id)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  analiseTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Conteúdo */}
          {analiseTab === 'novos' && <VendasNovoAnalise />}
          {analiseTab === 'usados' && <VendasUsadoAnalise />}
          {analiseTab === 'direta' && <VendasDiretaAnalise />}
          {analiseTab !== 'novos' && analiseTab !== 'usados' && analiseTab !== 'direta' && (
            <div className="flex-1 flex items-center justify-center text-slate-300">
              <div className="flex flex-col items-center gap-3">
                <BarChart2 className="w-12 h-12" />
                <span className="text-sm">Em desenvolvimento</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visão Vendas */}
      {mainView === 'vendas' && <VendasResultadoDashboard />}

      {/* Aba: Registro de Vendas */}
      {mainView === 'registros' && activeTab === 'registro' && <RegistroVendasDashboard />}
      {mainView === 'registros' && activeTab === 'bonus' && <BonusVarejoDashboard />}
      {mainView === 'registros' && activeTab === 'tradein' && <BonusTradeInDashboard />}
      {mainView === 'registros' && activeTab === 'juros' && <JurosRotativoDashboard />}

      {/* Aba: Tabela de Dados */}
      {mainView === 'registros' && activeTab === 'tabela' && (
        <div className="flex-1" style={{ minHeight: 0 }}>
          <TabelaDadosDashboard onBack={onBack} embedded />
        </div>
      )}

      {/* Aba: Importar PDF */}
      {mainView === 'registros' && activeTab === 'importar' && (
        <div className="flex-1 p-6 flex flex-col gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Upload className="w-4 h-4" />
              {loading ? 'Processando...' : 'Importar PDF'}
            </Button>

            {fileName && !loading && (
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-1.5">
                <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="max-w-xs truncate">{fileName}</span>
                <button onClick={handleClear} className="text-slate-400 hover:text-red-500 transition-colors ml-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Alternador de modo — aparece após importar */}
          {lastFile && !loading && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Modo de leitura:</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                <button
                  onClick={() => handleSwitchMode('tabela')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                    currentMode === 'tabela'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  Tabela
                </button>
                <button
                  onClick={() => handleSwitchMode('formulario')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-l border-slate-200 transition-colors ${
                    currentMode === 'formulario'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Formulário
                </button>
              </div>
              <span className="text-xs text-slate-400">
                (auto-detectado — altere se necessário)
              </span>
            </div>
          )}

          <p className="text-xs text-slate-400">
            <strong>Tabela</strong>: PDFs com grade de linhas/colunas.&nbsp;
            <strong>Formulário</strong>: relatórios/fichas com campos "Label: Valor".
          </p>

          {/* Toggle de visualização — aparece após importar */}
          {pages && pages.length > 0 && !loading && (
            <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
              <span className="text-xs text-slate-500">Visualização:</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                <button
                  onClick={() => setViewMode('paginas')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${viewMode === 'paginas' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  Por Página
                </button>
                <button
                  onClick={() => setViewMode('consolidada')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-l border-slate-200 transition-colors ${viewMode === 'consolidada' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  Tabela Consolidada
                </button>
              </div>
              {viewMode === 'consolidada' && consolidated && (
                <button
                  onClick={() => exportCSV(consolidated.headers, consolidated.rows, `fvw_consolidado_${fileName ?? 'export'}.csv`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar CSV
                </button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Spinner */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-center max-w-xs">{loadingMsg}</span>
            </div>
          </div>
        )}

        {/* Erro detalhado */}
        {!loading && errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1">Erro ao processar o PDF</p>
              <p className="text-xs text-red-600 font-mono break-all">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Resultado — por página OU tabela consolidada */}
        {!loading && pages && pages.length > 0 && viewMode === 'consolidada' && consolidated && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-700">Tabela Consolidada</h2>
              <span className="text-xs text-slate-400">{consolidated.rows.length} veículo(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {consolidated.headers.map((h, i) => (
                      <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consolidated.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      {row.map((cell, colIdx) => (
                        <td key={colIdx} className="px-4 py-2 text-slate-700 border-b border-slate-100 whitespace-nowrap">
                          {cell || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Resultado — uma seção colapsável por página */}
        {!loading && pages && pages.length > 0 && viewMode === 'paginas' && (
          <div className="flex flex-col gap-4">
            {pages.map(({ page, total, data }) => {
              const isOpen = openPages.has(page);
              const hasData = data.headers.length > 0;
              return (
                <div key={page} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Cabeçalho da página */}
                  <button
                    onClick={() => togglePage(page)}
                    className="w-full px-5 py-3 border-b border-slate-100 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    }
                    <span className="text-sm font-semibold text-slate-700">
                      Página {page}{total > 1 ? ` de ${total}` : ''}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      data.mode === 'formulario' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {data.mode === 'formulario' ? 'Formulário' : 'Tabela'}
                    </span>
                    {hasData && (
                      <span className="text-xs text-slate-400">
                        {data.rows.length} {data.mode === 'formulario' ? 'campo(s)' : `linha${data.rows.length !== 1 ? 's' : ''}`}
                      </span>
                    )}
                  </button>

                  {/* Conteúdo colapsável */}
                  {isOpen && (
                    !hasData ? (
                      <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
                        Nenhum dado encontrado nesta página.
                      </div>
                    ) : data.mode === 'formulario' ? (
                      <div className="divide-y divide-slate-100">
                        {data.rows.map((row, idx) => (
                          <div key={idx} className={`flex text-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                            <div className="w-64 shrink-0 px-5 py-2.5 font-medium text-slate-600 border-r border-slate-100">
                              {row[0]}
                            </div>
                            <div className="flex-1 px-5 py-2.5 text-slate-800">
                              {row[1] ?? ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50">
                              {data.headers.map((h, i) => (
                                <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.rows.map((row, rowIdx) => (
                              <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                {data.headers.map((_, colIdx) => (
                                  <td key={colIdx} className="px-4 py-2 text-slate-700 border-b border-slate-100 whitespace-nowrap">
                                    {row[colIdx] ?? ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && !pages && !errorMsg && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-3">
            <FileText className="w-12 h-12" />
            <span className="text-sm">Nenhum PDF importado ainda</span>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
