import type { MonitoramentoBVDayData } from './storage';

// ─── Parsing de células ──────────────────────────────────────────────────────

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

export function parseNumberBR(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const text = String(value).trim();
  if (!text) return 0;
  const normalized = text
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDateCell(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Serial de data do Excel (base 1899-12-30).
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function isoToDate(iso: string): Date | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function diffInDays(later: Date, earlier: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.floor(ms / 86400000);
}

// ─── Modelos ─────────────────────────────────────────────────────────────────

export interface VehicleRow {
  chassi: string;
  produto: string;
  valorNf: number;
  juros: number;
  emissaoNf: Date | null;
  dataVenda: Date | null;
  diasEstoque: number | null;
  vendido: boolean;
}

export interface BucketResult {
  label: string;
  qtd: number;
  juros: number;
  valorNf: number;
  veiculos: VehicleRow[];
}

export interface ProdutoResult {
  produto: string;
  qtd: number;
  valorNf: number;
  juros: number;
  mediaDias: number | null;
}

export interface GrupoResumo {
  qtd: number;
  valorNf: number;
  juros: number;
}

export interface DayAnalysis {
  date: string;
  totalVeiculos: number;
  totalValorNf: number;
  totalJuros: number;
  mediaDiasGeral: number | null;
  vendidos: GrupoResumo;
  naoVendidos: GrupoResumo;
  bucketsVendidos: BucketResult[];
  bucketsNaoVendidos: BucketResult[];
  porProduto: ProdutoResult[];
  veiculos: VehicleRow[];
  /** Nenhuma tabela/coluna reconhecida no arquivo. */
  reconhecido: boolean;
}

export const FAIXAS: Array<{ label: string; min: number; max: number }> = [
  { label: '0 a 30 dias', min: 0, max: 30 },
  { label: '31 a 60 dias', min: 31, max: 60 },
  { label: '61 a 90 dias', min: 61, max: 90 },
  { label: '91 a 120 dias', min: 91, max: 120 },
  { label: '121 a 150 dias', min: 121, max: 150 },
  { label: 'Acima de 151 dias', min: 151, max: Infinity },
];

function faixaIndex(dias: number): number {
  const value = Math.max(0, dias);
  for (let i = 0; i < FAIXAS.length; i++) {
    if (value >= FAIXAS[i].min && value <= FAIXAS[i].max) return i;
  }
  return FAIXAS.length - 1;
}

// ─── Detecção da tabela e colunas ────────────────────────────────────────────

interface ColumnMap {
  chassi: number;
  produto: number;
  emissaoNf: number;
  dataVenda: number;
  valorNf: number;
  juros: number;
  mora: number;
  multa: number;
}

interface DetectedTable {
  headerRow: number;
  rows: unknown[][];
  columns: ColumnMap;
}

function detectTable(data: MonitoramentoBVDayData): DetectedTable | null {
  for (const sheet of data.sheets) {
    const rows = sheet.rows;
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const normalized = rows[r].map(normalizeHeader);
      const chassi = normalized.indexOf('chassi');
      if (chassi === -1) continue;
      const indexOf = (name: string) => normalized.indexOf(name);
      const columns: ColumnMap = {
        chassi,
        produto: indexOf('produto'),
        emissaoNf: indexOf('emissaonf'),
        dataVenda: indexOf('datadavenda'),
        valorNf: indexOf('valornf'),
        juros: indexOf('juros'),
        mora: indexOf('mora'),
        multa: indexOf('multa'),
      };
      return { headerRow: r, rows, columns };
    }
  }
  return null;
}

// ─── Análise de um dia ───────────────────────────────────────────────────────

const EMPTY_GRUPO: GrupoResumo = { qtd: 0, valorNf: 0, juros: 0 };

export function analyzeDay(data: MonitoramentoBVDayData): DayAnalysis {
  const detected = detectTable(data);
  const baseDate = isoToDate(data.date);

  const base: DayAnalysis = {
    date: data.date,
    totalVeiculos: 0,
    totalValorNf: 0,
    totalJuros: 0,
    mediaDiasGeral: null,
    vendidos: { ...EMPTY_GRUPO },
    naoVendidos: { ...EMPTY_GRUPO },
    bucketsVendidos: FAIXAS.map(f => ({ label: f.label, qtd: 0, juros: 0, valorNf: 0, veiculos: [] })),
    bucketsNaoVendidos: FAIXAS.map(f => ({ label: f.label, qtd: 0, juros: 0, valorNf: 0, veiculos: [] })),
    porProduto: [],
    veiculos: [],
    reconhecido: Boolean(detected),
  };

  if (!detected) return base;

  const { headerRow, rows, columns } = detected;
  const cell = (row: unknown[], index: number) => (index >= 0 ? row[index] : undefined);

  const produtoMap = new Map<string, { qtd: number; valorNf: number; juros: number; somaDias: number; comDias: number }>();
  let somaDiasGeral = 0;
  let comDiasGeral = 0;

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const chassi = String(cell(row, columns.chassi) ?? '').trim();
    if (!chassi) continue;

    const produto = String(cell(row, columns.produto) ?? '').trim() || '(sem produto)';
    const valorNf = parseNumberBR(cell(row, columns.valorNf));
    const juros =
      parseNumberBR(cell(row, columns.juros)) +
      parseNumberBR(cell(row, columns.mora)) +
      parseNumberBR(cell(row, columns.multa));
    const emissaoNf = parseDateCell(cell(row, columns.emissaoNf));
    const dataVenda = parseDateCell(cell(row, columns.dataVenda));
    const vendido = dataVenda !== null;

    let diasEstoque: number | null = null;
    if (emissaoNf) {
      const ref = vendido ? dataVenda : baseDate;
      if (ref) diasEstoque = Math.max(0, diffInDays(ref, emissaoNf));
    }

    const veiculo: VehicleRow = { chassi, produto, valorNf, juros, emissaoNf, dataVenda, diasEstoque, vendido };
    base.veiculos.push(veiculo);

    base.totalVeiculos += 1;
    base.totalValorNf += valorNf;
    base.totalJuros += juros;

    const grupo = vendido ? base.vendidos : base.naoVendidos;
    grupo.qtd += 1;
    grupo.valorNf += valorNf;
    grupo.juros += juros;

    if (diasEstoque !== null) {
      const buckets = vendido ? base.bucketsVendidos : base.bucketsNaoVendidos;
      const bucket = buckets[faixaIndex(diasEstoque)];
      bucket.qtd += 1;
      bucket.juros += juros;
      bucket.valorNf += valorNf;
      bucket.veiculos.push(veiculo);

      somaDiasGeral += diasEstoque;
      comDiasGeral += 1;
    }

    const acc = produtoMap.get(produto) ?? { qtd: 0, valorNf: 0, juros: 0, somaDias: 0, comDias: 0 };
    acc.qtd += 1;
    acc.valorNf += valorNf;
    acc.juros += juros;
    if (diasEstoque !== null) {
      acc.somaDias += diasEstoque;
      acc.comDias += 1;
    }
    produtoMap.set(produto, acc);
  }

  base.mediaDiasGeral = comDiasGeral > 0 ? somaDiasGeral / comDiasGeral : null;
  base.porProduto = Array.from(produtoMap.entries())
    .map(([produto, acc]) => ({
      produto,
      qtd: acc.qtd,
      valorNf: acc.valorNf,
      juros: acc.juros,
      mediaDias: acc.comDias > 0 ? acc.somaDias / acc.comDias : null,
    }))
    .sort((a, b) => b.juros - a.juros);

  return base;
}
