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

/** Produto faturado em linha especial: vencimento no fim da carência (Data p/ Liq.). */
export const PRODUTO_LINHA_ESPECIAL = 'FP-CES-ESP';

export interface EspecialVehicle {
  chassi: string;
  produto: string;
  valorNf: number;
  diasCaixa: number;
  dataVenda: Date | null;
  dataPLiq: Date | null;
}

export interface EspecialBucket {
  label: string;
  qtd: number;
  valorNf: number;
  veiculos: EspecialVehicle[];
}

export interface EspecialResumo {
  qtd: number;
  valorNf: number;
  mediaDias: number | null;
  buckets: EspecialBucket[];
}

export interface GrupoResumo {
  qtd: number;
  valorNf: number;
  juros: number;
  mediaDias: number | null;
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
  porProdutoVendidos: ProdutoResult[];
  porProdutoNaoVendidos: ProdutoResult[];
  linhaEspecial: EspecialResumo;
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
  dataPLiq: number;
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
        dataPLiq: indexOf('datapliq'),
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

const EMPTY_GRUPO: GrupoResumo = { qtd: 0, valorNf: 0, juros: 0, mediaDias: null };

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
    porProdutoVendidos: [],
    porProdutoNaoVendidos: [],
    linhaEspecial: {
      qtd: 0,
      valorNf: 0,
      mediaDias: null,
      buckets: FAIXAS.map(f => ({ label: f.label, qtd: 0, valorNf: 0, veiculos: [] })),
    },
    veiculos: [],
    reconhecido: Boolean(detected),
  };

  if (!detected) return base;

  const { headerRow, rows, columns } = detected;
  const cell = (row: unknown[], index: number) => (index >= 0 ? row[index] : undefined);

  let somaDiasGeral = 0;
  let comDiasGeral = 0;
  let somaDiasVendidos = 0;
  let comDiasVendidos = 0;
  let somaDiasNaoVendidos = 0;
  let comDiasNaoVendidos = 0;
  let somaDiasCaixa = 0;

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
    const dataPLiq = parseDateCell(cell(row, columns.dataPLiq));
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
      if (vendido) {
        somaDiasVendidos += diasEstoque;
        comDiasVendidos += 1;
      } else {
        somaDiasNaoVendidos += diasEstoque;
        comDiasNaoVendidos += 1;
      }
    }

    // Linha especial (FP-CES-ESP): dias de caixa = Data p/ Liq. − Data da Venda.
    if (produto.toUpperCase() === PRODUTO_LINHA_ESPECIAL && dataVenda && dataPLiq) {
      const diasCaixa = Math.max(0, diffInDays(dataPLiq, dataVenda));
      const especialBucket = base.linhaEspecial.buckets[faixaIndex(diasCaixa)];
      especialBucket.qtd += 1;
      especialBucket.valorNf += valorNf;
      especialBucket.veiculos.push({ chassi, produto, valorNf, diasCaixa, dataVenda, dataPLiq });
      base.linhaEspecial.qtd += 1;
      base.linhaEspecial.valorNf += valorNf;
      somaDiasCaixa += diasCaixa;
    }
  }

  base.mediaDiasGeral = comDiasGeral > 0 ? somaDiasGeral / comDiasGeral : null;
  base.vendidos.mediaDias = comDiasVendidos > 0 ? somaDiasVendidos / comDiasVendidos : null;
  base.naoVendidos.mediaDias = comDiasNaoVendidos > 0 ? somaDiasNaoVendidos / comDiasNaoVendidos : null;
  base.linhaEspecial.mediaDias = base.linhaEspecial.qtd > 0 ? somaDiasCaixa / base.linhaEspecial.qtd : null;
  base.porProduto = groupByProduto(base.veiculos);
  base.porProdutoVendidos = groupByProduto(base.veiculos.filter(v => v.vendido));
  base.porProdutoNaoVendidos = groupByProduto(base.veiculos.filter(v => !v.vendido));

  return base;
}

function groupByProduto(vehicles: VehicleRow[]): ProdutoResult[] {
  const map = new Map<string, { qtd: number; valorNf: number; juros: number; somaDias: number; comDias: number }>();
  for (const v of vehicles) {
    const acc = map.get(v.produto) ?? { qtd: 0, valorNf: 0, juros: 0, somaDias: 0, comDias: 0 };
    acc.qtd += 1;
    acc.valorNf += v.valorNf;
    acc.juros += v.juros;
    if (v.diasEstoque !== null) {
      acc.somaDias += v.diasEstoque;
      acc.comDias += 1;
    }
    map.set(v.produto, acc);
  }
  return Array.from(map.entries())
    .map(([produto, acc]) => ({
      produto,
      qtd: acc.qtd,
      valorNf: acc.valorNf,
      juros: acc.juros,
      mediaDias: acc.comDias > 0 ? acc.somaDias / acc.comDias : null,
    }))
    .sort((a, b) => b.juros - a.juros);
}
