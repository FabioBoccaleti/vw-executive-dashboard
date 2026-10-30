import * as XLSX from 'xlsx';
import type { VeiculoRow } from './veiculosStorage';
import { deriveMarca } from './veiculosAnalise';

export interface ParsedVeiculos {
  headers: string[];
  rows: string[][];
  veiculos: VeiculoRow[];
}

/** Normaliza cabeçalho: maiúsculas, sem acentos e sem caracteres não alfanuméricos. */
function normalizeHeader(h: string): string {
  return String(h)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/** Encontra o índice de uma coluna pelo nome normalizado (aceita vários candidatos). */
function findColumn(headers: string[], candidates: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const c of candidates) {
    const idx = norm.indexOf(normalizeHeader(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Converte um valor de célula (número, string pt-BR/US) em número. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value ?? '').trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma > lastDot) {
    // vírgula é o separador decimal (pt-BR): remove pontos de milhar
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    // ponto é o separador decimal (US): remove vírgulas de milhar
    normalized = s.replace(/,/g, '');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Converte serial do Excel, Date ou string de data em ISO 'YYYY-MM-DD' (ou null). */
function toISODate(value: unknown): string | null {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Serial do Excel (dias desde 1899-12-30)
    const ms = Date.UTC(1899, 11, 30) + value * 86_400_000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  const s = String(value).trim();
  if (!s) return null;

  // Formatos com separador '/' ou '-'
  const m = s.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (m) {
    let a = Number(m[1]);
    const b = Number(m[2]);
    let c = Number(m[3]);
    // ISO: YYYY-MM-DD
    if (m[1].length === 4) {
      return `${a}-${pad(b)}-${pad(c)}`;
    }
    // Caso contrário assume formato US MM/DD/YY(YY) (como na planilha de origem).
    // Se o primeiro campo for > 12, interpreta como DD/MM.
    let mm = a;
    let dd = b;
    if (a > 12 && b <= 12) {
      dd = a;
      mm = b;
    }
    if (c < 100) c += c < 70 ? 2000 : 1900;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${c}-${pad(mm)}-${pad(dd)}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return null;
}

/** Formata uma célula bruta para exibição na tabela de pré-visualização. */
function displayCell(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
  }
  return String(value).trim();
}

/**
 * Faz o parse do arquivo Excel de inventário de veículos usados.
 * Lê a primeira planilha, mapeia as colunas por nome (sem acento/maiúsculas) e
 * monta a lista estruturada de veículos, além dos dados brutos para preview.
 */
export function parseVeiculosWorkbook(buffer: ArrayBuffer): ParsedVeiculos {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [], veiculos: [] };

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: true,
  });

  if (matrix.length === 0) return { headers: [], rows: [], veiculos: [] };

  const rawHeaders = (matrix[0] as unknown[]).map((h) => String(h ?? '').trim());
  const dataRows = matrix.slice(1).filter((r) => (r as unknown[]).some((c) => String(c ?? '').trim() !== ''));

  const idxVeiculo = findColumn(rawHeaders, ['VEICULO']);
  const idxChassi = findColumn(rawHeaders, ['CHASSI']);
  const idxModelo = findColumn(rawHeaders, ['MODELO']);
  const idxNf = findColumn(rawHeaders, ['NF']);
  const idxIdent = findColumn(rawHeaders, ['IDENTIFICACAO', 'IDENTIFICAÇÃO', 'PLACA']);
  const idxEntrada = findColumn(rawHeaders, ['ENTRADA']);
  const idxValor = findColumn(rawHeaders, ['UNITARIO', 'UNITÁRIO', 'VLUNIT', 'VALOR']);

  const cell = (row: unknown[], idx: number): unknown => (idx >= 0 ? row[idx] : '');

  const veiculos: VeiculoRow[] = dataRows.map((r) => {
    const row = r as unknown[];
    const modelo = String(cell(row, idxModelo) ?? '').trim();
    return {
      veiculo: String(cell(row, idxVeiculo) ?? '').trim(),
      chassi: String(cell(row, idxChassi) ?? '').trim(),
      modelo,
      marca: deriveMarca(modelo),
      nf: String(cell(row, idxNf) ?? '').trim(),
      identificacao: String(cell(row, idxIdent) ?? '').trim(),
      entrada: toISODate(cell(row, idxEntrada)),
      valor: toNumber(cell(row, idxValor)),
    };
  });

  const rows = dataRows.map((r) => (r as unknown[]).map(displayCell));

  return { headers: rawHeaders, rows, veiculos };
}
