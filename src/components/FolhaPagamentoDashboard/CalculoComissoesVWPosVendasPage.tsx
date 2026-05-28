import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Calculator, Check, Pencil, Plus, TrendingUp, UserCheck, UserX, Wallet, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { loadVPecasRows, loadVPecasDevolucaoRows, type VPecasRow } from '@/components/VendasBonificacoesDashboard/vPecasStorage';
import { loadTaxaMLRows, type TaxaMLRow } from '@/components/VendasBonificacoesDashboard/taxaMercadoLivreStorage';
import { loadTaxaEPecasRows, type TaxaEPecasRow } from '@/components/VendasBonificacoesDashboard/taxaEPecasStorage';
import { loadProdutosRows } from '@/components/VendasBonificacoesDashboard/produtosMonitoradosStorage';
import type { VPecasItemRow } from '@/components/VendasBonificacoesDashboard/vPecasItemStorage';
import { kvGet, kvSet } from '@/lib/kvClient';
import { toast } from 'sonner';
import {
  calculoPeriodoKey,
  loadCalculoPosVendasRemuneracoes,
  saveCalculoPosVendasRemuneracoes,
  upsertCalculoPosVendasRemuneracao,
  type CalculoPosVendasRemuneracao,
} from './calculoPosVendasStorage';

type VendasSubTab = 'pecas' | 'oficina' | 'funilaria' | 'acessorios' | 'produto' | 'mecanicos';
type MainTab = 'vendas' | 'calculo';
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

const OV_KEY = 'vendas_pecas_vendas_ov';
const MECANICOS_KEY = 'calculo_comissoes_vw_pos_vendas_mecanicos';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

function normalizeVendorName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function vendorKey(value: string): string {
  return normalizeVendorName(value).toLowerCase();
}

function extractVendorNames(data: Record<string, string>): string[] {
  return [
    data['NOME_VENDEDOR'],
    data['VENDEDOR'],
    data['NOME_VENDEDOR2'],
    data['VENDEDOR2'],
  ]
    .map((value) => normalizeVendorName(String(value ?? '')))
    .filter((value) => value.length > 0);
}

function getSourceLabelFromRow(data: Record<string, string>, fallback: string): string {
  const serie = (data['SERIE_NOTA_FISCAL'] ?? '').trim().toUpperCase();
  if (fallback === 'Vendas' && serie === 'RPS') return 'RPS';
  return fallback;
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
  const [calculoRemuneracoes, setCalculoRemuneracoes] = useState<CalculoPosVendasRemuneracao[]>([]);
  const [calculoLoading, setCalculoLoading] = useState(true);
  const [calculoSaving, setCalculoSaving] = useState(false);
  const [calculoModalOpen, setCalculoModalOpen] = useState(false);
  const [calculoDraft, setCalculoDraft] = useState<CalculoPosVendasRemuneracao | null>(null);
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
    loadCalculoPosVendasRemuneracoes().then((items) => {
      setCalculoRemuneracoes(items);
      setCalculoLoading(false);
    });
  }, []);

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

  const calculoSourceRows = useMemo(() => {
    const rows: Array<{ data: Record<string, string>; periodo: { year: number; month: number } | null; origem: string }> = [];

    allRows.forEach((row) => {
      rows.push({
        data: row.data,
        periodo: rowPeriod(row),
        origem: getSourceLabelFromRow(row.data, row.data['SERIE_NOTA_FISCAL'] === 'RPS' ? 'RPS' : 'Vendas'),
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
      rows.push({
        data: row.data,
        periodo: productRowPeriod(row),
        origem: 'Mecânicos',
      });
    });

    return rows.filter((row) => row.periodo && row.periodo.year === calculoYear && row.periodo.month === calculoMonth);
  }, [allRows, produtoRows, mecanicosRows, calculoYear, calculoMonth]);

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
      extractVendorNames(row.data).forEach((name) => addVendor(name, row.origem));
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
  }, [calculoSourceRows, calculoRemuneracoes, calculoPeriodo]);

  const calculoRegistered = useMemo(() => calculoVendors.filter((item) => Boolean(item.record)), [calculoVendors]);
  const calculoPending = useMemo(() => calculoVendors.filter((item) => !item.record), [calculoVendors]);

  function openCalculoDraft(vendedor: string) {
    const existing = calculoRemuneracoes.find(
      (item) => item.periodo === calculoPeriodo && vendorKey(item.vendedor) === vendorKey(vendedor),
    );

    setCalculoDraft(
      existing
        ? { ...existing }
        : {
            id: crypto.randomUUID(),
            periodo: calculoPeriodo,
            vendedor: normalizeVendorName(vendedor),
            comissionado: false,
            salarioFixo: '',
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

  async function saveCalculoDraft() {
    if (!calculoDraft) return;
    const now = new Date().toISOString();
    const payload: CalculoPosVendasRemuneracao = {
      ...calculoDraft,
      periodo: calculoPeriodo,
      vendedor: normalizeVendorName(calculoDraft.vendedor),
      salarioFixo: String(calculoDraft.salarioFixo ?? '').trim(),
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

  async function persistMecanicosStore(nextRows: VPecasItemRow[], nextColumns: string[]) {
    await kvSet(MECANICOS_KEY, { columns: nextColumns, rows: nextRows });
  }

  async function handleDeleteMecanicosPeriod() {
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
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
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
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
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
                ) : (calculoAba === 'cadastrados' ? calculoRegistered : calculoPending).length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm px-6 text-center">
                    Nenhum vendedor encontrado para esta visão.
                  </div>
                ) : (
                  <table className="min-w-[1200px] w-full text-xs text-slate-700">
                    <thead className="bg-slate-800 text-white sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-slate-700">Vendedor</th>
                        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-slate-700">Origem</th>
                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-slate-700">Vendas</th>
                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-slate-700">Comissionado</th>
                        <th className="px-3 py-2 text-right font-semibold whitespace-nowrap border-r border-slate-700">Salário fixo</th>
                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap border-r border-slate-700">Status</th>
                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(calculoAba === 'cadastrados' ? calculoRegistered : calculoPending).map((item, index) => {
                        const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70';
                        const record = item.record;
                        return (
                          <tr key={`${item.vendedor}-${index}`} className={`${rowBg} border-t border-slate-100`}>
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
                            <td className="px-3 py-2 whitespace-nowrap text-right font-mono">R$ {fmtCurrency(Number(String(record?.salarioFixo ?? '').replace(',', '.')) || 0)}</td>
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
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-7 px-3 text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
                                  onClick={() => openCalculoDraft(item.vendedor)}
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
                                  >
                                    {record.ativo ? 'Inativar' : 'Reativar'}
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
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
                          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={calculoDraft.comissionado}
                            onChange={(e) => setCalculoDraft({ ...calculoDraft, comissionado: e.target.checked })}
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
                              placeholder="0,00"
                              className="w-full border border-slate-200 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
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
                      <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={saveCalculoDraft} disabled={calculoSaving}>
                        <Check className="w-4 h-4 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
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
                        disabled={mecanicosRows.length === 0}
                      >
                        Apagar dados
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={() => mecanicosInputRef.current?.click()}
                      >
                        Importar Excel
                      </Button>
                    </div>
                  </div>

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
