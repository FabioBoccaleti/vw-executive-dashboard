import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Copy, Calculator, Check, Lock, LockOpen, Pencil, Save, Search, TrendingUp, UserCheck, UserX, Wallet, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { loadVPecasRows, loadVPecasDevolucaoRows, type VPecasRow } from '@/components/VendasBonificacoesDashboard/vPecasStorage';
import { loadTaxaMLRows, type TaxaMLRow } from '@/components/VendasBonificacoesDashboard/taxaMercadoLivreStorage';
import { loadTaxaEPecasRows, type TaxaEPecasRow } from '@/components/VendasBonificacoesDashboard/taxaEPecasStorage';
import { loadProdutosRows } from '@/components/VendasBonificacoesDashboard/produtosMonitoradosStorage';
import type { VPecasItemRow } from '@/components/VendasBonificacoesDashboard/vPecasItemStorage';
import { kvGet, kvSet } from '@/lib/kvClient';
import { toast } from 'sonner';
import { loadVendedores, type Vendedor as CadastroVendedor } from '@/components/CadastrosPage/cadastrosStorage';
import {
  findLatestSalariosPeriod,
  loadSalariosFixos,
  type SalarioFuncionario,
} from '@/components/FolhaPagamentoDashboard/salariosFixosStorage';
import {
  calculoPeriodoKey,
  loadCalculoPosVendasPeriodos,
  loadCalculoPosVendasRemuneracoes,
  saveCalculoPosVendasPeriodos,
  saveCalculoPosVendasRemuneracoes,
  upsertCalculoPosVendasRemuneracao,
  type CalculoPosVendasPeriodo,
  type DepartamentoColaborador,
  type CalculoPosVendasRemuneracao,
} from './calculoPosVendasStorage';

type VendasSubTab = 'pecas' | 'oficina' | 'funilaria' | 'acessorios' | 'produto' | 'mecanicos';
type DemonstrativoSubTab = 'pecas' | 'oficina' | 'funilaria' | 'acessorios';
type MainTab = 'vendas' | 'calculo' | 'demonstrativo';
type CalculoAba = 'cadastrados' | 'pendentes';

interface CalculoComissoesVWPosVendasPageProps {
  onBack: () => void;
}

interface PecasOverride {
  condPgto: string;
}

interface CalculoVendorCard {
  vendedor: string;
  registros: number;
  fontes: string[];
  record?: CalculoPosVendasRemuneracao;
}

interface BonusEscalaDraft {
  id: string;
  de: string;
  ate: string;
  bonus: string;
}

interface CalculoValorResumo {
  basePecas: number;
  baseRps: number;
  baseTotalPecas: number;
  basePecasVendas: number;
  baseAcessorios: number;
  baseProdutos: number;
  baseRpsOficina: number;
  baseRpsFunilaria: number;
  baseMecanicos: number;
  bonus: number;
  comissao: number;
  total: number;
  volumeLiquido: number;
  bonusRegra: string;
  filtros: string;
}

const OV_KEY = 'vendas_pecas_vendas_ov';
const MECANICOS_KEY = 'calculo_comissoes_vw_pos_vendas_mecanicos';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const UNLOCK_PASSWORD = '1985';

function toIsoDate(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultApuracaoPeriodo(year: number, month: number): CalculoPosVendasPeriodo {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return {
    de: toIsoDate(first),
    ate: toIsoDate(last),
    bloqueado: false,
  };
}

function parseDateInput(value: string): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d);
  }
  const normalized = raw.split(' ')[0];
  if (/^\d{2}\/\d{2}\/\d{4}/.test(normalized)) {
    const [d, m, y] = normalized.split('/').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d);
  }
  return null;
}

function rowDateForCalculo(origem: string, data: Record<string, string>, fallbackPeriodo: { year: number; month: number } | null): Date | null {
  const candidates = origem === 'Produto' || origem === 'Mecânicos'
    ? [data['DTA_ENTRADA_SAIDA'], data['DATA'], data['DTA_DOCUMENTO']]
    : [data['DTA_ENTRADA_SAIDA'], data['DTA_DOCUMENTO']];

  for (const candidate of candidates) {
    const parsed = parseDateInput(String(candidate ?? ''));
    if (parsed) return parsed;
  }

  if (!fallbackPeriodo) return null;
  return new Date(fallbackPeriodo.year, fallbackPeriodo.month - 1, 1);
}

const TABLE_TABS: VendasSubTab[] = ['pecas', 'oficina', 'funilaria', 'acessorios', 'produto'];

const TABLE_COLUMNS = [
  'NF',
  'Série',
  'Transação',
  'Data Venda',
  'Departamento',
  'Vendedor',
  'Cond. Pagamento',
  'Cliente',
  'Valor Venda',
  'ISS',
  'ICMS',
  'PIS',
  'COFINS',
  'Difal',
  'Rec. Líquida',
  'Taxa Mercado Livre',
  'Taxa E-Peças',
  'Custo Médio',
  'Lucro Bruto',
  'LB %',
  'Valor Comissão',
  'Situação da Comissão',
  'Data Pgto Comissão',
] as const;

const PRODUCT_TABLE_COLUMNS = [
  'NF',
  'Data',
  'Tipo',
  'Depto',
  'Vendedor',
  'Cliente',
  'Código',
  'Descrição',
  'Qtde',
  'Val. Unitário',
  'Val. Venda',
  'Val. Impostos',
  'Rec. Líquida',
  'Custo Médio',
  'Lucro Bruto',
  '% Lucro Bruto',
  'Valor Comissão',
  'Situação da Comissão',
  'Data Pgto Comissão',
] as const;

const VENDAS_SUB_TABS: Array<{ id: VendasSubTab; label: string }> = [
  { id: 'pecas', label: 'Peças' },
  { id: 'oficina', label: 'Oficina' },
  { id: 'funilaria', label: 'Funilaria' },
  { id: 'acessorios', label: 'Acessórios' },
  { id: 'produto', label: 'Produto' },
  { id: 'mecanicos', label: 'Mecânicos' },
];

const DEMONSTRATIVO_SUB_TABS: Array<{ id: DemonstrativoSubTab; label: string }> = [
  { id: 'pecas', label: 'Peças' },
  { id: 'oficina', label: 'Oficina' },
  { id: 'funilaria', label: 'Funilaria' },
  { id: 'acessorios', label: 'Acessórios' },
];

const DEPARTAMENTO_COLABORADOR_OPTIONS: Array<{ value: Exclude<DepartamentoColaborador, ''>; label: string }> = [
  { value: 'pecas', label: 'Peças' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'funilaria', label: 'Funilaria' },
  { value: 'acessorios', label: 'Acessórios' },
];

function n(v: string | undefined): number {
  return parseFloat(String(v ?? '').replace(',', '.')) || 0;
}

function fmtCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPercent(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

function rowPeriod(row: VPecasRow): { year: number; month: number } | null {
  if (row.periodoImport) {
    const [y, m] = row.periodoImport.split('-').map(Number);
    if (y > 2000 && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const dtaDoc = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dtaDoc)) {
    return { year: parseInt(dtaDoc.split('/')[2], 10), month: parseInt(dtaDoc.split('/')[1], 10) };
  }
  const dtaEnt = row.data['DTA_ENTRADA_SAIDA'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dtaEnt)) {
    return { year: parseInt(dtaEnt.split('/')[2], 10), month: parseInt(dtaEnt.split('/')[1], 10) };
  }
  return null;
}

function productRowPeriod(row: VPecasItemRow): { year: number; month: number } | null {
  if (row.periodoImport) {
    const [y, m] = row.periodoImport.split('-').map(Number);
    if (y > 2000 && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const dta = row.data['DTA_ENTRADA_SAIDA'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dta)) {
    return { year: parseInt(dta.split('/')[2], 10), month: parseInt(dta.split('/')[1], 10) };
  }
  return null;
}

function parsePeriodoKey(value: string): { year: number; month: number } | null {
  const [yearRaw, monthRaw] = String(value ?? '').split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || year < 2000 || month < 1 || month > 12) return null;
  return { year, month };
}

function normalizeVendorName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeFieldKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function vendorKey(value: string): string {
  return normalizeVendorName(value).toLowerCase();
}

function extractVendorNames(data: Record<string, string>): string[] {
  const fieldMap = new Map<string, string>();
  Object.entries(data).forEach(([key, value]) => {
    fieldMap.set(normalizeFieldKey(key), String(value ?? ''));
  });

  const pick = (...aliases: string[]) => {
    for (const alias of aliases) {
      const found = fieldMap.get(normalizeFieldKey(alias));
      if (found !== undefined) return found;
    }
    return '';
  };

  const looksNumericCode = (value: string) => {
    const trimmed = normalizeVendorName(value);
    if (!trimmed) return false;
    return /^\d+[\d.,\s]*$/.test(trimmed);
  };

  const hasLetters = (value: string) => /[A-Za-zÀ-ÿ]/.test(value);

  const chooseBestName = (...values: string[]) => {
    const normalized = values
      .map((value) => normalizeVendorName(String(value ?? '')))
      .filter((value) => value.length > 0);
    if (normalized.length === 0) return '';

    const textual = normalized.filter((value) => hasLetters(value) && !looksNumericCode(value));
    if (textual.length > 0) {
      return textual.sort((a, b) => b.length - a.length)[0];
    }

    const withLetters = normalized.filter((value) => hasLetters(value));
    if (withLetters.length > 0) {
      return withLetters.sort((a, b) => b.length - a.length)[0];
    }

    return normalized[0];
  };

  const candidates = [
    chooseBestName(
      pick('NOME_VENDEDOR'),
      pick('VENDEDOR'),
      pick('NOME_CONSULTOR'),
      pick('CONSULTOR'),
    ),
    chooseBestName(
      pick('NOME_VENDEDOR2'),
      pick('VENDEDOR2'),
      pick('NOME_CONSULTOR2'),
      pick('CONSULTOR2'),
    ),
    chooseBestName(
      pick('MECANICO', 'MECÂNICO', 'Mecanico', 'Mecânico'),
      pick('NOME_MECANICO', 'NOME_MECÂNICO', 'Nome Mecanico', 'Nome Mecânico'),
    ),
  ]
    .map((value) => normalizeVendorName(value))
    .filter((value) => value.length > 0);

  const seen = new Set<string>();
  const unique: string[] = [];
  candidates.forEach((value) => {
    const key = vendorKey(value);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(value);
  });

  return unique;
}

function getSourceLabelFromRow(data: Record<string, string>, fallback: string): string {
  const serie = (data['SERIE_NOTA_FISCAL'] ?? '').trim().toUpperCase();
  if (fallback === 'Vendas' && serie === 'RPS') return 'RPS';
  return fallback;
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

function vendorCodeLookupKeys(value: string): string[] {
  const normalized = normalizeVendorName(value).toLowerCase();
  if (!normalized) return [];

  const keys = new Set<string>();
  keys.add(normalized);

  const compact = normalized.replace(/\s+/g, '');
  if (compact) keys.add(compact);

  const digitsOnly = normalized.replace(/\D+/g, '');
  if (digitsOnly) {
    keys.add(digitsOnly);
    const digitsAsNumber = Number.parseInt(digitsOnly, 10);
    if (Number.isFinite(digitsAsNumber)) {
      keys.add(String(digitsAsNumber));
    }
  }

  const parsed = parseFlexibleNumber(normalized);
  if (parsed !== null) {
    const rounded = Math.round(parsed);
    if (Math.abs(parsed - rounded) < 1e-9) {
      keys.add(String(rounded));
    } else {
      keys.add(String(parsed));
    }
  }

  return [...keys];
}

function createBonusEscalaDraft(): BonusEscalaDraft {
  return { id: crypto.randomUUID(), de: '', ate: '', bonus: '' };
}

function cleanBonusEscalas(value: BonusEscalaDraft[]): BonusEscalaDraft[] {
  return value
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      de: String(item.de ?? '').trim(),
      ate: String(item.ate ?? '').trim(),
      bonus: String(item.bonus ?? '').trim(),
    }))
    .filter((item) => item.de || item.ate || item.bonus);
}

function parseDecimal(value: string): number {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowAmountForCalculo(origem: string, data: Record<string, string>): number {
  if (origem === 'Produto' || origem === 'Mecânicos') return Math.abs(n(data['VAL_VENDA']));
  if (origem === 'Oficina RPS') {
    return Math.abs(n(data['LIQ_NOTA_FISCAL']) + n(data['VAL_PIS_ST']) + n(data['VAL_COFINS_ST']) + n(data['VAL_CSLL']));
  }
  return Math.abs(n(data['LIQ_NOTA_FISCAL']));
}

function isTransacaoDevolucao(value: string): boolean {
  const normalized = normalizeFieldKey(value);
  if (!normalized) return false;
  return normalized.includes('DEVOL') || normalized.endsWith('07') || normalized === 'D';
}

function firstMatchingFaixa(volumeLiquido: number, faixas: BonusEscalaDraft[]): BonusEscalaDraft | null {
  return faixas.find((faixa) => {
    const de = parseDecimal(faixa.de);
    const ateRaw = String(faixa.ate ?? '').trim();
    const ate = ateRaw === '' ? Number.POSITIVE_INFINITY : parseDecimal(ateRaw);
    return volumeLiquido >= de && volumeLiquido <= ate;
  }) ?? null;
}

function isBlankCell(value: unknown): boolean {
  return String(value ?? '').trim() === '';
}

function parseFlexibleNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');

  let normalized = trimmed;
  if (hasComma && hasDot) {
    const lastComma = trimmed.lastIndexOf(',');
    const lastDot = trimmed.lastIndexOf('.');
    normalized = lastComma > lastDot
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed.replace(/,/g, '');
  } else if (hasComma) {
    normalized = trimmed.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatExcelCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (value instanceof Date) {
    return value.toLocaleDateString('pt-BR');
  }
  return String(value).trim();
}

function formatMecanicosCell(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '—';
  const parsed = parseFlexibleNumber(trimmed);
  if (parsed !== null) return parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return trimmed;
}

interface MecanicosStore {
  columns: string[];
  rows: VPecasItemRow[];
}

function normalizeMecanicosStore(raw: unknown): MecanicosStore {
  const normalizeRow = (item: Record<string, unknown>): VPecasItemRow => {
    if (item.data && typeof item.data === 'object') return item as unknown as VPecasItemRow;
    const { id, periodoImport, highlight, annotation, ...fields } = item;
    return {
      id: String(id ?? crypto.randomUUID()),
      periodoImport: periodoImport as string | undefined,
      highlight: highlight as boolean | undefined,
      annotation: annotation as string | undefined,
      data: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value ?? '')])),
    };
  };

  if (Array.isArray(raw)) {
    const rows = raw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map(normalizeRow);
    const columns = rows[0]
      ? Object.keys(rows[0].data).filter((column) => rows.some((row) => !isBlankCell(row.data[column])))
      : [];
    return { columns, rows };
  }

  if (raw && typeof raw === 'object') {
    const store = raw as { columns?: unknown; rows?: unknown };
    const rows = Array.isArray(store.rows)
      ? store.rows
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          .map(normalizeRow)
      : [];
    const columns = Array.isArray(store.columns)
      ? store.columns.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : rows[0]
        ? Object.keys(rows[0].data)
        : [];
    const prunedColumns = columns.filter((column) => rows.some((row) => !isBlankCell(row.data[column])));
    return { columns: prunedColumns, rows };
  }

  return { columns: [], rows: [] };
}

function parseMecanicosExcel(buffer: ArrayBuffer): MecanicosStore {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { columns: [], rows: [] };
  const worksheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' }) as unknown[][];
  const headers = (raw[0] ?? []).map((header) => String(header ?? '').trim());
  const normalizedHeaders = headers.filter((header) => header.length > 0);

  if (normalizedHeaders.length === 0) return { columns: [], rows: [] };

  const valuesByColumn = normalizedHeaders.map(() => [] as string[]);

  const rows: VPecasItemRow[] = [];
  for (let index = 1; index < raw.length; index += 1) {
    const values = raw[index] ?? [];
    const hasContent = values.some((value) => formatExcelCellValue(value).length > 0);
    if (!hasContent) continue;
    const data: Record<string, string> = {};
    normalizedHeaders.forEach((header, headerIndex) => {
      const formattedValue = formatExcelCellValue(values[headerIndex]);
      data[header] = formattedValue;
      if (formattedValue) valuesByColumn[headerIndex].push(formattedValue);
    });
    const firstValue = data[normalizedHeaders[0]] ?? '';
    const otherValues = normalizedHeaders.slice(1).map((header) => data[header] ?? '');
    const rowIsEmpty = isBlankCell(firstValue) && otherValues.every((value) => {
      const normalized = String(value ?? '').trim();
      if (isBlankCell(normalized)) return true;
      const parsed = parseFlexibleNumber(normalized);
      return parsed !== null && parsed === 0;
    });
    if (rowIsEmpty) continue;
    rows.push({ id: crypto.randomUUID(), data });
  }

  const columns = normalizedHeaders.filter((header, index) => valuesByColumn[index]?.some((value) => !isBlankCell(value)));
  return { columns, rows };
}

function latestPeriod(rows: VPecasRow[]): { year: number; month: number } {
  const current = new Date();
  const periods = rows
    .map((row) => rowPeriod(row))
    .filter((period): period is { year: number; month: number } => Boolean(period));

  if (periods.length === 0) {
    return { year: current.getFullYear(), month: current.getMonth() + 1 };
  }

  return periods.reduce((best, period) => {
    if (period.year > best.year) return period;
    if (period.year === best.year && period.month > best.month) return period;
    return best;
  });
}

function ovKey(d: Record<string, string>): string {
  return `${d['NUMERO_NOTA_FISCAL'] ?? ''}_${d['SERIE_NOTA_FISCAL'] ?? ''}_${d['DTA_DOCUMENTO'] ?? ''}`;
}

export function CalculoComissoesVWPosVendasPage({ onBack }: CalculoComissoesVWPosVendasPageProps) {
  const [mainTab, setMainTab] = useState<MainTab>('vendas');
  const [vendasSubTab, setVendasSubTab] = useState<VendasSubTab>('pecas');
  const [demonstrativoSubTab, setDemonstrativoSubTab] = useState<DemonstrativoSubTab>('pecas');
  const [demonstrativoFilter, setDemonstrativoFilterState] = useState<{ year: number; month: number | null }>(() => {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    return { year, month };
  });
  const [demonstrativoPrintMode, setDemonstrativoPrintMode] = useState<'atual' | 'todos'>('atual');
  const [allRows, setAllRows] = useState<VPecasRow[]>([]);
  const [allPecasRows, setAllPecasRows] = useState<VPecasRow[]>([]);
  const [taxaMLRows, setTaxaMLRows] = useState<TaxaMLRow[]>([]);
  const [taxaEPRows, setTaxaEPRows] = useState<TaxaEPecasRow[]>([]);
  const [produtoRows, setProdutoRows] = useState<VPecasItemRow[]>([]);
  const [mecanicosRows, setMecanicosRows] = useState<VPecasItemRow[]>([]);
  const [mecanicosColumns, setMecanicosColumns] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, PecasOverride>>({});
  const [loading, setLoading] = useState(true);
  const [pecasFilterYear, setPecasFilterYear] = useState(new Date().getFullYear());
  const [pecasFilterMonth, setPecasFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [oficinaFilterYear, setOficinaFilterYear] = useState(new Date().getFullYear());
  const [oficinaFilterMonth, setOficinaFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [funilariaFilterYear, setFunilariaFilterYear] = useState(new Date().getFullYear());
  const [funilariaFilterMonth, setFunilariaFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [acessoriosFilterYear, setAcessoriosFilterYear] = useState(new Date().getFullYear());
  const [acessoriosFilterMonth, setAcessoriosFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [produtoFilterYear, setProdutoFilterYear] = useState(new Date().getFullYear());
  const [produtoFilterMonth, setProdutoFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [mecanicosFilterYear, setMecanicosFilterYear] = useState(new Date().getFullYear());
  const [mecanicosFilterMonth, setMecanicosFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [calculoYear, setCalculoYear] = useState(new Date().getFullYear());
  const [calculoMonth, setCalculoMonth] = useState<number>(new Date().getMonth() + 1);
  const [calculoAba, setCalculoAba] = useState<CalculoAba>('cadastrados');
  const [calculoPeriodos, setCalculoPeriodos] = useState<Record<string, CalculoPosVendasPeriodo>>({});
  const [calculoRemuneracoes, setCalculoRemuneracoes] = useState<CalculoPosVendasRemuneracao[]>([]);
  const [calculoLoading, setCalculoLoading] = useState(true);
  const [calculoSaving, setCalculoSaving] = useState(false);
  const [calculoPeriodoSaving, setCalculoPeriodoSaving] = useState(false);
  const [calculoBuscaPeriodo, setCalculoBuscaPeriodo] = useState<{ de: string; ate: string } | null>(null);
  const [calculoBuscaAtiva, setCalculoBuscaAtiva] = useState(false);
  const [calculoModalOpen, setCalculoModalOpen] = useState(false);
  const [calculoDraft, setCalculoDraft] = useState<CalculoPosVendasRemuneracao | null>(null);
  const [cadastroVendedores, setCadastroVendedores] = useState<CadastroVendedor[]>([]);
  const [salariosVwFuncionarios, setSalariosVwFuncionarios] = useState<SalarioFuncionario[]>([]);
  const mecanicosInputRef = useRef<HTMLInputElement>(null);
  const [pendingMecanicosImport, setPendingMecanicosImport] = useState<{
    rows: VPecasItemRow[];
    columns: string[];
    periodLabel: string;
  } | null>(null);
  const [confirmDeleteMecanicos, setConfirmDeleteMecanicos] = useState(false);
  const [openVendorKeys, setOpenVendorKeys] = useState<string[]>([]);
  const [openDepartmentKeys, setOpenDepartmentKeys] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([loadVPecasRows(), loadVPecasDevolucaoRows(), loadTaxaMLRows(), loadTaxaEPecasRows(), loadProdutosRows(), kvGet(OV_KEY), kvGet(MECANICOS_KEY)]).then(
      ([rows, devol, taxaMl, taxaEp, produtos, rawOverrides, rawMecanicos]) => {
        const combined = [...rows, ...devol].filter((r) => r.data['SERIE_NOTA_FISCAL'] !== 'RPS');
        const combinedRaw = [...rows, ...devol];
        setAllRows(combinedRaw);
        setAllPecasRows(combined);
        setTaxaMLRows(taxaMl as TaxaMLRow[]);
        setTaxaEPRows(taxaEp as TaxaEPecasRow[]);
        setProdutoRows(produtos as VPecasItemRow[]);
        const mecanicosStore = normalizeMecanicosStore(rawMecanicos);
        setMecanicosRows(mecanicosStore.rows);
        setMecanicosColumns(mecanicosStore.columns);
        const mecanicosPeriods = mecanicosStore.rows
          .map((row) => productRowPeriod(row))
          .filter((period): period is { year: number; month: number } => Boolean(period));
        if (mecanicosPeriods.length > 0) {
          const latestMecanicos = mecanicosPeriods.reduce((best, period) => {
            if (period.year > best.year) return period;
            if (period.year === best.year && period.month > best.month) return period;
            return best;
          });
          setMecanicosFilterYear(latestMecanicos.year);
          setMecanicosFilterMonth(latestMecanicos.month);
        }
        if (rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides)) {
          setOverrides(rawOverrides as Record<string, PecasOverride>);
        }
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    Promise.all([loadCalculoPosVendasRemuneracoes(), loadCalculoPosVendasPeriodos()]).then(([items, periodos]) => {
      setCalculoRemuneracoes(items);
      setCalculoPeriodos(periodos);
      setCalculoLoading(false);
    });
  }, []);

  useEffect(() => {
    loadVendedores().then((items) => {
      setCadastroVendedores(
        [...items].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
      );
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadVwSalariosFallback() {
      const currentPeriodRows = await loadSalariosFixos('vw', calculoYear, calculoMonth);
      if (cancelled) return;

      if (currentPeriodRows.length > 0) {
        setSalariosVwFuncionarios(currentPeriodRows);
        return;
      }

      const latestPeriod = await findLatestSalariosPeriod();
      if (cancelled) return;
      if (!latestPeriod) {
        setSalariosVwFuncionarios([]);
        return;
      }

      const latestRows = await loadSalariosFixos('vw', latestPeriod.year, latestPeriod.month);
      if (cancelled) return;
      setSalariosVwFuncionarios(latestRows);
    }

    loadVwSalariosFallback();
    return () => {
      cancelled = true;
    };
  }, [calculoYear, calculoMonth]);

  const oficinaBaseRows = useMemo(
    () => allRows.filter((row) => {
      const dept = (row.data['DEPARTAMENTO'] ?? '').trim();
      return row.data['SERIE_NOTA_FISCAL'] === 'RPS' && ['104', '122'].includes(dept);
    }),
    [allRows],
  );

  const funilariaBaseRows = useMemo(
    () => allRows.filter((row) => {
      const dept = (row.data['DEPARTAMENTO'] ?? '').trim();
      return row.data['SERIE_NOTA_FISCAL'] === 'RPS' && ['106', '129'].includes(dept);
    }),
    [allRows],
  );

  const acessoriosBaseRows = useMemo(
    () => allPecasRows.filter((row) => (row.data['DEPARTAMENTO'] ?? '').trim() === '107'),
    [allPecasRows],
  );

  const demonstrativoBaseRows = useMemo<Record<DemonstrativoSubTab, VPecasRow[]>>(
    () => ({
      pecas: allPecasRows,
      oficina: oficinaBaseRows,
      funilaria: funilariaBaseRows,
      acessorios: acessoriosBaseRows,
    }),
    [allPecasRows, oficinaBaseRows, funilariaBaseRows, acessoriosBaseRows],
  );

  useEffect(() => {
    if (!loading && oficinaBaseRows.length > 0) {
      const latestOfficePeriod = latestPeriod(oficinaBaseRows);
      setOficinaFilterYear(latestOfficePeriod.year);
      setOficinaFilterMonth(latestOfficePeriod.month);
    }
  }, [loading, oficinaBaseRows]);

  useEffect(() => {
    if (vendasSubTab === 'oficina' && oficinaBaseRows.length > 0) {
      const latestOfficePeriod = latestPeriod(oficinaBaseRows);
      setOficinaFilterYear(latestOfficePeriod.year);
      setOficinaFilterMonth(latestOfficePeriod.month);
    }
  }, [vendasSubTab, oficinaBaseRows]);

  useEffect(() => {
    if (!loading && funilariaBaseRows.length > 0) {
      const latestFunilariaPeriod = latestPeriod(funilariaBaseRows);
      setFunilariaFilterYear(latestFunilariaPeriod.year);
      setFunilariaFilterMonth(latestFunilariaPeriod.month);
    }
  }, [loading, funilariaBaseRows]);

  useEffect(() => {
    if (vendasSubTab === 'funilaria' && funilariaBaseRows.length > 0) {
      const latestFunilariaPeriod = latestPeriod(funilariaBaseRows);
      setFunilariaFilterYear(latestFunilariaPeriod.year);
      setFunilariaFilterMonth(latestFunilariaPeriod.month);
    }
  }, [vendasSubTab, funilariaBaseRows]);

  useEffect(() => {
    if (!loading && acessoriosBaseRows.length > 0) {
      const latestAcessoriosPeriod = latestPeriod(acessoriosBaseRows);
      setAcessoriosFilterYear(latestAcessoriosPeriod.year);
      setAcessoriosFilterMonth(latestAcessoriosPeriod.month);
    }
  }, [loading, acessoriosBaseRows]);

  useEffect(() => {
    if (vendasSubTab === 'acessorios' && acessoriosBaseRows.length > 0) {
      const latestAcessoriosPeriod = latestPeriod(acessoriosBaseRows);
      setAcessoriosFilterYear(latestAcessoriosPeriod.year);
      setAcessoriosFilterMonth(latestAcessoriosPeriod.month);
    }
  }, [vendasSubTab, acessoriosBaseRows]);

  useEffect(() => {
    if (!loading && produtoRows.length > 0) {
      const periods = produtoRows
        .map((row) => productRowPeriod(row))
        .filter((period): period is { year: number; month: number } => Boolean(period));
      if (periods.length > 0) {
        const latest = periods.reduce((best, period) => {
          if (period.year > best.year) return period;
          if (period.year === best.year && period.month > best.month) return period;
          return best;
        });
        setProdutoFilterYear(latest.year);
        setProdutoFilterMonth(latest.month);
      }
    }
  }, [loading, produtoRows]);

  useEffect(() => {
    if (vendasSubTab === 'produto' && produtoRows.length > 0) {
      const periods = produtoRows
        .map((row) => productRowPeriod(row))
        .filter((period): period is { year: number; month: number } => Boolean(period));
      if (periods.length > 0) {
        const latest = periods.reduce((best, period) => {
          if (period.year > best.year) return period;
          if (period.year === best.year && period.month > best.month) return period;
          return best;
        });
        setProdutoFilterYear(latest.year);
        setProdutoFilterMonth(latest.month);
      }
    }
  }, [vendasSubTab, produtoRows]);

  const activeSourceRows = vendasSubTab === 'oficina'
    ? oficinaBaseRows
    : vendasSubTab === 'funilaria'
      ? funilariaBaseRows
      : vendasSubTab === 'acessorios'
        ? acessoriosBaseRows
      : allPecasRows;
  const activeFilterYear = vendasSubTab === 'oficina'
    ? oficinaFilterYear
    : vendasSubTab === 'funilaria'
      ? funilariaFilterYear
      : vendasSubTab === 'acessorios'
        ? acessoriosFilterYear
      : pecasFilterYear;
  const activeFilterMonth = vendasSubTab === 'oficina'
    ? oficinaFilterMonth
    : vendasSubTab === 'funilaria'
      ? funilariaFilterMonth
      : vendasSubTab === 'acessorios'
        ? acessoriosFilterMonth
      : pecasFilterMonth;
  const setActiveFilterYear = vendasSubTab === 'oficina'
    ? setOficinaFilterYear
    : vendasSubTab === 'funilaria'
      ? setFunilariaFilterYear
      : vendasSubTab === 'acessorios'
        ? setAcessoriosFilterYear
      : setPecasFilterYear;
  const setActiveFilterMonth = vendasSubTab === 'oficina'
    ? setOficinaFilterMonth
    : vendasSubTab === 'funilaria'
      ? setFunilariaFilterMonth
      : vendasSubTab === 'acessorios'
        ? setAcessoriosFilterMonth
      : setPecasFilterMonth;

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    activeSourceRows.forEach((row) => {
      const period = rowPeriod(row);
      if (period) years.add(period.year);
    });
    const current = new Date().getFullYear();
    [current - 1, current, current + 1].forEach((y) => years.add(y));
    return [...years].sort();
  }, [activeSourceRows]);

  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    activeSourceRows.forEach((row) => {
      const period = rowPeriod(row);
      if (!period || period.year !== activeFilterYear) return;
      counts[period.month] = (counts[period.month] || 0) + 1;
    });
    return counts;
  }, [activeSourceRows, activeFilterYear]);

  const filteredPecasRows = useMemo(() => {
    return activeSourceRows.filter((row) => {
      const period = rowPeriod(row);
      if (!period) return false;
      if (period.year !== activeFilterYear) return false;
      if (activeFilterMonth !== null && period.month !== activeFilterMonth) return false;
      return true;
    });
  }, [activeSourceRows, activeFilterMonth, activeFilterYear]);

  const taxaMLLookup = useMemo(() => {
    const periodo = activeFilterMonth !== null ? `${activeFilterYear}-${String(activeFilterMonth).padStart(2, '0')}` : null;
    const filtered = periodo
      ? taxaMLRows.filter((row) => row.periodoImport === periodo)
      : taxaMLRows.filter((row) => {
          const p = row.periodoImport?.split('-').map(Number);
          return !!p && p[0] === activeFilterYear;
        });
    const map = new Map<string, TaxaMLRow>();
    filtered.forEach((row) => {
      const titulo = row.data['TITULO'];
      if (titulo) map.set(titulo, row);
    });
    return map;
  }, [taxaMLRows, activeFilterMonth, activeFilterYear]);

  const taxaEPLookup = useMemo(() => {
    const periodo = activeFilterMonth !== null ? `${activeFilterYear}-${String(activeFilterMonth).padStart(2, '0')}` : null;
    const filtered = periodo
      ? taxaEPRows.filter((row) => row.periodoImport === periodo)
      : taxaEPRows.filter((row) => {
          const p = row.periodoImport?.split('-').map(Number);
          return !!p && p[0] === activeFilterYear;
        });
    const map = new Map<string, number>();
    filtered.forEach((row) => {
      const titulo = row.data['TITULO'];
      if (titulo) map.set(titulo, (map.get(titulo) ?? 0) + n(row.data['VAL_TITULO']));
    });
    return map;
  }, [taxaEPRows, activeFilterMonth, activeFilterYear]);

  const isServiceLoading = (vendasSubTab === 'oficina' || vendasSubTab === 'funilaria') && loading;
  const showDateFilters = vendasSubTab === 'pecas' || vendasSubTab === 'oficina' || vendasSubTab === 'funilaria' || vendasSubTab === 'acessorios' || vendasSubTab === 'produto';
  const serviceTabLabel = vendasSubTab === 'oficina' ? 'Oficina' : vendasSubTab === 'funilaria' ? 'Funilaria' : '';
  const isProdutoTab = vendasSubTab === 'produto';

  const produtoAvailableYears = useMemo(() => {
    const years = new Set<number>();
    produtoRows.forEach((row) => {
      const period = productRowPeriod(row);
      if (period) years.add(period.year);
    });
    const current = new Date().getFullYear();
    [current - 1, current, current + 1].forEach((y) => years.add(y));
    return [...years].sort();
  }, [produtoRows]);

  const produtoMonthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    produtoRows.forEach((row) => {
      const period = productRowPeriod(row);
      if (!period || period.year !== produtoFilterYear) return;
      counts[period.month] = (counts[period.month] || 0) + 1;
    });
    return counts;
  }, [produtoRows, produtoFilterYear]);

  const filteredProdutoRows = useMemo(() => {
    return produtoRows.filter((row) => {
      const period = productRowPeriod(row);
      if (!period) return false;
      if (period.year !== produtoFilterYear) return false;
      if (produtoFilterMonth !== null && period.month !== produtoFilterMonth) return false;
      return true;
    });
  }, [produtoRows, produtoFilterYear, produtoFilterMonth]);

  const pecasTotals = useMemo(() => {
    let valorVenda = 0;
    let iss = 0;
    let icms = 0;
    let pis = 0;
    let cofins = 0;
    let difal = 0;
    let recLiquida = 0;
    let taxaMercadoLivre = 0;
    let taxaEPecas = 0;
    let custoMedio = 0;
    let lucroBruto = 0;

    filteredPecasRows.forEach((row) => {
      const d = row.data;
      const venda = n(d['LIQ_NOTA_FISCAL']);
      const valIss = n(d['VAL_ISS']);
      const valIcms = n(d['VAL_ICMS']);
      const valPis = n(d['VAL_PIS']);
      const valCofins = n(d['VAL_COFINS']);
      const valDifal = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
      const valRecLiquida = venda - valIcms - valPis - valCofins - valDifal;
      const taxaMLMatch = taxaMLLookup.get(d['NUMERO_NOTA_FISCAL']);
      const tituloValML = taxaMLMatch?.data['VAL_TITULO'] ?? '';
      const valTaxaMercadoLivre = tituloValML ? venda - n(tituloValML) : 0;
      const epSum = taxaEPLookup.get(d['NUMERO_NOTA_FISCAL']) ?? 0;
      const valTaxaEPecas = epSum > 0 ? venda - epSum : 0;
      const valCustoMedio = n(d['TOT_CUSTO_MEDIO']);
      const valLucroBruto = valRecLiquida - valTaxaMercadoLivre - valTaxaEPecas - valCustoMedio;

      valorVenda += venda;
      iss += valIss;
      icms += valIcms;
      pis += valPis;
      cofins += valCofins;
      difal += valDifal;
      recLiquida += valRecLiquida;
      taxaMercadoLivre += valTaxaMercadoLivre;
      taxaEPecas += valTaxaEPecas;
      custoMedio += valCustoMedio;
      lucroBruto += valLucroBruto;
    });

    const lbPct = recLiquida !== 0 ? (lucroBruto / recLiquida) * 100 : 0;

    return {
      valorVenda,
      iss,
      icms,
      pis,
      cofins,
      difal,
      recLiquida,
      taxaMercadoLivre,
      taxaEPecas,
      custoMedio,
      lucroBruto,
      lbPct,
    };
  }, [filteredPecasRows, taxaEPLookup, taxaMLLookup]);

  const oficinaTotals = useMemo(() => {
    let valorVenda = 0;
    let iss = 0;
    let icms = 0;
    let pis = 0;
    let cofins = 0;
    let difal = 0;
    let recLiquida = 0;
    let taxaMercadoLivre = 0;
    let taxaEPecas = 0;
    let custoMedio = 0;
    let lucroBruto = 0;

    filteredPecasRows.forEach((row) => {
      const d = row.data;
      const venda = n(d['LIQ_NOTA_FISCAL']) + n(d['VAL_PIS_ST']) + n(d['VAL_COFINS_ST']) + n(d['VAL_CSLL']);
      const valIss = n(d['VAL_ISS']);
      const valIcms = n(d['VAL_ICMS']);
      const valPis = n(d['VAL_PIS']);
      const valCofins = n(d['VAL_COFINS']);
      const valDifal = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
      const valRecLiquida = venda - valIss - valIcms - valPis - valCofins - valDifal;
      const taxaMLMatch = taxaMLLookup.get(d['NUMERO_NOTA_FISCAL']);
      const tituloValML = taxaMLMatch?.data['VAL_TITULO'] ?? '';
      const valTaxaMercadoLivre = tituloValML ? venda - n(tituloValML) : 0;
      const epSum = taxaEPLookup.get(d['NUMERO_NOTA_FISCAL']) ?? 0;
      const valTaxaEPecas = epSum > 0 ? venda - epSum : 0;
      const valCustoMedio = n(d['TOT_CUSTO_MEDIO']);
      const valLucroBruto = valRecLiquida - valTaxaMercadoLivre - valTaxaEPecas - valCustoMedio;

      valorVenda += venda;
      iss += valIss;
      icms += valIcms;
      pis += valPis;
      cofins += valCofins;
      difal += valDifal;
      recLiquida += valRecLiquida;
      taxaMercadoLivre += valTaxaMercadoLivre;
      taxaEPecas += valTaxaEPecas;
      custoMedio += valCustoMedio;
      lucroBruto += valLucroBruto;
    });

    const lbPct = recLiquida !== 0 ? (lucroBruto / recLiquida) * 100 : 0;

    return {
      valorVenda,
      iss,
      icms,
      pis,
      cofins,
      difal,
      recLiquida,
      taxaMercadoLivre,
      taxaEPecas,
      custoMedio,
      lucroBruto,
      lbPct,
    };
  }, [filteredPecasRows, taxaEPLookup, taxaMLLookup]);

  const summaryByVendor = useMemo(() => {
    const map = new Map<string, VPecasRow[]>();
    filteredPecasRows.forEach((row) => {
      const vendor = row.data['NOME_VENDEDOR'] || 'Sem vendedor';
      map.set(vendor, [...(map.get(vendor) ?? []), row]);
    });
    return [...map.entries()]
      .map(([vendor, rows]) => ({
        vendor,
        total: rows.reduce((sum, row) => sum + n(row.data['LIQ_NOTA_FISCAL']), 0),
        count: rows.length,
        transactions: [...rows.reduce((txMap, row) => {
          const tx = row.data['TIPO_TRANSACAO'] || 'Sem transação';
          const current = txMap.get(tx) ?? { label: tx, total: 0, count: 0 };
          current.total += n(row.data['LIQ_NOTA_FISCAL']);
          current.count += 1;
          txMap.set(tx, current);
          return txMap;
        }, new Map<string, { label: string; total: number; count: number }>()).values()].sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPecasRows]);

  const summaryByDepartment = useMemo(() => {
    const map = new Map<string, VPecasRow[]>();
    filteredPecasRows.forEach((row) => {
      const dept = row.data['DEPARTAMENTO'] || 'Sem departamento';
      map.set(dept, [...(map.get(dept) ?? []), row]);
    });
    return [...map.entries()]
      .map(([department, rows]) => ({
        department,
        total: rows.reduce((sum, row) => sum + n(row.data['LIQ_NOTA_FISCAL']), 0),
        count: rows.length,
        transactions: [...rows.reduce((txMap, row) => {
          const tx = row.data['TIPO_TRANSACAO'] || 'Sem transação';
          const current = txMap.get(tx) ?? { label: tx, total: 0, count: 0 };
          current.total += n(row.data['LIQ_NOTA_FISCAL']);
          current.count += 1;
          txMap.set(tx, current);
          return txMap;
        }, new Map<string, { label: string; total: number; count: number }>()).values()].sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPecasRows]);

  const produtoSummaryByVendor = useMemo(() => {
    const map = new Map<string, VPecasItemRow[]>();
    filteredProdutoRows.forEach((row) => {
      const vendor = row.data['NOME_VENDEDOR'] || 'Sem vendedor';
      map.set(vendor, [...(map.get(vendor) ?? []), row]);
    });
    return [...map.entries()]
      .map(([vendor, rows]) => ({
        vendor,
        total: rows.reduce((sum, row) => sum + n(row.data['VAL_VENDA']), 0),
        count: rows.length,
        transactions: [...rows.reduce((txMap, row) => {
          const tx = row.data['TIPO_TRANSACAO'] || 'Sem transação';
          const current = txMap.get(tx) ?? { label: tx, total: 0, count: 0 };
          current.total += n(row.data['VAL_VENDA']);
          current.count += 1;
          txMap.set(tx, current);
          return txMap;
        }, new Map<string, { label: string; total: number; count: number }>()).values()].sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredProdutoRows]);

  const produtoSummaryByDepartment = useMemo(() => {
    const map = new Map<string, VPecasItemRow[]>();
    filteredProdutoRows.forEach((row) => {
      const dept = row.data['DEPARTAMENTO'] || 'Sem departamento';
      map.set(dept, [...(map.get(dept) ?? []), row]);
    });
    return [...map.entries()]
      .map(([department, rows]) => ({
        department,
        total: rows.reduce((sum, row) => sum + n(row.data['VAL_VENDA']), 0),
        count: rows.length,
        transactions: [...rows.reduce((txMap, row) => {
          const tx = row.data['TIPO_TRANSACAO'] || 'Sem transação';
          const current = txMap.get(tx) ?? { label: tx, total: 0, count: 0 };
          current.total += n(row.data['VAL_VENDA']);
          current.count += 1;
          txMap.set(tx, current);
          return txMap;
        }, new Map<string, { label: string; total: number; count: number }>()).values()].sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredProdutoRows]);

  const produtoTotals = useMemo(() => {
    let qtde = 0;
    let valUnitario = 0;
    let valVenda = 0;
    let valImpostos = 0;
    let recLiquida = 0;
    let custoMedio = 0;
    let lucroBruto = 0;

    filteredProdutoRows.forEach((row) => {
      const d = row.data;
      const quantidade = n(d['QUANTIDADE']);
      const unitario = n(d['VAL_UNITARIO']);
      const venda = n(d['VAL_VENDA']);
      const impostos = n(d['VAL_IMPOSTOS']);
      const rec = venda - impostos;
      const custo = n(d['CUSTO_MEDIO']);
      const lucro = rec - custo;

      qtde += quantidade;
      valUnitario += unitario;
      valVenda += venda;
      valImpostos += impostos;
      recLiquida += rec;
      custoMedio += custo;
      lucroBruto += lucro;
    });

    const lucroBrutoPct = recLiquida !== 0 ? (lucroBruto / recLiquida) * 100 : 0;

    return {
      qtde,
      valUnitario,
      valVenda,
      valImpostos,
      recLiquida,
      custoMedio,
      lucroBruto,
      lucroBrutoPct,
    };
  }, [filteredProdutoRows]);

  const calculoPeriodo = calculoPeriodoKey(calculoYear, calculoMonth);
  const calculoPeriodoData = calculoPeriodos[calculoPeriodo] ?? defaultApuracaoPeriodo(calculoYear, calculoMonth);
  const calculoBloqueado = Boolean(calculoPeriodoData.bloqueado);
  const calculoBuscaRange = useMemo(() => {
    if (!calculoBuscaPeriodo?.de || !calculoBuscaPeriodo?.ate) return null;
    const de = parseDateInput(calculoBuscaPeriodo.de);
    const ate = parseDateInput(calculoBuscaPeriodo.ate);
    if (!de || !ate) return null;
    return { de, ate };
  }, [calculoBuscaPeriodo]);
  const mecanicosSystemPeriodo = useMemo(() => {
    const now = new Date();
    return calculoPeriodoKey(now.getFullYear(), now.getMonth() + 1);
  }, []);
  const mecanicosBloqueado = Boolean(calculoPeriodos[mecanicosSystemPeriodo]?.bloqueado);

  const vendorLookup = useMemo(() => {
    const map = new Map<string, string>();
    const addEntry = (rawName: string, rawCode?: string) => {
      const name = normalizeVendorName(rawName);
      if (!name) return;
      map.set(normalizeCode(name), name);
      if (!rawCode) return;
      vendorCodeLookupKeys(rawCode).forEach((key) => {
        map.set(key, name);
      });
    };

    cadastroVendedores.forEach((item) => {
      addEntry(item.nome, item.codigo);
    });

    salariosVwFuncionarios.forEach((item) => {
      addEntry(item.nome, item.codigo);
    });

    return map;
  }, [cadastroVendedores, salariosVwFuncionarios]);

  function resolveVendorName(raw: string): string {
    const normalized = normalizeVendorName(raw);
    if (!normalized) return '';
    const byName = vendorLookup.get(normalizeCode(normalized));
    if (byName) return byName;
    for (const key of vendorCodeLookupKeys(normalized)) {
      const byCode = vendorLookup.get(key);
      if (byCode) return byCode;
    }
    return normalized;
  }

  const calculoSourceRows = useMemo(() => {
    const rows: Array<{ data: Record<string, string>; periodo: { year: number; month: number } | null; origem: string }> = [];

    allRows.forEach((row) => {
      const serie = String(row.data['SERIE_NOTA_FISCAL'] ?? '').trim().toUpperCase();
      const dept = String(row.data['DEPARTAMENTO'] ?? '').trim();
      let origem = 'Peças';

      if (serie === 'RPS') {
        if (['104', '122'].includes(dept)) origem = 'Oficina RPS';
        else if (['106', '129'].includes(dept)) origem = 'Funilaria RPS';
        else return;
      } else if (dept === '107') {
        origem = 'Acessórios';
      }

      rows.push({
        data: row.data,
        periodo: rowPeriod(row),
        origem,
      });
    });

    produtoRows.forEach((row) => {
      rows.push({
        data: row.data,
        periodo: productRowPeriod(row),
        origem: 'Produto',
      });
    });

    mecanicosRows.forEach((row) => {
      const period = productRowPeriod(row);
      rows.push({
        data: row.data,
        periodo: period,
        origem: 'Mecânicos',
      });
    });

    return rows.filter((row) => {
      if (!calculoBuscaAtiva) return false;
      if (!row.periodo) return false;
      if (row.origem === 'Mecânicos') {
        return row.periodo.year === calculoYear && row.periodo.month === calculoMonth;
      }

      if (!calculoBuscaRange) return true;
      const date = rowDateForCalculo(row.origem, row.data, row.periodo);
      if (!date) return false;
      return date >= calculoBuscaRange.de && date <= calculoBuscaRange.ate;
    });
  }, [allRows, produtoRows, mecanicosRows, calculoYear, calculoMonth, calculoBuscaRange, calculoBuscaAtiva]);

  const calculoVendors = useMemo<CalculoVendorCard[]>(() => {
    const map = new Map<string, { vendedor: string; registros: number; fontes: Set<string> }>();
    const addVendor = (name: string, source: string) => {
      const normalized = normalizeVendorName(name);
      if (!normalized) return;
      const key = vendorKey(normalized);
      const current = map.get(key) ?? { vendedor: normalized, registros: 0, fontes: new Set<string>() };
      current.vendedor = current.vendedor || normalized;
      current.registros += 1;
      current.fontes.add(source);
      map.set(key, current);
    };

    calculoSourceRows.forEach((row) => {
      extractVendorNames(row.data).forEach((name) => addVendor(resolveVendorName(name), row.origem));
    });

    const records = new Map(
      calculoRemuneracoes
        .filter((item) => item.periodo === calculoPeriodo)
        .map((item) => [vendorKey(item.vendedor), item] as const),
    );

    return [...map.values()]
      .map((item) => ({
        ...item,
        fontes: [...item.fontes].sort(),
        record: records.get(vendorKey(item.vendedor)),
      }))
      .sort((a, b) => a.vendedor.localeCompare(b.vendedor, 'pt-BR', { sensitivity: 'base' }));
  }, [calculoSourceRows, calculoRemuneracoes, calculoPeriodo, vendorLookup]);

  const calculoRegistered = useMemo(() => calculoVendors.filter((item) => Boolean(item.record)), [calculoVendors]);
  const calculoPending = useMemo(() => calculoVendors.filter((item) => !item.record), [calculoVendors]);

  const calculoValoresByVendor = useMemo(() => {
    const map = new Map<string, CalculoValorResumo>();
    calculoVendors.forEach((item) => {
      const record = item.record;
      if (!record || !record.ativo || !record.comissionado) {
        map.set(vendorKey(item.vendedor), {
          basePecas: 0,
          baseRps: 0,
          baseTotalPecas: 0,
          basePecasVendas: 0,
          baseAcessorios: 0,
          baseProdutos: 0,
          baseRpsOficina: 0,
          baseRpsFunilaria: 0,
          baseMecanicos: 0,
          bonus: 0,
          comissao: 0,
          total: parseDecimal(record?.salarioFixo ?? ''),
          volumeLiquido: 0,
          bonusRegra: 'Bônus inativo',
          filtros: 'Sem filtros aplicados',
        });
        return;
      }

      const deptFilter = new Set((record.departamentos ?? []).map((value) => normalizeFieldKey(value)));
      const txFilter = new Set((record.transacoes ?? []).map((value) => normalizeFieldKey(value)));
      const useDept = deptFilter.size > 0;
      const useTx = txFilter.size > 0;

      let basePecasVendas = 0;
      let baseAcessorios = 0;
      let baseProdutos = 0;
      let baseRpsOficina = 0;
      let baseRpsFunilaria = 0;
      let baseMecanicos = 0;
      let countVenda = 0;
      let countDevolucao = 0;

      calculoSourceRows.forEach((row) => {
        const vendors = extractVendorNames(row.data).map((name) => vendorKey(resolveVendorName(name)));
        if (!vendors.includes(vendorKey(item.vendedor))) return;

        const dept = normalizeFieldKey(String(row.data['DEPARTAMENTO'] ?? ''));
        const txRaw = String(row.data['TIPO_TRANSACAO'] ?? row.data['TRANSACAO'] ?? '');
        const tx = normalizeFieldKey(txRaw);
        if (useDept && !deptFilter.has(dept)) return;
        if (useTx && !txFilter.has(tx)) return;

        const isDevolucao = isTransacaoDevolucao(txRaw);
        const sign = record.descontarDevolucao && isDevolucao ? -1 : 1;
        const amount = sign * rowAmountForCalculo(row.origem, row.data);

        if (isDevolucao) countDevolucao += 1;
        else countVenda += 1;

        if (row.origem === 'Peças') basePecasVendas += amount;
        if (row.origem === 'Acessórios') baseAcessorios += amount;
        if (row.origem === 'Produto') baseProdutos += amount;
        if (row.origem === 'Oficina RPS') baseRpsOficina += amount;
        if (row.origem === 'Funilaria RPS') baseRpsFunilaria += amount;
        if (row.origem === 'Mecânicos') baseMecanicos += amount;
      });

      const basePecas = basePecasVendas + baseAcessorios + baseProdutos + baseMecanicos;
      const baseRps = baseRpsOficina + baseRpsFunilaria;
      const baseTotalPecas = basePecas;
      const pctPecas = parseDecimal(record.comissaoPecasPct);
      const pctRps = parseDecimal(record.comissaoRpsPct);
      const pctTotalPecas = parseDecimal(record.comissaoTotalPecasPct);
      const comissao =
        basePecas * (pctPecas / 100) +
        baseRps * (pctRps / 100) +
        baseTotalPecas * (pctTotalPecas / 100);

      const volumeLiquido = countVenda - countDevolucao;
      const faixas = cleanBonusEscalas((record.bonusEscalas ?? []) as BonusEscalaDraft[]);
      const faixaAtiva = firstMatchingFaixa(volumeLiquido, faixas);
      const bonus = faixaAtiva ? parseDecimal(faixaAtiva.bonus) : parseDecimal(record.bonusProdutividade);
      const salario = parseDecimal(record.salarioFixo);
      const bonusRegra = faixaAtiva
        ? `Faixa ${faixaAtiva.de || '0'}-${faixaAtiva.ate || 'em diante'} = R$ ${fmtCurrency(parseDecimal(faixaAtiva.bonus))}`
        : `Bônus fixo = R$ ${fmtCurrency(parseDecimal(record.bonusProdutividade))}`;
      const filtros = `${useDept ? `Departamentos: ${(record.departamentos ?? []).join(', ')}` : 'Departamentos: todos'} · ${useTx ? `Transações: ${(record.transacoes ?? []).join(', ')}` : 'Transações: todas'}`;

      map.set(vendorKey(item.vendedor), {
        basePecas,
        baseRps,
        baseTotalPecas,
        basePecasVendas,
        baseAcessorios,
        baseProdutos,
        baseRpsOficina,
        baseRpsFunilaria,
        baseMecanicos,
        bonus,
        comissao,
        total: salario + comissao + bonus,
        volumeLiquido,
        bonusRegra,
        filtros,
      });
    });
    return map;
  }, [calculoVendors, calculoSourceRows, vendorLookup]);

  const calculoRulesByVendor = useMemo(() => {
    const rules = new Map<string, { departamentos: Set<string>; transacoes: Set<string> }>();
    const getRule = (name: string) => {
      const key = vendorKey(name);
      const current = rules.get(key) ?? { departamentos: new Set<string>(), transacoes: new Set<string>() };
      rules.set(key, current);
      return current;
    };

    calculoSourceRows.forEach((row) => {
      const dept = normalizeVendorName(String(row.data['DEPARTAMENTO'] ?? ''));
      const tx = normalizeVendorName(String(row.data['TIPO_TRANSACAO'] ?? row.data['TRANSACAO'] ?? ''));
      const vendors = extractVendorNames(row.data).map((name) => resolveVendorName(name));
      vendors.forEach((name) => {
        if (!name) return;
        const target = getRule(name);
        if (dept) target.departamentos.add(dept);
        if (tx) target.transacoes.add(tx);
      });
    });

    return rules;
  }, [calculoSourceRows, vendorLookup]);

  const calculoDraftDepartamentos = useMemo(() => {
    if (!calculoDraft?.vendedor) return [];
    const byVendor = calculoRulesByVendor.get(vendorKey(calculoDraft.vendedor));
    const selected = calculoDraft.departamentos ?? [];
    const merged = new Set<string>([...(byVendor ? [...byVendor.departamentos] : []), ...selected]);
    return [...merged].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [calculoDraft, calculoRulesByVendor]);

  const calculoDraftTransacoes = useMemo(() => {
    if (!calculoDraft?.vendedor) return [];
    const byVendor = calculoRulesByVendor.get(vendorKey(calculoDraft.vendedor));
    const selected = calculoDraft.transacoes ?? [];
    const merged = new Set<string>([...(byVendor ? [...byVendor.transacoes] : []), ...selected]);
    return [...merged].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [calculoDraft, calculoRulesByVendor]);

  function openCalculoDraft(vendedor: string) {
    if (calculoBloqueado) {
      toast.warning('Período bloqueado. Desbloqueie para editar remunerações.');
      return;
    }
    const existing = calculoRemuneracoes.find(
      (item) => item.periodo === calculoPeriodo && vendorKey(item.vendedor) === vendorKey(vendedor),
    );
    const defaults = calculoRulesByVendor.get(vendorKey(vendedor));
    const departamentosDefault = defaults ? [...defaults.departamentos].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })) : [];
    const transacoesDefault = defaults ? [...defaults.transacoes].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })) : [];

    setCalculoDraft(
      existing
        ? {
            ...existing,
          departamentoColaborador: existing.departamentoColaborador ?? '',
          cargoColaborador: existing.cargoColaborador ?? '',
            comissaoPecasPct: existing.comissaoPecasPct ?? '',
            comissaoRpsPct: existing.comissaoRpsPct ?? '',
            comissaoTotalPecasPct: existing.comissaoTotalPecasPct ?? '',
            bonusProdutividade: existing.bonusProdutividade ?? '',
            departamentos: existing.departamentos?.length ? existing.departamentos : departamentosDefault,
            transacoes: existing.transacoes?.length ? existing.transacoes : transacoesDefault,
            bonusEscalas: existing.bonusEscalas?.length ? existing.bonusEscalas : [createBonusEscalaDraft()],
            descontarDevolucao: Boolean(existing.descontarDevolucao),
          }
        : {
            id: crypto.randomUUID(),
            periodo: calculoPeriodo,
            vendedor: normalizeVendorName(vendedor),
            departamentoColaborador: '',
            cargoColaborador: '',
            comissionado: false,
            salarioFixo: '',
            comissaoPecasPct: '',
            comissaoRpsPct: '',
            comissaoTotalPecasPct: '',
            bonusProdutividade: '',
            departamentos: departamentosDefault,
            transacoes: transacoesDefault,
            bonusEscalas: [createBonusEscalaDraft()],
            descontarDevolucao: false,
            ativo: true,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          },
    );
    setCalculoModalOpen(true);
  }

  function closeCalculoDraft() {
    setCalculoModalOpen(false);
    setCalculoDraft(null);
  }

  function toggleDraftListField(field: 'departamentos' | 'transacoes', value: string) {
    if (!calculoDraft) return;
    const normalized = normalizeVendorName(value);
    if (!normalized) return;
    const current = new Set(calculoDraft[field] ?? []);
    if (current.has(normalized)) current.delete(normalized);
    else current.add(normalized);
    setCalculoDraft({ ...calculoDraft, [field]: [...current].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })) });
  }

  function addBonusEscalaRow() {
    if (!calculoDraft) return;
    const next = [...(calculoDraft.bonusEscalas ?? []), createBonusEscalaDraft()];
    setCalculoDraft({ ...calculoDraft, bonusEscalas: next });
  }

  function removeBonusEscalaRow(id: string) {
    if (!calculoDraft) return;
    const next = (calculoDraft.bonusEscalas ?? []).filter((item) => item.id !== id);
    setCalculoDraft({ ...calculoDraft, bonusEscalas: next.length ? next : [createBonusEscalaDraft()] });
  }

  function updateBonusEscalaRow(id: string, field: 'de' | 'ate' | 'bonus', value: string) {
    if (!calculoDraft) return;
    const next = (calculoDraft.bonusEscalas ?? []).map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    ));
    setCalculoDraft({ ...calculoDraft, bonusEscalas: next });
  }

  function updateCalculoPeriodoField(field: 'de' | 'ate', value: string) {
    setCalculoPeriodos((prev) => ({
      ...prev,
      [calculoPeriodo]: {
        ...(prev[calculoPeriodo] ?? defaultApuracaoPeriodo(calculoYear, calculoMonth)),
        [field]: value,
      },
    }));
  }

  function buscarCalculoPeriodo() {
    const de = String(calculoPeriodoData.de ?? '').trim();
    const ate = String(calculoPeriodoData.ate ?? '').trim();
    if (!de || !ate) {
      toast.warning('Informe as datas de início e fim para buscar.');
      return;
    }
    const deDate = parseDateInput(de);
    const ateDate = parseDateInput(ate);
    if (!deDate || !ateDate) {
      toast.warning('Datas inválidas no período de apuração.');
      return;
    }
    if (deDate > ateDate) {
      toast.warning('A data inicial não pode ser maior que a data final.');
      return;
    }
    setCalculoBuscaAtiva(true);
    setCalculoBuscaPeriodo({ de, ate });
    toast.success('Busca aplicada para o período informado.');
  }

  function limparCalculoBusca() {
    setCalculoBuscaPeriodo(null);
    setCalculoBuscaAtiva(false);
    toast.success('Busca limpa.');
  }

  useEffect(() => {
    setCalculoBuscaPeriodo(null);
    setCalculoBuscaAtiva(false);
  }, [calculoYear, calculoMonth]);

  async function saveCalculoPeriodo() {
    const payload = {
      ...calculoPeriodos,
      [calculoPeriodo]: calculoPeriodoData,
    };
    setCalculoPeriodoSaving(true);
    try {
      const ok = await saveCalculoPosVendasPeriodos(payload);
      if (!ok) {
        toast.error('Não foi possível salvar o período de apuração.');
        return;
      }
      setCalculoPeriodos(payload);
      toast.success(`Período de apuração salvo para ${MONTHS[calculoMonth - 1]}/${calculoYear}.`);
    } finally {
      setCalculoPeriodoSaving(false);
    }
  }

  async function toggleCalculoBloqueio() {
    const current = calculoPeriodoData;
    if (current.bloqueado) {
      const pass = window.prompt('Digite a senha para desbloquear o período:');
      if (pass !== UNLOCK_PASSWORD) {
        toast.error('Senha incorreta.');
        return;
      }
    }
    const next = {
      ...calculoPeriodos,
      [calculoPeriodo]: {
        ...current,
        bloqueado: !current.bloqueado,
      },
    };
    const ok = await saveCalculoPosVendasPeriodos(next);
    if (!ok) {
      toast.error('Não foi possível atualizar o bloqueio do período.');
      return;
    }
    setCalculoPeriodos(next);
    toast.success(current.bloqueado ? 'Período desbloqueado.' : 'Período bloqueado.');
  }

  async function saveCalculoDraft() {
    if (!calculoDraft) return;
    if (calculoBloqueado) {
      toast.warning('Período bloqueado. Desbloqueie para editar remunerações.');
      return;
    }
    const now = new Date().toISOString();
    const payload: CalculoPosVendasRemuneracao = {
      ...calculoDraft,
      periodo: calculoPeriodo,
      vendedor: normalizeVendorName(calculoDraft.vendedor),
      departamentoColaborador: (['pecas', 'oficina', 'funilaria', 'acessorios'].includes(calculoDraft.departamentoColaborador)
        ? calculoDraft.departamentoColaborador
        : '') as DepartamentoColaborador,
      cargoColaborador: String(calculoDraft.cargoColaborador ?? '').trim(),
      salarioFixo: String(calculoDraft.salarioFixo ?? '').trim(),
      comissaoPecasPct: String(calculoDraft.comissaoPecasPct ?? '').trim(),
      comissaoRpsPct: String(calculoDraft.comissaoRpsPct ?? '').trim(),
      comissaoTotalPecasPct: String(calculoDraft.comissaoTotalPecasPct ?? '').trim(),
      bonusProdutividade: String(calculoDraft.bonusProdutividade ?? '').trim(),
      departamentos: (calculoDraft.departamentos ?? []).map((item) => normalizeVendorName(item)).filter(Boolean),
      transacoes: (calculoDraft.transacoes ?? []).map((item) => normalizeVendorName(item)).filter(Boolean),
      bonusEscalas: cleanBonusEscalas((calculoDraft.bonusEscalas ?? []) as BonusEscalaDraft[]),
      descontarDevolucao: Boolean(calculoDraft.descontarDevolucao),
      atualizadoEm: now,
      criadoEm: calculoDraft.criadoEm || now,
    };

    const previous = calculoRemuneracoes.find(
      (item) => item.periodo === calculoPeriodo && vendorKey(item.vendedor) === vendorKey(payload.vendedor),
    );
    if (previous?.ativo !== false && payload.ativo === false) {
      const confirmed = window.confirm(`Inativar ${payload.vendedor} para ${MONTHS[calculoMonth - 1]}/${calculoYear}?`);
      if (!confirmed) return;
    }

    setCalculoSaving(true);
    try {
      const next = upsertCalculoPosVendasRemuneracao(calculoRemuneracoes, payload);
      const ok = await saveCalculoPosVendasRemuneracoes(next);
      if (!ok) {
        toast.error('Não foi possível salvar a remuneração.');
        return;
      }
      setCalculoRemuneracoes(next);
      closeCalculoDraft();
      toast.success(`Remuneração de ${payload.vendedor} salva para ${MONTHS[calculoMonth - 1]}/${calculoYear}.`);
    } finally {
      setCalculoSaving(false);
    }
  }

  async function toggleCalculoAtivo(vendedor: string) {
    if (calculoBloqueado) {
      toast.warning('Período bloqueado. Desbloqueie para alterar status.');
      return;
    }
    const existing = calculoRemuneracoes.find(
      (item) => item.periodo === calculoPeriodo && vendorKey(item.vendedor) === vendorKey(vendedor),
    );
    if (!existing) return;
    const nextActive = !existing.ativo;
    if (!nextActive) {
      const confirmed = window.confirm(`Inativar ${existing.vendedor} para ${MONTHS[calculoMonth - 1]}/${calculoYear}?`);
      if (!confirmed) return;
    }
    const payload: CalculoPosVendasRemuneracao = {
      ...existing,
      ativo: nextActive,
      atualizadoEm: new Date().toISOString(),
    };
    const next = upsertCalculoPosVendasRemuneracao(calculoRemuneracoes, payload);
    const ok = await saveCalculoPosVendasRemuneracoes(next);
    if (!ok) {
      toast.error('Não foi possível atualizar o status.');
      return;
    }
    setCalculoRemuneracoes(next);
    toast.success(`${payload.vendedor} ${nextActive ? 'reativado' : 'inativado'}.`);
  }

  async function copyPreviousCalculoPeriodo() {
    if (calculoBloqueado) {
      toast.warning('Período bloqueado. Desbloqueie para copiar dados.');
      return;
    }
    const previousDate = new Date(calculoYear, calculoMonth - 2, 1);
    const previousPeriodo = calculoPeriodoKey(previousDate.getFullYear(), previousDate.getMonth() + 1);
    const prevItems = calculoRemuneracoes.filter((item) => item.periodo === previousPeriodo);
    if (prevItems.length === 0) {
      toast.info('Não há cadastros no período anterior para copiar.');
      return;
    }

    const confirmed = window.confirm(
      `Copiar ${prevItems.length} cadastro(s) de ${MONTHS[previousDate.getMonth()]}/${previousDate.getFullYear()} para ${MONTHS[calculoMonth - 1]}/${calculoYear}? Os existentes serão sobrescritos.`,
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    let next = [...calculoRemuneracoes];
    prevItems.forEach((item) => {
      next = upsertCalculoPosVendasRemuneracao(next, {
        ...item,
        id: crypto.randomUUID(),
        periodo: calculoPeriodo,
        atualizadoEm: now,
      });
    });

    const ok = await saveCalculoPosVendasRemuneracoes(next);
    if (!ok) {
      toast.error('Não foi possível copiar os cadastros do período anterior.');
      return;
    }
    setCalculoRemuneracoes(next);
    toast.success('Cadastros copiados do período anterior com sucesso.');
  }

  const mecanicosAvailableYears = useMemo(() => {
    const years = new Set<number>();
    mecanicosRows.forEach((row) => {
      const period = productRowPeriod(row);
      if (period) years.add(period.year);
    });
    const current = new Date().getFullYear();
    [current - 1, current, current + 1].forEach((y) => years.add(y));
    return [...years].sort();
  }, [mecanicosRows]);

  const mecanicosMonthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    mecanicosRows.forEach((row) => {
      const period = productRowPeriod(row);
      if (!period) return;
      counts[period.month] = (counts[period.month] || 0) + 1;
    });
    return counts;
  }, [mecanicosRows]);

  const filteredMecanicosRows = useMemo(() => mecanicosRows.filter((row) => {
    const period = productRowPeriod(row);
    if (!period) return true;
    if (period.year !== mecanicosFilterYear) return false;
    if (mecanicosFilterMonth !== null && period.month !== mecanicosFilterMonth) return false;
    return true;
  }), [mecanicosRows, mecanicosFilterYear, mecanicosFilterMonth]);

  const demonstrativoRemuneracoesValidas = useMemo(() => {
    return calculoRemuneracoes
      .filter((item) => item.ativo)
      .filter((item) => parsePeriodoKey(item.periodo) !== null);
  }, [calculoRemuneracoes]);

  const demonstrativoAvailableYears = useMemo(() => {
    const years = new Set<number>();
    demonstrativoRemuneracoesValidas.forEach((item) => {
      const period = parsePeriodoKey(item.periodo);
      if (period) years.add(period.year);
    });
    const current = new Date().getFullYear();
    [current - 1, current, current + 1].forEach((year) => years.add(year));
    return [...years].sort();
  }, [demonstrativoRemuneracoesValidas]);

  const demonstrativoMonthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    demonstrativoRemuneracoesValidas.forEach((item) => {
      const period = parsePeriodoKey(item.periodo);
      if (!period || period.year !== demonstrativoFilter.year) return;
      counts[period.month] = (counts[period.month] || 0) + 1;
    });
    return counts;
  }, [demonstrativoRemuneracoesValidas, demonstrativoFilter.year]);

  const demonstrativoRowsByTab = useMemo<Record<DemonstrativoSubTab, CalculoPosVendasRemuneracao[]>>(() => {
    const grouped: Record<DemonstrativoSubTab, CalculoPosVendasRemuneracao[]> = {
      pecas: [],
      oficina: [],
      funilaria: [],
      acessorios: [],
    };

    demonstrativoRemuneracoesValidas.forEach((item) => {
      const period = parsePeriodoKey(item.periodo);
      if (!period) return;
      if (period.year !== demonstrativoFilter.year) return;
      if (demonstrativoFilter.month !== null && period.month !== demonstrativoFilter.month) return;
      const dep = item.departamentoColaborador;
      if (dep === 'pecas' || dep === 'oficina' || dep === 'funilaria' || dep === 'acessorios') {
        grouped[dep].push(item);
      }
    });

    (Object.keys(grouped) as DemonstrativoSubTab[]).forEach((dep) => {
      grouped[dep].sort((a, b) => a.vendedor.localeCompare(b.vendedor, 'pt-BR', { sensitivity: 'base' }));
    });

    return grouped;
  }, [demonstrativoRemuneracoesValidas, demonstrativoFilter.year, demonstrativoFilter.month]);

  const demonstrativoFilteredRows = demonstrativoRowsByTab[demonstrativoSubTab];

  function calcDemonstrativoTotais(rows: CalculoPosVendasRemuneracao[]) {
    return rows.reduce((acc, item) => {
      const salarioFixo = parseDecimal(item.salarioFixo ?? '');
      const bonusProdutividade = parseDecimal(item.bonusProdutividade ?? '');
      acc.salarioFixo += salarioFixo;
      acc.bonusProdutividade += bonusProdutividade;
      acc.totalRemuneracao += salarioFixo + bonusProdutividade;
      return acc;
    }, {
      salarioFixo: 0,
      bonusProdutividade: 0,
      totalRemuneracao: 0,
    });
  }

  const demonstrativoTotais = useMemo(() => {
    return calcDemonstrativoTotais(demonstrativoFilteredRows);
  }, [demonstrativoFilteredRows]);

  const demonstrativoTotaisByTab = useMemo<Record<DemonstrativoSubTab, { salarioFixo: number; bonusProdutividade: number; totalRemuneracao: number }>>(() => {
    return {
      pecas: calcDemonstrativoTotais(demonstrativoRowsByTab.pecas),
      oficina: calcDemonstrativoTotais(demonstrativoRowsByTab.oficina),
      funilaria: calcDemonstrativoTotais(demonstrativoRowsByTab.funilaria),
      acessorios: calcDemonstrativoTotais(demonstrativoRowsByTab.acessorios),
    };
  }, [demonstrativoRowsByTab]);

  const demonstrativoTabsComDados = useMemo(() => {
    return DEMONSTRATIVO_SUB_TABS.filter((tab) => demonstrativoRowsByTab[tab.id].length > 0);
  }, [demonstrativoRowsByTab]);

  function isPrintValueEmptyOrZero(text: string): boolean {
    const raw = String(text ?? '').trim();
    if (!raw) return true;
    const cleaned = raw
      .replace(/\s+/g, '')
      .replace(/R\$/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const n = Number(cleaned);
    if (Number.isNaN(n)) return false;
    return n === 0;
  }

  function hidePrintRemuneracaoColumns(container: HTMLElement) {
    const tables = Array.from(container.querySelectorAll('table'));

    tables.forEach((table) => {
      table.classList.remove('table-fixed');
      table.style.tableLayout = 'fixed';
      table.style.width = '100%';

      const headerAbbrev: Record<string, string> = {
        'Bônus produtividade': 'Bônus prod.',
        'Bônus Adicional': 'Bônus adic.',
        'Participação no resultado': 'Partic. resultado',
        'Total remuneração': 'Tot. rem.',
      };
      Array.from(table.querySelectorAll('thead th')).forEach((th) => {
        const text = th.textContent?.trim() ?? '';
        if (headerAbbrev[text]) th.textContent = headerAbbrev[text];
      });

      const tbodyRows = Array.from(table.tBodies?.[0]?.rows ?? []);
      if (tbodyRows.length === 0) return;

      const producaoCols = [3, 4, 5];
      const remuneracaoCols = [6, 7, 8, 9, 10, 11, 12, 13];
      const colsToHide = new Set<number>();

      [...producaoCols, ...remuneracaoCols].forEach((colIndex) => {
        const emptyAll = tbodyRows.every((row) => {
          const value = row.cells[colIndex - 1]?.textContent ?? '';
          return isPrintValueEmptyOrZero(value);
        });
        if (emptyAll) colsToHide.add(colIndex);
      });

      // Total remuneracao deve permanecer sempre visivel para evitar ambiguidades no rodape.
      colsToHide.delete(13);

      if (colsToHide.size === 0) return;

      const colgroupCols = Array.from(table.querySelectorAll('colgroup col'));
      colsToHide.forEach((colIndex) => {
        const col = colgroupCols[colIndex - 1];
        if (col) col.style.display = 'none';
      });

      const widthWeightByCol: Record<number, number> = {
        1: 22,
        2: 12,
        3: 7,
        4: 8,
        5: 8,
        6: 6,
        7: 6,
        8: 6,
        9: 7,
        10: 6,
        11: 6,
        12: 6,
        13: 12,
      };
      const visibleCols = Array.from({ length: 13 }, (_, i) => i + 1).filter((col) => !colsToHide.has(col));
      const visibleWeight = visibleCols.reduce((sum, col) => sum + (widthWeightByCol[col] ?? 1), 0);
      visibleCols.forEach((colIndex) => {
        const col = colgroupCols[colIndex - 1];
        if (!col) return;
        const pct = ((widthWeightByCol[colIndex] ?? 1) / visibleWeight) * 100;
        col.style.width = `${pct.toFixed(2)}%`;
      });

      Array.from(table.tBodies).forEach((tbody) => {
        Array.from(tbody.rows).forEach((row) => {
          colsToHide.forEach((colIndex) => {
            const cell = row.cells[colIndex - 1];
            if (cell) cell.style.display = 'none';
          });
        });
      });

      const tfootRow = table.tFoot?.rows?.[0];
      if (tfootRow) {
        const tfootCellByLogicalCol: Partial<Record<number, number>> = {
          6: 1,
          7: 2,
          8: 3,
          9: 4,
          10: 5,
          11: 6,
          12: 7,
          13: 8,
        };
        colsToHide.forEach((colIndex) => {
          const cellIndex = tfootCellByLogicalCol[colIndex];
          if (cellIndex === undefined) return;
          const cell = tfootRow.cells[cellIndex];
          if (cell) cell.style.display = 'none';
        });
      }

      const theadRows = Array.from(table.tHead?.rows ?? []);
      const row1 = theadRows[0];
      const row2 = theadRows[1];
      if (!row1 || !row2) return;

      const producaoSubHeaderMap: Array<{ col: number; row2Index: number }> = [
        { col: 3, row2Index: 0 },
        { col: 4, row2Index: 1 },
        { col: 5, row2Index: 2 },
      ];

      producaoSubHeaderMap.forEach(({ col, row2Index }) => {
        if (colsToHide.has(col)) {
          const cell = row2.cells[row2Index];
          if (cell) cell.style.display = 'none';
        }
      });

      const comSubHeaderMap: Array<{ col: number; row2Index: number }> = [
        { col: 9, row2Index: 5 },
        { col: 8, row2Index: 4 },
        { col: 7, row2Index: 3 },
      ];

      comSubHeaderMap.forEach(({ col, row2Index }) => {
        if (colsToHide.has(col)) {
          const cell = row2.cells[row2Index];
          if (cell) cell.style.display = 'none';
        }
      });

      const removeRow1ByLabel = (label: string) => {
        const abbrev = headerAbbrev[label];
        const cell = Array.from(row1.cells).find((c) => {
          const text = c.textContent?.trim() ?? '';
          return text.includes(label) || (abbrev ? text.includes(abbrev) : false);
        });
        if (cell) cell.style.display = 'none';
      };

      if (colsToHide.has(6)) removeRow1ByLabel('Salário Fixo');
      if (colsToHide.has(10)) removeRow1ByLabel('Bônus produtividade');
      if (colsToHide.has(11)) removeRow1ByLabel('Bônus Adicional');
      if (colsToHide.has(12)) removeRow1ByLabel('Participação no resultado');
      if (colsToHide.has(13)) removeRow1ByLabel('Total remuneração');

      const producaoCell = Array.from(row1.cells).find((c) => c.textContent?.includes('Produção'));
      if (producaoCell) {
        const visibleProdCols = [3, 4, 5].filter((col) => !colsToHide.has(col)).length;
        if (visibleProdCols === 0) {
          producaoCell.style.display = 'none';
        } else {
          producaoCell.colSpan = visibleProdCols;
        }
      }

      const comCell = Array.from(row1.cells).find((c) => c.textContent?.includes('Comissões'));
      if (comCell) {
        const visibleComCols = [7, 8, 9].filter((col) => !colsToHide.has(col)).length;
        if (visibleComCols === 0) {
          comCell.style.display = 'none';
        } else {
          comCell.colSpan = visibleComCols;
        }
      }

      const totaisLabelCell = table.tFoot?.rows?.[0]?.cells?.[0];
      if (totaisLabelCell) {
        const visibleBeforeSalario = [1, 2, 3, 4, 5].filter((col) => !colsToHide.has(col)).length;
        totaisLabelCell.colSpan = Math.max(1, visibleBeforeSalario);
      }
    });
  }

  function printFromElement(elementId: string) {
    const area = document.getElementById(elementId);
    const root = document.getElementById('print-root');
    if (!area || !root) {
      window.print();
      return;
    }

    const clone = area.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print').forEach((el) => el.remove());
    hidePrintRemuneracaoColumns(clone);
    root.innerHTML = `<div style="font-family:Inter,system-ui,sans-serif;">${clone.outerHTML}</div>`;

    const style = document.createElement('style');
    style.textContent = `
      @page { size: A4 landscape; margin: 0.8cm 0.7cm; }
      #print-root, #print-root * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
        color-scheme: light !important;
      }
      #print-root table {
        width: 100% !important;
        table-layout: fixed !important;
      }
      #print-root table th {
        white-space: normal !important;
        line-height: 1.1 !important;
        font-size: 8px !important;
        padding: 4px 5px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      #print-root table td {
        font-size: 9px !important;
        padding: 4px 5px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      #print-root table th:nth-child(1),
      #print-root table th:nth-child(2),
      #print-root table td:nth-child(1),
      #print-root table td:nth-child(2) {
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      #print-root .sticky-col { position: static !important; }
    `;
    document.head.appendChild(style);

    const cleanup = () => {
      document.head.removeChild(style);
      root.innerHTML = '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  const demonstrativoKpis = useMemo(() => {
    const colaboradores = demonstrativoFilteredRows.length;
    return {
      colaboradores,
      salarioFixo: demonstrativoTotais.salarioFixo,
      bonusProdutividade: demonstrativoTotais.bonusProdutividade,
      totalRemuneracao: demonstrativoTotais.totalRemuneracao,
    };
  }, [demonstrativoFilteredRows, demonstrativoTotais]);

  function printDemonstrativoAtual() {
    if (demonstrativoFilter.month === null) {
      toast.warning('Selecione um mês para imprimir o demonstrativo da sub-aba atual.');
      return;
    }
    setDemonstrativoPrintMode('atual');
    setTimeout(() => printFromElement('demonstrativo-print-current-content'), 0);
  }

  function printDemonstrativoTodos() {
    if (demonstrativoFilter.month === null) {
      toast.warning('Selecione um mês para imprimir os demonstrativos.');
      return;
    }
    if (demonstrativoTabsComDados.length === 0) {
      toast.warning('Não há demonstrativos com dados para imprimir nesta competência.');
      return;
    }
    setDemonstrativoPrintMode('todos');
    setTimeout(() => printFromElement('demonstrativo-print-all-content'), 0);
  }

  function setDemonstrativoFilter(patch: Partial<{ year: number; month: number | null }>) {
    setDemonstrativoFilterState((prev) => ({ ...prev, ...patch }));
  }

  useEffect(() => {
    const handleAfterPrint = () => setDemonstrativoPrintMode('atual');
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  async function persistMecanicosStore(nextRows: VPecasItemRow[], nextColumns: string[]) {
    await kvSet(MECANICOS_KEY, { columns: nextColumns, rows: nextRows });
  }

  async function handleDeleteMecanicosPeriod() {
    if (mecanicosBloqueado) {
      toast.warning('Competência atual bloqueada em Cálculo. Não é possível apagar Mecânicos.');
      setConfirmDeleteMecanicos(false);
      return;
    }
    const nextRows = mecanicosRows.filter((row) => {
      const period = productRowPeriod(row);
      if (!period) return false;
      if (period.year !== mecanicosFilterYear) return true;
      if (mecanicosFilterMonth !== null && period.month !== mecanicosFilterMonth) return true;
      return false;
    });

    if (nextRows.length === mecanicosRows.length) {
      toast.info('Nenhum registro encontrado para remover no período selecionado.');
      setConfirmDeleteMecanicos(false);
      return;
    }

    await persistMecanicosStore(nextRows, mecanicosColumns);
    setMecanicosRows(nextRows);
    setConfirmDeleteMecanicos(false);
    toast.success('Dados do período selecionado removidos.');
  }

  async function confirmMecanicosImport() {
    if (!pendingMecanicosImport) return;
    if (mecanicosBloqueado) {
      toast.warning('Competência atual bloqueada em Cálculo. Não é possível importar Mecânicos.');
      setPendingMecanicosImport(null);
      return;
    }
    const { rows, columns, periodLabel } = pendingMecanicosImport;
    const nextRows = rows.map((row) => {
      if (productRowPeriod(row)) return row;
      const fallbackPeriod = `${mecanicosFilterYear}-${String(mecanicosFilterMonth ?? new Date().getMonth() + 1).padStart(2, '0')}`;
      return { ...row, periodoImport: fallbackPeriod };
    });
    await persistMecanicosStore(nextRows, columns);
    setMecanicosRows(nextRows);
    setMecanicosColumns(columns);
    setPendingMecanicosImport(null);
    toast.success(`Importação confirmada para ${periodLabel}.`);
  }

  async function handleMecanicosImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (mecanicosBloqueado) {
      toast.warning('Competência atual bloqueada em Cálculo. Não é possível importar Mecânicos.');
      if (mecanicosInputRef.current) mecanicosInputRef.current.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMecanicosExcel(buffer);
      if (parsed.rows.length === 0 || parsed.columns.length === 0) {
        toast.warning('Nenhum dado válido foi encontrado no Excel.');
        if (mecanicosInputRef.current) mecanicosInputRef.current.value = '';
        return;
      }
      const importMonth = mecanicosFilterMonth ?? new Date().getMonth() + 1;
      const importPeriodLabel = `${MONTHS[importMonth - 1]}/${String(mecanicosFilterYear).slice(-2)}`;
      setPendingMecanicosImport({ rows: parsed.rows, columns: parsed.columns, periodLabel: importPeriodLabel });
    } catch (error) {
      console.error('Erro ao importar Mecânicos:', error);
      toast.error(`Erro ao importar o arquivo: ${String(error)}`);
    } finally {
      if (mecanicosInputRef.current) mecanicosInputRef.current.value = '';
    }
  }

  function toggleAccordionItem(key: string, current: string[], setCurrent: (value: string[]) => void) {
    setCurrent(current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  }

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollDummyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (bottomScrollDummyRef.current && tableScrollRef.current) {
        bottomScrollDummyRef.current.style.width = `${tableScrollRef.current.scrollWidth}px`;
      }
    }, 30);
    return () => clearTimeout(t);
  }, [vendasSubTab, filteredPecasRows.length]);

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden" data-print-mode={demonstrativoPrintMode}>
        <style>{`.sticky-col { position: sticky; z-index: 6; }
      .print-only-all { display: none; }
      @media print {
  .no-print { display: none !important; }
  .print-surface { border: none !important; box-shadow: none !important; }
  .print-preserve { overflow: visible !important; }
  [data-print-mode="todos"] .print-hide-when-all { display: none !important; }
  [data-print-mode="todos"] .print-only-all { display: block !important; }
  .print-page-break { break-before: page; }
      .sticky-col { position: static !important; }
  body { background: #fff !important; }
}`}</style>
      <input ref={mecanicosInputRef} type="file" accept=".xlsx,.xls,.ods" className="hidden" onChange={handleMecanicosImport} />
      {pendingMecanicosImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-slate-800">Confirmar importação</p>
            <p className="mt-2 text-xs text-slate-500">
              Deseja importar os dados no mês <strong>{pendingMecanicosImport.periodLabel}</strong>?
            </p>
            <p className="mt-2 text-xs text-slate-500">Os registros serão salvos como competência desse período.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingMecanicosImport(null)}>
                Cancelar
              </Button>
              <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={confirmMecanicosImport}>
                Confirmar importação
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteMecanicos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-slate-800">Apagar dados da aba Mecânicos</p>
            <p className="mt-2 text-xs text-slate-500">
              Isso vai remover apenas o período selecionado: <strong>{mecanicosFilterMonth === null ? `Ano todo / ${mecanicosFilterYear}` : `${MONTHS[mecanicosFilterMonth - 1]}/${mecanicosFilterYear}`}</strong>.
            </p>
            <p className="mt-2 text-xs text-slate-500">Deseja continuar?</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmDeleteMecanicos(false)}>
                Cancelar
              </Button>
              <Button type="button" className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleDeleteMecanicosPeriod}>
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
      <header className="no-print bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Cálculo de Comissões VW - Pós Vendas</h1>
          <p className="text-xs text-slate-500 mt-0.5">Folha de Pagamento</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setMainTab('vendas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainTab === 'vendas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Vendas
            </button>
            <button
              onClick={() => setMainTab('calculo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainTab === 'calculo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Cálculo
            </button>
            <button
              onClick={() => setMainTab('demonstrativo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mainTab === 'demonstrativo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              Demonstrativo de pagamento
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

      <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
        {mainTab === 'calculo' ? (
          <div className="flex-1 p-6" style={{ minHeight: 0 }}>
            <div className="h-full bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">Cálculo</p>
                  <p className="text-xs text-slate-500">Cadastro mensal de remuneração para vendedores com vendas registradas no período.</p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {calculoVendors.length} vendedor{calculoVendors.length !== 1 ? 'es' : ''}
                </span>
              </div>

              <div className="bg-white border-b border-slate-100 px-4 py-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-x-auto">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold whitespace-nowrap">
                      ANO
                      <select
                        value={calculoYear}
                        onChange={(e) => setCalculoYear(Number(e.target.value))}
                        className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        {Array.from(new Set([calculoYear - 1, calculoYear, calculoYear + 1, new Date().getFullYear()])).sort().map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      {MONTHS.map((month, index) => (
                        <button
                          key={month}
                          onClick={() => setCalculoMonth(index + 1)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                            calculoMonth === index + 1 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 whitespace-nowrap">
                    Competência {MONTHS[calculoMonth - 1]}/{calculoYear}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:flex-wrap">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Período de apuração - De
                          <input
                            type="date"
                            value={calculoPeriodoData.de}
                            onChange={(e) => updateCalculoPeriodoField('de', e.target.value)}
                            disabled={calculoBloqueado}
                            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Período de apuração - Até
                          <input
                            type="date"
                            value={calculoPeriodoData.ate}
                            onChange={(e) => updateCalculoPeriodoField('ate', e.target.value)}
                            disabled={calculoBloqueado}
                            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={buscarCalculoPeriodo}
                        >
                          <Search className="mr-1 h-4 w-4" />
                          Buscar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={limparCalculoBusca}
                          disabled={!calculoBuscaAtiva}
                        >
                          Limpar
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={copyPreviousCalculoPeriodo}
                        disabled={calculoBloqueado}
                      >
                        <Copy className="mr-1 h-4 w-4" />
                        Copiar período anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={saveCalculoPeriodo}
                        disabled={calculoPeriodoSaving || calculoBloqueado}
                      >
                        <Save className="mr-1 h-4 w-4" />
                        Salvar período
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={toggleCalculoBloqueio}
                        className={calculoBloqueado ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}
                      >
                        {calculoBloqueado ? <LockOpen className="mr-1 h-4 w-4" /> : <Lock className="mr-1 h-4 w-4" />}
                        {calculoBloqueado ? 'Desbloquear' : 'Bloquear'}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {calculoBloqueado
                      ? 'Competência bloqueada: edição e status de remuneração ficam indisponíveis.'
                      : 'Defina o período de apuração antes de cadastrar as remunerações.'}
                  </p>
                  {calculoBuscaPeriodo && (
                    <p className="mt-1 text-xs text-blue-600">
                      Busca aplicada: {calculoBuscaPeriodo.de} até {calculoBuscaPeriodo.ate}.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-0.5 w-fit">
                  <button
                    onClick={() => setCalculoAba('cadastrados')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      calculoAba === 'cadastrados' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Remuneração cadastrada ({calculoRegistered.length})
                  </button>
                  <button
                    onClick={() => setCalculoAba('pendentes')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      calculoAba === 'pendentes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    A cadastrar ({calculoPending.length})
                  </button>
                </div>

                <div className="text-xs text-slate-500">
                  A lista é alimentada pelos vendedores que tiveram vendas registradas no período selecionado nas abas de Pós Vendas.
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {calculoLoading ? (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm px-6 text-center">Carregando dados do cadastro...</div>
                ) : !calculoBuscaAtiva ? (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm px-6 text-center">
                    Defina o período e clique em Buscar para carregar os dados.
                  </div>
                ) : (calculoAba === 'cadastrados' ? calculoRegistered : calculoPending).length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm px-6 text-center">
                    Nenhum vendedor encontrado para esta visão.
                  </div>
                ) : (
                  <table className="min-w-[1460px] w-full text-xs text-slate-700">
                    <thead className="bg-slate-800 text-white sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-slate-700">Vendedor</th>
                        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-slate-700">Origem</th>
                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-slate-700">Vendas</th>
                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-slate-700">Comissionado</th>
                        <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-r border-slate-700">Comissão prevista</th>
                        <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-r border-slate-700">Bônus previsto</th>
                        <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-r border-slate-700">Salário fixo</th>
                        <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-r border-slate-700">Total previsto</th>
                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-slate-700">Status</th>
                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(calculoAba === 'cadastrados' ? calculoRegistered : calculoPending).map((item, index) => {
                        const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70';
                        const record = item.record;
                        const valores = calculoValoresByVendor.get(vendorKey(item.vendedor));
                        const detailKey = `calculo-${vendorKey(item.vendedor)}`;
                        const detailOpen = openVendorKeys.includes(detailKey);
                        return (
                          <Fragment key={`${item.vendedor}-${index}`}>
                            <tr className={`${rowBg} border-t border-slate-100`}>
                              <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800">{item.vendedor}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-slate-500">{item.fontes.join(' · ')}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-center">{item.registros}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-center">
                                {record?.comissionado ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 text-[11px] font-semibold">
                                    <UserCheck className="w-3 h-3" />
                                    Sim
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 px-2 py-1 text-[11px] font-semibold">
                                    <UserX className="w-3 h-3" />
                                    Não
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-right font-mono">R$ {fmtCurrency(valores?.comissao ?? 0)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-right font-mono">R$ {fmtCurrency(valores?.bonus ?? 0)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-right font-mono">R$ {fmtCurrency(Number(String(record?.salarioFixo ?? '').replace(',', '.')) || 0)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-slate-900">R$ {fmtCurrency(valores?.total ?? (Number(String(record?.salarioFixo ?? '').replace(',', '.')) || 0))}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-center">
                                {record ? (
                                  record.ativo ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 text-[11px] font-semibold">Ativo</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 px-2 py-1 text-[11px] font-semibold">Inativo</span>
                                  )
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-1 text-[11px] font-semibold">Pendente</span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {record ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-7 px-3 text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
                                      onClick={() => toggleAccordionItem(detailKey, openVendorKeys, setOpenVendorKeys)}
                                    >
                                      {detailOpen ? 'Ocultar detalhes' : 'Ver detalhes'}
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 px-3 text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
                                    onClick={() => openCalculoDraft(item.vendedor)}
                                    disabled={calculoBloqueado}
                                  >
                                    <Pencil className="w-3 h-3 mr-1" />
                                    {record ? 'Editar' : 'Adicionar'}
                                  </Button>
                                  {record ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className={`h-7 px-3 text-xs ${record.ativo ? 'border-rose-300 text-rose-700 hover:bg-rose-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}
                                      onClick={() => toggleCalculoAtivo(item.vendedor)}
                                      disabled={calculoBloqueado}
                                    >
                                      {record.ativo ? 'Inativar' : 'Reativar'}
                                    </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                            {record && detailOpen ? (
                              <tr className="bg-slate-50 border-t border-slate-100">
                                <td colSpan={10} className="px-4 py-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-600">
                                    <div className="space-y-1">
                                      <p><strong className="text-slate-700">Base de Peças:</strong> R$ {fmtCurrency(valores?.basePecasVendas ?? 0)}</p>
                                      <p><strong className="text-slate-700">Base Acessórios:</strong> R$ {fmtCurrency(valores?.baseAcessorios ?? 0)}</p>
                                      <p><strong className="text-slate-700">Base Produtos:</strong> R$ {fmtCurrency(valores?.baseProdutos ?? 0)}</p>
                                      <p><strong className="text-slate-700">Base mão de Obra RPS Oficina:</strong> R$ {fmtCurrency(valores?.baseRpsOficina ?? 0)}</p>
                                      <p><strong className="text-slate-700">Base mão de Obra RPS Funilaria:</strong> R$ {fmtCurrency(valores?.baseRpsFunilaria ?? 0)}</p>
                                      <p><strong className="text-slate-700">Base Mão de Obra mecânico:</strong> R$ {fmtCurrency(valores?.baseMecanicos ?? 0)}</p>
                                      <p><strong className="text-slate-700">Volume líquido:</strong> {valores?.volumeLiquido ?? 0}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p><strong className="text-slate-700">Regra bônus:</strong> {valores?.bonusRegra ?? '—'}</p>
                                      <p><strong className="text-slate-700">Filtros:</strong> {valores?.filtros ?? '—'}</p>
                                      <p><strong className="text-slate-700">Composição:</strong> Salário + Comissão + Bônus</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {calculoModalOpen && calculoDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                  <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <p className="text-sm font-bold text-slate-800">Cadastro de remuneração</p>
                        <p className="text-xs text-slate-500">Competência {MONTHS[calculoMonth - 1]}/{calculoYear}</p>
                      </div>
                      <button onClick={closeCalculoDraft} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Vendedor</label>
                        <input
                          value={calculoDraft.vendedor}
                          onChange={(e) => setCalculoDraft({ ...calculoDraft, vendedor: e.target.value })}
                          disabled={calculoBloqueado}
                          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Departamento do colaborador</label>
                        <select
                          value={calculoDraft.departamentoColaborador ?? ''}
                          onChange={(e) => setCalculoDraft({ ...calculoDraft, departamentoColaborador: e.target.value as DepartamentoColaborador })}
                          disabled={calculoBloqueado}
                          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          <option value="">Selecione</option>
                          {DEPARTAMENTO_COLABORADOR_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo do colaborador</label>
                        <input
                          value={calculoDraft.cargoColaborador ?? ''}
                          onChange={(e) => setCalculoDraft({ ...calculoDraft, cargoColaborador: e.target.value })}
                          disabled={calculoBloqueado}
                          placeholder="Ex.: Consultor Técnico"
                          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={calculoDraft.comissionado}
                            onChange={(e) => setCalculoDraft({ ...calculoDraft, comissionado: e.target.checked })}
                            disabled={calculoBloqueado}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-slate-700">Comissionado</span>
                        </label>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Salário fixo</label>
                          <div className="relative">
                            <Wallet className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="number"
                              step="0.01"
                              value={calculoDraft.salarioFixo}
                              onChange={(e) => setCalculoDraft({ ...calculoDraft, salarioFixo: e.target.value })}
                              disabled={calculoBloqueado}
                              placeholder="0,00"
                              className="w-full border border-slate-200 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Comissão Peças (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={calculoDraft.comissaoPecasPct}
                            onChange={(e) => setCalculoDraft({ ...calculoDraft, comissaoPecasPct: e.target.value })}
                            disabled={calculoBloqueado}
                            placeholder="0,00"
                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Comissão Mão de Obra RPS (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={calculoDraft.comissaoRpsPct}
                            onChange={(e) => setCalculoDraft({ ...calculoDraft, comissaoRpsPct: e.target.value })}
                            disabled={calculoBloqueado}
                            placeholder="0,00"
                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Comissão Total Peças (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={calculoDraft.comissaoTotalPecasPct}
                            onChange={(e) => setCalculoDraft({ ...calculoDraft, comissaoTotalPecasPct: e.target.value })}
                            disabled={calculoBloqueado}
                            placeholder="0,00"
                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Bônus produtividade fixo (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={calculoDraft.bonusProdutividade}
                            onChange={(e) => setCalculoDraft({ ...calculoDraft, bonusProdutividade: e.target.value })}
                            disabled={calculoBloqueado}
                            placeholder="0,00"
                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>
                        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={calculoDraft.descontarDevolucao}
                            onChange={(e) => setCalculoDraft({ ...calculoDraft, descontarDevolucao: e.target.checked })}
                            disabled={calculoBloqueado}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-slate-700">Descontar devoluções na comissão</span>
                        </label>
                      </div>

                      <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-semibold text-slate-600">Departamentos habilitados</p>
                            {calculoDraftDepartamentos.length === 0 ? (
                              <p className="text-xs text-slate-400">Sem departamentos encontrados para este vendedor no período.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {calculoDraftDepartamentos.map((dept) => {
                                  const active = (calculoDraft.departamentos ?? []).includes(dept);
                                  return (
                                    <button
                                      key={dept}
                                      type="button"
                                      onClick={() => toggleDraftListField('departamentos', dept)}
                                      disabled={calculoBloqueado}
                                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                                        active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                                      }`}
                                    >
                                      {dept}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-semibold text-slate-600">Transações habilitadas</p>
                            {calculoDraftTransacoes.length === 0 ? (
                              <p className="text-xs text-slate-400">Sem transações encontradas para este vendedor no período.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {calculoDraftTransacoes.map((tx) => {
                                  const active = (calculoDraft.transacoes ?? []).includes(tx);
                                  return (
                                    <button
                                      key={tx}
                                      type="button"
                                      onClick={() => toggleDraftListField('transacoes', tx)}
                                      disabled={calculoBloqueado}
                                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                                        active ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                                      }`}
                                    >
                                      {tx}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-600">Escala de bônus de produtividade (não acumulada)</p>
                          <Button type="button" variant="outline" onClick={addBonusEscalaRow} disabled={calculoBloqueado}>
                            + Faixa
                          </Button>
                        </div>
                        <div className="overflow-auto rounded-md border border-slate-200">
                          <table className="w-full min-w-[420px] text-xs">
                            <thead className="bg-slate-100 text-slate-600">
                              <tr>
                                <th className="px-2 py-2 text-left">De (qtd)</th>
                                <th className="px-2 py-2 text-left">Até (qtd)</th>
                                <th className="px-2 py-2 text-left">Bônus (R$)</th>
                                <th className="px-2 py-2 text-center">Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(calculoDraft.bonusEscalas ?? []).map((faixa, index) => (
                                <tr key={faixa.id} className="border-t border-slate-100">
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      value={faixa.de}
                                      onChange={(e) => updateBonusEscalaRow(faixa.id, 'de', e.target.value)}
                                      disabled={calculoBloqueado}
                                      className="w-full rounded border border-slate-200 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      value={faixa.ate}
                                      onChange={(e) => updateBonusEscalaRow(faixa.id, 'ate', e.target.value)}
                                      disabled={calculoBloqueado}
                                      placeholder={index === (calculoDraft.bonusEscalas ?? []).length - 1 ? 'Em diante' : ''}
                                      className="w-full rounded border border-slate-200 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={faixa.bonus}
                                      onChange={(e) => updateBonusEscalaRow(faixa.id, 'bonus', e.target.value)}
                                      disabled={calculoBloqueado}
                                      className="w-full rounded border border-slate-200 px-2 py-1"
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeBonusEscalaRow(faixa.id)}
                                      disabled={calculoBloqueado}
                                      className="rounded border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                                    >
                                      Remover
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500">
                        Para inativar este vendedor, use o botão de status na lista. Ao salvar a inativação, será exibida uma confirmação.
                      </p>
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" onClick={closeCalculoDraft}>
                        Cancelar
                      </Button>
                      <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={saveCalculoDraft} disabled={calculoSaving || calculoBloqueado}>
                        <Check className="w-4 h-4 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : mainTab === 'demonstrativo' ? (
          <>
            <div className="no-print bg-white border-b border-slate-200 px-6 py-3 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-x-auto">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold whitespace-nowrap">
                    ANO
                    <select
                      value={demonstrativoFilter.year}
                      onChange={(e) => setDemonstrativoFilter({ year: Number(e.target.value) })}
                      className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      {demonstrativoAvailableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDemonstrativoFilter({ month: null })}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                        demonstrativoFilter.month === null ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      Ano todo
                    </button>
                    {MONTHS.map((month, index) => (
                      <button
                        key={month}
                        onClick={() => setDemonstrativoFilter({ month: index + 1 })}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                          demonstrativoFilter.month === index + 1 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                        } ${demonstrativoMonthCounts[index + 1] ? 'font-semibold' : ''}`}
                      >
                        {month}
                        {demonstrativoMonthCounts[index + 1] ? (
                          <span className="ml-0.5 text-[10px] opacity-70">({demonstrativoMonthCounts[index + 1]})</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {demonstrativoFilteredRows.length} registro{demonstrativoFilteredRows.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex gap-0 overflow-x-auto">
                {DEMONSTRATIVO_SUB_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDemonstrativoSubTab(tab.id)}
                    className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                      demonstrativoSubTab === tab.id
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-6" style={{ minHeight: 0 }}>
              <div className="no-print mb-3 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={printDemonstrativoAtual}>
                  Imprimir PDF
                </Button>
                <Button type="button" variant="outline" onClick={printDemonstrativoTodos} disabled={demonstrativoTabsComDados.length === 0}>
                  Imprimir todos com dados
                </Button>
              </div>

              <div id="demonstrativo-print-current-content" className="h-full bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col print-surface print-preserve print-hide-when-all">
                <div className="border-b border-slate-100 px-4 py-4 space-y-3">
                  <div className="rounded-xl bg-slate-900 px-4 py-4 text-white flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-300">Demonstrativo de pagamento</p>
                      <p className="text-lg font-bold leading-tight">{DEMONSTRATIVO_SUB_TABS.find((item) => item.id === demonstrativoSubTab)?.label}</p>
                      <p className="text-xs text-slate-300 mt-1">Colaboradores ativos com remuneração cadastrada</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wider text-slate-300">Competência</p>
                      <p className="text-2xl font-bold leading-tight">{demonstrativoFilter.month === null ? 'Ano todo' : MONTHS_FULL[demonstrativoFilter.month - 1]}</p>
                      <p className="text-xs text-slate-300">{demonstrativoFilter.year}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">Colaboradores</p>
                      <p className="text-sm font-bold text-slate-800">{demonstrativoKpis.colaboradores}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">Salário Fixo</p>
                      <p className="text-sm font-bold text-slate-800 font-mono">R$ {fmtCurrency(demonstrativoKpis.salarioFixo)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">Bônus Produtividade</p>
                      <p className="text-sm font-bold text-slate-800 font-mono">R$ {fmtCurrency(demonstrativoKpis.bonusProdutividade)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">Total Remuneração</p>
                      <p className="text-sm font-bold text-slate-800 font-mono">R$ {fmtCurrency(demonstrativoKpis.totalRemuneracao)}</p>
                    </div>
                  </div>

                </div>

                <div className="flex-1 overflow-auto print-preserve">
                  {demonstrativoFilteredRows.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-400 text-sm px-6 text-center">
                      Nenhum colaborador ativo com remuneração cadastrada para este departamento e competência.
                    </div>
                  ) : (
                    <table className="min-w-[1060px] w-full table-fixed text-xs text-slate-700">
                      <colgroup>
                        <col className="w-[220px]" />
                        <col className="w-[110px]" />
                        <col className="w-[70px]" />
                        <col className="w-[90px]" />
                        <col className="w-[90px]" />
                        <col className="w-[90px]" />
                        <col className="w-[90px]" />
                        <col className="w-[90px]" />
                        <col className="w-[90px]" />
                        <col className="w-[90px]" />
                        <col className="w-[90px]" />
                        <col className="w-[90px]" />
                        <col className="w-[110px]" />
                      </colgroup>
                      <thead className="bg-slate-800 text-white sticky top-0 z-10">
                        <tr>
                          <th rowSpan={2} className="sticky-col bg-slate-800 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-slate-700" style={{ left: 0 }}>Nome vendedor</th>
                          <th rowSpan={2} className="sticky-col bg-slate-800 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-slate-700" style={{ left: 220 }}>Cargo</th>
                          <th colSpan={3} className="bg-emerald-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-emerald-600">Produção</th>
                          <th rowSpan={2} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Salário Fixo</th>
                          <th colSpan={3} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Comissões</th>
                          <th rowSpan={2} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Bônus produtividade</th>
                          <th rowSpan={2} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Bônus Adicional</th>
                          <th rowSpan={2} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Participação no resultado</th>
                          <th rowSpan={2} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap">Total remuneração</th>
                        </tr>
                        <tr>
                          <th className="bg-emerald-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-emerald-600">Peças</th>
                          <th className="bg-emerald-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-emerald-600">Acessórios</th>
                          <th className="bg-emerald-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-emerald-600">Mão de Obra</th>
                          <th className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Peças</th>
                          <th className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Acessórios</th>
                          <th className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Mão de obra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {demonstrativoFilteredRows.map((item, index) => {
                          const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70';
                          const salarioFixo = parseDecimal(item.salarioFixo ?? '');
                          const bonusProdutividade = parseDecimal(item.bonusProdutividade ?? '');
                          const totalRemuneracao = salarioFixo + bonusProdutividade;
                          return (
                            <tr key={`${item.id}-${index}`} className={`${rowBg} border-t border-slate-100 hover:bg-slate-100/70`}>
                              <td className={`sticky-col px-3 py-2 text-center whitespace-nowrap font-semibold text-slate-800 ${rowBg}`} style={{ left: 0 }}>{item.vendedor}</td>
                              <td className={`sticky-col px-3 py-2 text-center whitespace-nowrap text-slate-700 ${rowBg}`} style={{ left: 220 }}>{item.cargoColaborador || ''}</td>
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-emerald-50/70" />
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-emerald-50/70" />
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-emerald-50/70" />
                              <td className="px-3 py-2 text-center whitespace-nowrap font-mono bg-violet-50/70">{salarioFixo > 0 ? `R$ ${fmtCurrency(salarioFixo)}` : ''}</td>
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-50/70" />
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-50/70" />
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-50/70" />
                              <td className="px-3 py-2 text-center whitespace-nowrap font-mono bg-violet-50/70">{bonusProdutividade > 0 ? `R$ ${fmtCurrency(bonusProdutividade)}` : ''}</td>
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-50/70" />
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-50/70" />
                              <td className="px-3 py-2 text-center whitespace-nowrap font-mono font-semibold bg-violet-100/80">{totalRemuneracao > 0 ? `R$ ${fmtCurrency(totalRemuneracao)}` : ''}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-200 text-slate-900">
                        <tr className="border-t-2 border-slate-300">
                          <td colSpan={5} className="px-3 py-2 text-center font-semibold whitespace-nowrap">Totais</td>
                          <td className="px-3 py-2 text-center font-mono font-semibold whitespace-nowrap bg-violet-100/90">R$ {fmtCurrency(demonstrativoTotais.salarioFixo)}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-100/90" />
                          <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-100/90" />
                          <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-100/90" />
                          <td className="px-3 py-2 text-center font-mono font-semibold whitespace-nowrap bg-violet-100/90">R$ {fmtCurrency(demonstrativoTotais.bonusProdutividade)}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-100/90" />
                          <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-100/90" />
                          <td className="px-3 py-2 text-center font-mono font-bold whitespace-nowrap bg-violet-200/90">R$ {fmtCurrency(demonstrativoTotais.totalRemuneracao)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>

                <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
                  Layout inicial do demonstrativo. Valores serão alimentados na próxima etapa.
                </div>
              </div>

              <div className="print-only-all">
                <div id="demonstrativo-print-all-content">
                {demonstrativoTabsComDados.map((tab, tabIndex) => {
                  const rows = demonstrativoRowsByTab[tab.id];
                  const totais = demonstrativoTotaisByTab[tab.id];
                  return (
                    <div key={tab.id} className={`bg-white border border-slate-200 rounded-lg overflow-hidden print-surface ${tabIndex > 0 ? 'print-page-break mt-6' : ''}`}>
                      <div className="border-b border-slate-100 px-4 py-3">
                        <p className="text-sm font-bold text-slate-800">Demonstrativo de pagamento - {tab.label}</p>
                        <p className="text-xs text-slate-500">Competência {MONTHS_FULL[(demonstrativoFilter.month ?? 1) - 1]}/{demonstrativoFilter.year}</p>
                      </div>
                      <div className="overflow-visible">
                        <table className="w-full table-fixed text-xs text-slate-700">
                          <colgroup>
                            <col className="w-[220px]" />
                            <col className="w-[110px]" />
                            <col className="w-[70px]" />
                            <col className="w-[90px]" />
                            <col className="w-[90px]" />
                            <col className="w-[90px]" />
                            <col className="w-[90px]" />
                            <col className="w-[90px]" />
                            <col className="w-[90px]" />
                            <col className="w-[90px]" />
                            <col className="w-[90px]" />
                            <col className="w-[90px]" />
                            <col className="w-[110px]" />
                          </colgroup>
                          <thead className="bg-slate-800 text-white">
                            <tr>
                              <th rowSpan={2} className="px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-slate-700">Nome vendedor</th>
                              <th rowSpan={2} className="px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-slate-700">Cargo</th>
                              <th colSpan={3} className="bg-emerald-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-emerald-600">Produção</th>
                              <th rowSpan={2} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Salário Fixo</th>
                              <th colSpan={3} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Comissões</th>
                              <th rowSpan={2} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Bônus produtividade</th>
                              <th rowSpan={2} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Bônus Adicional</th>
                              <th rowSpan={2} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Participação no resultado</th>
                              <th rowSpan={2} className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap">Total remuneração</th>
                            </tr>
                            <tr>
                              <th className="bg-emerald-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-emerald-600">Peças</th>
                              <th className="bg-emerald-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-emerald-600">Acessórios</th>
                              <th className="bg-emerald-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-emerald-600">Mão de Obra</th>
                              <th className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Peças</th>
                              <th className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Acessórios</th>
                              <th className="bg-violet-700 px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-violet-600">Mão de obra</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((item, index) => {
                              const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70';
                              const salarioFixo = parseDecimal(item.salarioFixo ?? '');
                              const bonusProdutividade = parseDecimal(item.bonusProdutividade ?? '');
                              const totalRemuneracao = salarioFixo + bonusProdutividade;
                              return (
                                <tr key={`${tab.id}-${item.id}-${index}`} className={`${rowBg} border-t border-slate-100`}>
                                  <td className={`px-3 py-2 text-center whitespace-nowrap font-semibold text-slate-800 ${rowBg}`}>{item.vendedor}</td>
                                  <td className={`px-3 py-2 text-center whitespace-nowrap text-slate-700 ${rowBg}`}>{item.cargoColaborador || ''}</td>
                                  <td className="px-3 py-2 text-center whitespace-nowrap bg-emerald-50/70" />
                                  <td className="px-3 py-2 text-center whitespace-nowrap bg-emerald-50/70" />
                                  <td className="px-3 py-2 text-center whitespace-nowrap bg-emerald-50/70" />
                                  <td className="px-3 py-2 text-center whitespace-nowrap font-mono bg-violet-50/70">{salarioFixo > 0 ? `R$ ${fmtCurrency(salarioFixo)}` : ''}</td>
                                  <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-50/70" />
                                  <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-50/70" />
                                  <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-50/70" />
                                  <td className="px-3 py-2 text-center whitespace-nowrap font-mono bg-violet-50/70">{bonusProdutividade > 0 ? `R$ ${fmtCurrency(bonusProdutividade)}` : ''}</td>
                                  <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-50/70" />
                                  <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-50/70" />
                                  <td className="px-3 py-2 text-center whitespace-nowrap font-mono font-semibold bg-violet-100/80">{totalRemuneracao > 0 ? `R$ ${fmtCurrency(totalRemuneracao)}` : ''}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-slate-200 text-slate-900">
                            <tr className="border-t-2 border-slate-300">
                              <td colSpan={5} className="px-3 py-2 text-center font-semibold whitespace-nowrap">Totais</td>
                              <td className="px-3 py-2 text-center font-mono font-semibold whitespace-nowrap bg-violet-100/90">R$ {fmtCurrency(totais.salarioFixo)}</td>
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-100/90" />
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-100/90" />
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-100/90" />
                              <td className="px-3 py-2 text-center font-mono font-semibold whitespace-nowrap bg-violet-100/90">R$ {fmtCurrency(totais.bonusProdutividade)}</td>
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-100/90" />
                              <td className="px-3 py-2 text-center whitespace-nowrap bg-violet-100/90" />
                              <td className="px-3 py-2 text-center font-mono font-bold whitespace-nowrap bg-violet-200/90">R$ {fmtCurrency(totais.totalRemuneracao)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border-b border-slate-200 px-6 flex gap-0 flex-shrink-0 overflow-x-auto">
              {VENDAS_SUB_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setVendasSubTab(tab.id)}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    vendasSubTab === tab.id
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {vendasSubTab === 'mecanicos' ? (
              <div className="flex-1 p-6" style={{ minHeight: 0 }}>
                <div className="h-full bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Mecânicos</p>
                      <p className="text-xs text-slate-500">Importe um arquivo Excel para criar e alimentar a tabela.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-rose-300 text-rose-700 hover:bg-rose-50"
                        onClick={() => setConfirmDeleteMecanicos(true)}
                        disabled={mecanicosRows.length === 0 || mecanicosBloqueado}
                      >
                        Apagar dados
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={() => mecanicosInputRef.current?.click()}
                        disabled={mecanicosBloqueado}
                      >
                        Importar Excel
                      </Button>
                    </div>
                  </div>

                  {mecanicosBloqueado ? (
                    <div className="px-4 py-2 border-b border-amber-100 bg-amber-50 text-xs text-amber-700">
                      Competência atual bloqueada em Cálculo. Importação e exclusão de Mecânicos estão desabilitadas.
                    </div>
                  ) : null}

                  <div className="bg-white border-b border-slate-100 px-4 py-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-x-auto">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold whitespace-nowrap">
                          ANO
                          <select
                            value={mecanicosFilterYear}
                            onChange={(e) => setMecanicosFilterYear(Number(e.target.value))}
                            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                          >
                            {mecanicosAvailableYears.map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setMecanicosFilterMonth(null)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${mecanicosFilterMonth === null ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                          >
                            Ano todo
                          </button>
                          {MONTHS.map((month, index) => (
                            <button
                              key={month}
                              onClick={() => setMecanicosFilterMonth(index + 1)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${mecanicosFilterMonth === index + 1 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'} ${mecanicosMonthCounts[index + 1] ? 'font-semibold' : ''}`}
                            >
                              {month}
                              {mecanicosMonthCounts[index + 1] ? (
                                <span className="ml-0.5 text-[10px] opacity-70">({mecanicosMonthCounts[index + 1]})</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {filteredMecanicosRows.length} registro{filteredMecanicosRows.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500">
                      Arquivo importado e salvo localmente para reabrir depois.
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto">
                    {mecanicosRows.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-slate-400 text-sm px-6 text-center">
                        Nenhum arquivo importado ainda. Clique em Importar Excel para carregar os dados.
                      </div>
                    ) : filteredMecanicosRows.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-slate-400 text-sm px-6 text-center">
                        Nenhum registro encontrado para o período selecionado.
                      </div>
                    ) : (
                      <table className="min-w-max w-full text-xs text-slate-700">
                        <thead className="bg-slate-800 text-white sticky top-0 z-10">
                          <tr>
                            {mecanicosColumns.map((column) => (
                              <th key={column} className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-slate-700 last:border-r-0">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMecanicosRows.map((row, rowIndex) => {
                            const rowBg = rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/70';
                            return (
                              <tr key={row.id} className={`${rowBg} border-t border-slate-100`}>
                                {mecanicosColumns.map((column) => (
                                  <td key={column} className="px-3 py-2 whitespace-nowrap">
                                    {formatMecanicosCell(row.data[column] || '')}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            ) : TABLE_TABS.includes(vendasSubTab) ? (
              <div className="flex-1 p-6" style={{ minHeight: 0 }}>
                <div className="h-full bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                  {isServiceLoading && (
                    <div className="px-4 py-3 border-b border-slate-100 bg-amber-50 text-amber-800 text-sm font-medium">
                      Carregando dados da Central de Vendas VW para {serviceTabLabel} considerando apenas os departamentos {vendasSubTab === 'oficina' ? '104 e 122' : '106 e 129'}...
                    </div>
                  )}
                  {showDateFilters && (
                    <div className="bg-white border-b border-slate-100 px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 overflow-x-auto">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold whitespace-nowrap">
                            ANO
                            <select
                              value={isProdutoTab ? produtoFilterYear : activeFilterYear}
                              onChange={(e) => (isProdutoTab ? setProdutoFilterYear(Number(e.target.value)) : setActiveFilterYear(Number(e.target.value)))}
                              className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              {(isProdutoTab ? produtoAvailableYears : availableYears).map((year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => (isProdutoTab ? setProdutoFilterMonth(null) : setActiveFilterMonth(null))}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                                (isProdutoTab ? produtoFilterMonth : activeFilterMonth) === null ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              Ano todo
                            </button>
                            {MONTHS.map((month, index) => (
                              <button
                                key={month}
                                onClick={() => (isProdutoTab ? setProdutoFilterMonth(index + 1) : setActiveFilterMonth(index + 1))}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                                  (isProdutoTab ? produtoFilterMonth : activeFilterMonth) === index + 1 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                                } ${(isProdutoTab ? produtoMonthCounts[index + 1] : monthCounts[index + 1]) ? 'font-semibold' : ''}`}
                              >
                                {month}
                                {(isProdutoTab ? produtoMonthCounts[index + 1] : monthCounts[index + 1]) ? (
                                  <span className="ml-0.5 text-[10px] opacity-70">({isProdutoTab ? produtoMonthCounts[index + 1] : monthCounts[index + 1]})</span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {(isProdutoTab ? filteredProdutoRows.length : filteredPecasRows.length)} registro{(isProdutoTab ? filteredProdutoRows.length : filteredPecasRows.length) !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-800">Resumo por vendedor</p>
                              <p className="text-xs text-slate-500">Total por vendedor com detalhe por transação</p>
                            </div>
                            <span className="text-xs font-semibold text-slate-500">{(isProdutoTab ? produtoSummaryByVendor.length : summaryByVendor.length)} vendedor{(isProdutoTab ? produtoSummaryByVendor.length : summaryByVendor.length) !== 1 ? 'es' : ''}</span>
                          </div>
                          <div className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
                            {(isProdutoTab ? produtoSummaryByVendor.length : summaryByVendor.length) === 0 ? (
                              <div className="text-xs text-slate-400 py-4 text-center">Sem dados para o período selecionado.</div>
                            ) : (isProdutoTab ? produtoSummaryByVendor : summaryByVendor).map((item) => {
                              const isOpen = openVendorKeys.includes(item.vendor);
                              return (
                                <div key={item.vendor} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleAccordionItem(item.vendor, openVendorKeys, setOpenVendorKeys)}
                                    className="w-full flex items-center justify-between gap-3 text-left"
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{item.vendor}</p>
                                        <p className="text-xs text-slate-500">{item.count} registro{item.count !== 1 ? 's' : ''}</p>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-sm font-bold text-slate-800">R$ {fmtCurrency(item.total)}</p>
                                      <p className="text-[11px] text-slate-500">Total</p>
                                    </div>
                                  </button>

                                  {isOpen && (
                                    <div className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                                      {item.transactions.map((tx) => (
                                        <div key={tx.label} className="flex items-center justify-between gap-3 text-xs">
                                          <div className="min-w-0 text-slate-600">
                                            <span className="font-medium text-slate-700">{tx.label}</span>
                                            <span className="text-slate-400"> · {tx.count}</span>
                                          </div>
                                          <div className="font-mono text-slate-700 shrink-0">R$ {fmtCurrency(tx.total)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-800">Resumo por departamento</p>
                              <p className="text-xs text-slate-500">Total por departamento com detalhe por transação</p>
                            </div>
                            <span className="text-xs font-semibold text-slate-500">{(isProdutoTab ? produtoSummaryByDepartment.length : summaryByDepartment.length)} departamento{(isProdutoTab ? produtoSummaryByDepartment.length : summaryByDepartment.length) !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
                            {(isProdutoTab ? produtoSummaryByDepartment.length : summaryByDepartment.length) === 0 ? (
                              <div className="text-xs text-slate-400 py-4 text-center">Sem dados para o período selecionado.</div>
                            ) : (isProdutoTab ? produtoSummaryByDepartment : summaryByDepartment).map((item) => {
                              const isOpen = openDepartmentKeys.includes(item.department);
                              return (
                                <div key={item.department} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleAccordionItem(item.department, openDepartmentKeys, setOpenDepartmentKeys)}
                                    className="w-full flex items-center justify-between gap-3 text-left"
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{item.department}</p>
                                        <p className="text-xs text-slate-500">{item.count} registro{item.count !== 1 ? 's' : ''}</p>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-sm font-bold text-slate-800">R$ {fmtCurrency(item.total)}</p>
                                      <p className="text-[11px] text-slate-500">Total</p>
                                    </div>
                                  </button>

                                  {isOpen && (
                                    <div className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                                      {item.transactions.map((tx) => (
                                        <div key={tx.label} className="flex items-center justify-between gap-3 text-xs">
                                          <div className="min-w-0 text-slate-600">
                                            <span className="font-medium text-slate-700">{tx.label}</span>
                                            <span className="text-slate-400"> · {tx.count}</span>
                                          </div>
                                          <div className="font-mono text-slate-700 shrink-0">R$ {fmtCurrency(tx.total)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      </div>
                    </div>
                  )}
                  <div
                    ref={tableScrollRef}
                    onScroll={() => {
                      if (tableScrollRef.current && bottomScrollRef.current) {
                        bottomScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
                      }
                    }}
                    className="flex-1 overflow-auto"
                  >
                    <table className={isProdutoTab ? 'min-w-[2400px] w-full text-xs text-slate-700' : 'min-w-[2600px] w-full text-xs text-slate-700'}>
                      <thead className="bg-slate-800 text-white sticky top-0 z-10">
                        <tr>
                          {(isProdutoTab ? PRODUCT_TABLE_COLUMNS : TABLE_COLUMNS).map((column) => (
                            <th
                              key={column}
                              className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-slate-700 last:border-r-0"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(isProdutoTab ? filteredProdutoRows.length : filteredPecasRows.length) === 0 ? (
                          <tr>
                            <td
                              colSpan={(isProdutoTab ? PRODUCT_TABLE_COLUMNS.length : TABLE_COLUMNS.length)}
                              className="px-3 py-8 text-center text-slate-400 border-t border-slate-100"
                            >
                              Nenhum registro encontrado no período selecionado.
                            </td>
                          </tr>
                        ) : isProdutoTab ? (
                          filteredProdutoRows.map((row, rowIndex) => {
                            const d = row.data;
                            const qtde = n(d['QUANTIDADE']);
                            const valUnitario = n(d['VAL_UNITARIO']);
                            const valVenda = n(d['VAL_VENDA']);
                            const valImpostos = n(d['VAL_IMPOSTOS']);
                            const recLiquida = valVenda - valImpostos;
                            const custoMedio = n(d['CUSTO_MEDIO']);
                            const lucroBruto = recLiquida - custoMedio;
                            const lucroBrutoPct = recLiquida !== 0 ? (lucroBruto / recLiquida) * 100 : 0;
                            const rowBg = rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/70';

                            return (
                              <tr key={row.id} className={`${rowBg} border-t border-slate-100`}>
                                <td className="px-3 py-2 whitespace-nowrap">{d['NUMERO_NOTA_FISCAL'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['DTA_ENTRADA_SAIDA'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['TIPO_TRANSACAO'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['DEPARTAMENTO'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['NOME_VENDEDOR'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['NOME_CLIENTE'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['ITEM_ESTOQUE_PUB'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['DES_ITEM_ESTOQUE'] || '—'}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{qtde.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(valUnitario)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(valVenda)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(valImpostos)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(recLiquida)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(custoMedio)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(lucroBruto)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{fmtPercent(lucroBrutoPct)}</td>
                                <td className="px-3 py-2 text-center text-slate-300">—</td>
                                <td className="px-3 py-2 text-center text-slate-300">—</td>
                                <td className="px-3 py-2 text-center text-slate-300">—</td>
                              </tr>
                            );
                          })
                        ) : (
                          filteredPecasRows.map((row, rowIndex) => {
                            const d = row.data;
                            const key = ovKey(d);
                            const condPgto = overrides[key]?.condPgto ?? '';
                            const isOfficeRow = vendasSubTab === 'oficina';
                            const valorVenda = isOfficeRow
                              ? n(d['LIQ_NOTA_FISCAL']) + n(d['VAL_PIS_ST']) + n(d['VAL_COFINS_ST']) + n(d['VAL_CSLL'])
                              : n(d['LIQ_NOTA_FISCAL']);
                            const iss = n(d['VAL_ISS']);
                            const icms = n(d['VAL_ICMS']);
                            const pis = n(d['VAL_PIS']);
                            const cofins = n(d['VAL_COFINS']);
                            const difal = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
                            const recLiquida = isOfficeRow
                              ? valorVenda - iss - icms - pis - cofins - difal
                              : valorVenda - icms - pis - cofins - difal;
                            const taxaMLMatch = taxaMLLookup.get(d['NUMERO_NOTA_FISCAL']);
                            const tituloValML = taxaMLMatch?.data['VAL_TITULO'] ?? '';
                            const taxaMercadoLivre = tituloValML ? valorVenda - n(tituloValML) : 0;
                            const epSum = taxaEPLookup.get(d['NUMERO_NOTA_FISCAL']) ?? 0;
                            const taxaEPecas = epSum > 0 ? valorVenda - epSum : 0;
                            const custoMedio = n(d['TOT_CUSTO_MEDIO']);
                            const lucroBruto = recLiquida - taxaMercadoLivre - taxaEPecas - custoMedio;
                            const lbPct = recLiquida !== 0 ? (lucroBruto / recLiquida) * 100 : 0;
                            const rowBg = rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/70';

                            return (
                              <tr key={row.id} className={`${rowBg} border-t border-slate-100`}>
                                <td className="px-3 py-2 whitespace-nowrap">{d['NUMERO_NOTA_FISCAL'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['SERIE_NOTA_FISCAL'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['TIPO_TRANSACAO'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['DTA_DOCUMENTO'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['DEPARTAMENTO'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['NOME_VENDEDOR'] || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{condPgto || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{d['NOME_CLIENTE'] || '—'}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(valorVenda)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(iss)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(icms)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(pis)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(cofins)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(difal)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(recLiquida)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(taxaMercadoLivre)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(taxaEPecas)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(custoMedio)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">R$ {fmtCurrency(lucroBruto)}</td>
                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{fmtPercent(lbPct)}</td>
                                <td className="px-3 py-2 text-center text-slate-300">—</td>
                                <td className="px-3 py-2 text-center text-slate-300">—</td>
                                <td className="px-3 py-2 text-center text-slate-300">—</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {isProdutoTab && filteredProdutoRows.length > 0 && (
                        <tfoot className="sticky bottom-0 z-20">
                          <tr className="bg-slate-800 text-white text-xs font-semibold">
                            <td colSpan={8} className="px-3 py-2 text-left whitespace-nowrap border-t border-slate-700">
                              TOTAIS ({filteredProdutoRows.length} registros)
                            </td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">{produtoTotals.qtde.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(produtoTotals.valUnitario)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(produtoTotals.valVenda)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(produtoTotals.valImpostos)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-emerald-300 border-t border-slate-700">R$ {fmtCurrency(produtoTotals.recLiquida)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(produtoTotals.custoMedio)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-emerald-300 border-t border-slate-700">R$ {fmtCurrency(produtoTotals.lucroBruto)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-emerald-300 border-t border-slate-700">{fmtPercent(produtoTotals.lucroBrutoPct)}</td>
                            <td className="px-3 py-2 text-center text-slate-300 border-t border-slate-700">—</td>
                            <td className="px-3 py-2 text-center text-slate-300 border-t border-slate-700">—</td>
                            <td className="px-3 py-2 text-center text-slate-300 border-t border-slate-700">—</td>
                          </tr>
                        </tfoot>
                      )}
                      {(vendasSubTab === 'pecas' || vendasSubTab === 'oficina') && filteredPecasRows.length > 0 && (
                        <tfoot className="sticky bottom-0 z-20">
                          <tr className="bg-slate-800 text-white text-xs font-semibold">
                            <td colSpan={8} className="px-3 py-2 text-left whitespace-nowrap border-t border-slate-700">
                              TOTAIS ({filteredPecasRows.length} registros)
                            </td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.valorVenda : pecasTotals.valorVenda)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.iss : pecasTotals.iss)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.icms : pecasTotals.icms)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.pis : pecasTotals.pis)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.cofins : pecasTotals.cofins)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.difal : pecasTotals.difal)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-emerald-300 border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.recLiquida : pecasTotals.recLiquida)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.taxaMercadoLivre : pecasTotals.taxaMercadoLivre)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.taxaEPecas : pecasTotals.taxaEPecas)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.custoMedio : pecasTotals.custoMedio)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-emerald-300 border-t border-slate-700">R$ {fmtCurrency(vendasSubTab === 'oficina' ? oficinaTotals.lucroBruto : pecasTotals.lucroBruto)}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-emerald-300 border-t border-slate-700">{fmtPercent(vendasSubTab === 'oficina' ? oficinaTotals.lbPct : pecasTotals.lbPct)}</td>
                            <td className="px-3 py-2 text-center text-slate-300 border-t border-slate-700">—</td>
                            <td className="px-3 py-2 text-center text-slate-300 border-t border-slate-700">—</td>
                            <td className="px-3 py-2 text-center text-slate-300 border-t border-slate-700">—</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  <div
                    ref={bottomScrollRef}
                    onScroll={() => {
                      if (tableScrollRef.current && bottomScrollRef.current) {
                        tableScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
                      }
                    }}
                    className="overflow-x-auto overflow-y-hidden shrink-0 border-t border-slate-200 bg-slate-100"
                    style={{ height: 16 }}
                  >
                    <div ref={bottomScrollDummyRef} style={{ height: 12 }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                Conteúdo da aba em desenvolvimento.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
