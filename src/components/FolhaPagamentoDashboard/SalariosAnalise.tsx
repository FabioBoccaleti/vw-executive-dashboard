import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ScatterChart, Scatter,
  ReferenceLine, LineChart, Line, LabelList, type TooltipProps,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Users, DollarSign, Building2, Award, BarChart2, PlusCircle, X as XIcon } from 'lucide-react';
import { loadSalariosFixos, type SalarioFuncionario } from './salariosFixosStorage';
import { classifyDept, GRUPO_COLORS, GRUPO_ORDER, type GrupoDept } from './deptClassifier';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
function fmtPct(v: number) {
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}
function sal(e: SalarioFuncionario) { return parseFloat(e.salario) || 0; }

function admYears(e: SalarioFuncionario): number {
  const parts = e.dataAdmissao.split('/');
  if (parts.length < 3) return 0;
  const adm = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  return (Date.now() - adm.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

const FAIXAS = [
  { label: 'Até R$2k',      min: 0,     max: 2000  },
  { label: 'R$2k–4k',       min: 2000,  max: 4000  },
  { label: 'R$4k–6k',       min: 4000,  max: 6000  },
  { label: 'R$6k–10k',      min: 6000,  max: 10000 },
  { label: 'Acima R$10k',   min: 10000, max: Infinity },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null; // % vs período anterior
  icon: React.ReactNode;
  color: string; // tailwind bg class
}
function KpiCard({ label, value, sub, delta, icon, color }: KpiCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
      {delta !== undefined && delta !== null && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
          {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          {fmtPct(delta)} vs mês anterior
        </div>
      )}
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function CurrencyTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmtBRL(p.value as number)}</p>
      ))}
    </div>
  );
}
function CountTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// ─── Comparison periods ───────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CURRENT_YEAR_A = new Date().getFullYear();
const YEARS_A = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR_A - 2 + i);
const MAX_COMP = 3;
const PERIOD_COLORS = ['#0ea5e9', '#14b8a6', '#8b5cf6', '#f59e0b'];

interface CompPeriod { month: number; year: number; }
function periodKey(p: CompPeriod) { return `${p.year}_${String(p.month).padStart(2, '0')}`; }
function periodLabel(p: CompPeriod) { return `${MONTHS_SHORT[p.month - 1]}/${p.year}`; }
function prevOf(month: number, year: number): CompPeriod {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

function PeriodPicker({ value, onChange, onRemove }: {
  value: CompPeriod;
  onChange: (p: CompPeriod) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1 border border-slate-200">
      <select
        value={value.month}
        onChange={e => onChange({ ...value, month: parseInt(e.target.value) })}
        className="text-xs bg-transparent font-semibold text-slate-700 border-none outline-none cursor-pointer"
      >
        {MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <select
        value={value.year}
        onChange={e => onChange({ ...value, year: parseInt(e.target.value) })}
        className="text-xs bg-transparent font-semibold text-slate-700 border-none outline-none cursor-pointer"
      >
        {YEARS_A.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      {onRemove && (
        <button onClick={onRemove} className="text-slate-400 hover:text-red-400 ml-1 transition-colors">
          <XIcon className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface SalariosAnaliseProps {
  rows: SalarioFuncionario[];
  brand: 'audi' | 'vw' | 'total';
  selectedMonth: number;
  selectedYear: number;
  brandLabel: string;
  audiRows?: SalarioFuncionario[];
  vwRows?: SalarioFuncionario[];
}

export function SalariosAnalise({ rows, brand, selectedMonth, selectedYear, brandLabel, audiRows: audiRowsProp, vwRows: vwRowsProp }: SalariosAnaliseProps) {
  const [deptDrill, setDeptDrill] = useState<GrupoDept | null>(null);
  const [faixaDrill, setFaixaDrill] = useState<string | null>(null);
  const [compViewMode, setCompViewMode] = useState<'total' | 'medio'>('total');

  // ── Comparison periods state ──────────────────────────────────────────────
  const basePeriod = useMemo<CompPeriod>(() => ({ month: selectedMonth, year: selectedYear }), [selectedMonth, selectedYear]);
  const [compPeriods, setCompPeriods] = useState<CompPeriod[]>(() => [prevOf(selectedMonth, selectedYear)]);
  const [compDataMap, setCompDataMap] = useState<Record<string, SalarioFuncionario[]>>({});
  const [compLoading, setCompLoading] = useState(false);
  const [moviIdx, setMoviIdx] = useState(0);

  // ── Historical trend chart state ─────────────────────────────────────────
  const [histDept, setHistDept] = useState<'Total' | GrupoDept>('Total');
  const [histData, setHistData] = useState<{ month: number; year: number; total: number; byDept: Partial<Record<GrupoDept, number>> }[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    setCompPeriods([prevOf(selectedMonth, selectedYear)]);
    setCompDataMap({});
    setMoviIdx(0);
  }, [selectedMonth, selectedYear, brand]);

  const loadBrandData = useCallback(async (month: number, year: number): Promise<SalarioFuncionario[]> => {
    const [audi, vw] = await Promise.all([
      brand === 'audi' || brand === 'total' ? loadSalariosFixos('audi', year, month) : Promise.resolve<SalarioFuncionario[]>([]),
      brand === 'vw'   || brand === 'total' ? loadSalariosFixos('vw',   year, month) : Promise.resolve<SalarioFuncionario[]>([]),
    ]);
    return [...audi, ...vw].filter(e => !e.departamento.toLowerCase().includes('toyota'));
  }, [brand]);

  useEffect(() => {
    if (compPeriods.length === 0) return;
    let cancelled = false;
    setCompLoading(true);
    async function load() {
      const results: Record<string, SalarioFuncionario[]> = {};
      await Promise.all(compPeriods.map(async p => {
        const data = await loadBrandData(p.month, p.year);
        results[periodKey(p)] = data;
      }));
      if (!cancelled) { setCompDataMap(results); setCompLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [compPeriods, loadBrandData]);

  // ── Load last 12 months for trend chart ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setHistLoading(true);
    const window12: { month: number; year: number }[] = [];
    let m = selectedMonth, y = selectedYear;
    for (let i = 0; i < 12; i++) {
      window12.unshift({ month: m, year: y });
      m--;
      if (m === 0) { m = 12; y--; }
    }
    async function load() {
      const results = await Promise.all(
        window12.map(async ({ month, year }) => {
          const data = await loadBrandData(month, year);
          const cl = data
            .map(e => ({ ...e, grupo: classifyDept(e.departamento) }))
            .filter(e => e.grupo !== 'Afastados');
          const total = cl.reduce((a, e) => a + sal(e), 0);
          const byDept: Partial<Record<GrupoDept, number>> = {};
          for (const e of cl) {
            byDept[e.grupo] = (byDept[e.grupo] ?? 0) + sal(e);
          }
          return { month, year, total, byDept };
        })
      );
      if (!cancelled) { setHistData(results); setHistLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedMonth, selectedYear, loadBrandData]);

  // ── Classify current period ───────────────────────────────────────────────
  // Departamentos toyota são completamente ignorados (não entram em nenhuma análise nem tabela)
  const classified = useMemo(() =>
    rows
      .filter(e => !e.departamento.toLowerCase().includes('toyota'))
      .map(e => ({ ...e, grupo: classifyDept(e.departamento) })),
    [rows]);

  // Afastados excluídos de TODA análise (totais, headcount, gráficos, movimentação)
  const activeClassified = useMemo(() =>
    classified.filter(e => e.grupo !== 'Afastados'), [classified]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalFolha       = useMemo(() => activeClassified.reduce((a, e) => a + sal(e), 0), [activeClassified]);
  const headcount        = activeClassified.length;
  const headcountComFixo = useMemo(() => activeClassified.filter(e => sal(e) > 0).length, [activeClassified]);
  const headcountComiss  = headcount - headcountComFixo;
  // Custo médio exclui colaboradores 100% comissionados (fixo = 0) para não distorcer a média
  const custoMedio = headcountComFixo > 0 ? totalFolha / headcountComFixo : 0;

  // KPI delta vs first comparison period (também exclui Afastados)
  const prevData = useMemo(() =>
    compPeriods.length > 0
      ? (compDataMap[periodKey(compPeriods[0])] ?? [])
          .map(e => ({ ...e, grupo: classifyDept(e.departamento) }))
          .filter(e => e.grupo !== 'Afastados')
      : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compPeriods, compDataMap]);
  const prevTotal    = prevData.reduce((a, e) => a + sal(e), 0);
  const prevHead     = prevData.length;
  const prevCountRem = prevData.filter(e => sal(e) > 0).length;
  const deltaTotal = prevTotal > 0 ? ((totalFolha - prevTotal) / prevTotal) * 100 : null;
  const deltaHead  = prevHead  > 0 ? ((headcount  - prevHead ) / prevHead ) * 100 : null;
  const deltaCusto = prevCountRem > 0 && prevTotal > 0
    ? ((custoMedio - prevTotal / prevCountRem) / (prevTotal / prevCountRem)) * 100
    : null;

  // Maior grupo
  const byGrupo = useMemo(() => {
    const map = new Map<GrupoDept, { total: number; count: number; countRemunerado: number }>();
    for (const e of activeClassified) {
      const g = e.grupo;
      const cur = map.get(g) ?? { total: 0, count: 0, countRemunerado: 0 };
      map.set(g, {
        total:           cur.total + sal(e),
        count:           cur.count + 1,
        countRemunerado: cur.countRemunerado + (sal(e) > 0 ? 1 : 0),
      });
    }
    return map;
  }, [activeClassified]);

  const maiorGrupo = useMemo(() => {
    let best: GrupoDept | null = null;
    let bestVal = 0;
    for (const [g, v] of byGrupo) {
      if (v.total > bestVal) { bestVal = v.total; best = g; }
    }
    return best;
  }, [byGrupo]);

  // ── 1. Custo por grupo (bar chart) ──────────────────────────────────────────
  const custoPorGrupo = useMemo(() =>
    GRUPO_ORDER
      .filter(g => byGrupo.has(g))
      .map(g => ({
        grupo:  g,
        total:  byGrupo.get(g)!.total,
        count:  byGrupo.get(g)!.count,
        // custo médio: ignora colaboradores 100% comissionados (salário fixo = 0)
        medio:  byGrupo.get(g)!.countRemunerado > 0
                  ? byGrupo.get(g)!.total / byGrupo.get(g)!.countRemunerado
                  : 0,
        fill:   GRUPO_COLORS[g],
      }))
      .sort((a, b) => b.total - a.total),
    [byGrupo]);

  // ── 2. Headcount vs Folha ────────────────────────────────────────────────────
  const headVsFolha = custoPorGrupo.map(g => ({
    grupo: g.grupo,
    headcount: g.count,
    folha: Math.round(g.total),
    fill: g.fill,
  }));

  // ── 3. Distribuição por faixa salarial ───────────────────────────────────────
  const faixaDist = useMemo(() =>
    FAIXAS.map(f => ({
      faixa: f.label,
      count: activeClassified.filter(e => sal(e) >= f.min && sal(e) < f.max).length,
    })),
    [activeClassified]);

  // ── 4. Scatter: tempo de casa vs salário ─────────────────────────────────────
  const scatterData = useMemo(() =>
    activeClassified.map(e => ({
      nome:  e.nome,
      anos:  parseFloat(admYears(e).toFixed(1)),
      salario: sal(e),
      grupo: e.grupo,
    })).filter(e => e.anos >= 0 && e.salario > 0),
    [activeClassified]);

  const avgSalario = headcount > 0 ? totalFolha / headcount : 0;

  // ── Multi-period comparison data ──────────────────────────────────────────
  const allPeriods = useMemo<CompPeriod[]>(() => [basePeriod, ...compPeriods], [basePeriod, compPeriods]);

  const compKpiRows = useMemo(() =>
    allPeriods.map((p, i) => {
      const raw = i === 0
        ? activeClassified
        : (compDataMap[periodKey(p)] ?? [])
            .map(e => ({ ...e, grupo: classifyDept(e.departamento) }))
            .filter(e => e.grupo !== 'Afastados');
      const total = raw.reduce((a, e) => a + sal(e), 0);
      const hc    = raw.length;
      const countRem = raw.filter(e => sal(e) > 0).length;
      return { label: periodLabel(p), total, hc, medio: countRem > 0 ? total / countRem : 0, color: PERIOD_COLORS[i] };
    }),
    [allPeriods, activeClassified, compDataMap]);

  const compDeptBars = useMemo(() =>
    GRUPO_ORDER.filter(g => byGrupo.has(g) && g !== 'Afastados').map(g => {
      const entry: Record<string, number | string> = { grupo: g };
      allPeriods.forEach((p, i) => {
        const raw = i === 0
          ? activeClassified
          : (compDataMap[periodKey(p)] ?? [])
              .map(e => ({ ...e, grupo: classifyDept(e.departamento) }))
              .filter(e => e.grupo !== 'Afastados');
        entry[periodLabel(p)] = raw.filter(e => e.grupo === g).reduce((a, e) => a + sal(e), 0);
      });
      return entry;
    }),
    [allPeriods, activeClassified, compDataMap, byGrupo]);

  // ── Delta HC & Folha por Departamento (vs período mais próximo) ─────────────
  const closestCompPeriod = useMemo<CompPeriod | null>(() => {
    if (compPeriods.length === 0) return null;
    const baseMonths = basePeriod.year * 12 + basePeriod.month;
    return compPeriods.reduce((best, p) => {
      const distBest = Math.abs(best.year * 12 + best.month - baseMonths);
      const distP    = Math.abs(p.year   * 12 + p.month    - baseMonths);
      return distP < distBest ? p : best;
    });
  }, [compPeriods, basePeriod]);

  const deltaByDept = useMemo(() => {
    if (!closestCompPeriod) return [];
    const prevRaw = (compDataMap[periodKey(closestCompPeriod)] ?? [])
      .map(e => ({ ...e, grupo: classifyDept(e.departamento) }))
      .filter(e => e.grupo !== 'Afastados');
    return GRUPO_ORDER
      .filter(g => g !== 'Afastados' && g !== 'Outros' && byGrupo.has(g))
      .map(g => {
        const curHC    = activeClassified.filter(e => e.grupo === g).length;
        const prevHC   = prevRaw.filter(e => e.grupo === g).length;
        const curFolha = activeClassified.filter(e => e.grupo === g).reduce((a, e) => a + sal(e), 0);
        const prevFolha= prevRaw.filter(e => e.grupo === g).reduce((a, e) => a + sal(e), 0);
        const deltaHC    = prevHC    > 0 ? ((curHC    - prevHC)    / prevHC)    * 100 : null;
        const deltaFolha = prevFolha > 0 ? ((curFolha - prevFolha) / prevFolha) * 100 : null;
        return {
          grupo: g,
          fill:  GRUPO_COLORS[g],
          deltaHC,
          deltaFolha,
          // Para as barras: valor real ou mínimo visual de 0.2 se zero (para aparecer no gráfico)
          deltaHCBar:    deltaHC    !== 0 ? (deltaHC    ?? 0.2) : 0.2,
          deltaFolhaBar: deltaFolha !== 0 ? (deltaFolha ?? 0.2) : 0.2,
          curHC, prevHC,
          curFolha, prevFolha,
        };
      });
  }, [closestCompPeriod, compDataMap, activeClassified, byGrupo]);

  // ── Movimentação Salarial ─────────────────────────────────────────────────
  const safeMoviIdx     = Math.min(moviIdx, Math.max(0, compPeriods.length - 1));
  const moviPrev        = compPeriods[safeMoviIdx] ?? null;
  const moviPrevData    = useMemo(() =>
    moviPrev ? (compDataMap[periodKey(moviPrev)] ?? []) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compDataMap, safeMoviIdx]);
  const moviPrevClassified = useMemo(() =>
    moviPrevData
      .map(e => ({ ...e, grupo: classifyDept(e.departamento) }))
      .filter(e => e.grupo !== 'Afastados'),
    [moviPrevData]);

  const movimentacao = useMemo(() => {
    if (moviPrevData.length === 0) return null;
    const prevMap = new Map(moviPrevClassified.map(e => [e.codigo, e]));
    const currMap = new Map(activeClassified.map(e => [e.codigo, e]));
    const novos:      typeof activeClassified        = [];
    const desligados: typeof moviPrevClassified      = [];
    const alterados:  { cur: typeof activeClassified[0]; prev: typeof moviPrevClassified[0]; delta: number; deltaPct: number }[] = [];
    const estaveis:   typeof activeClassified        = [];
    for (const e of activeClassified) {
      const prev = prevMap.get(e.codigo);
      if (!prev) { novos.push(e); continue; }
      const d = sal(e) - sal(prev);
      if (Math.abs(d) > 0.01) alterados.push({ cur: e, prev, delta: d, deltaPct: sal(prev) > 0 ? (d / sal(prev)) * 100 : 0 });
      else estaveis.push(e);
    }
    for (const e of moviPrevClassified) { if (!currMap.has(e.codigo)) desligados.push(e); }
    const avgDelta = alterados.length > 0 ? alterados.reduce((a, x) => a + x.deltaPct, 0) / alterados.length : 0;
    return { novos, desligados, alterados, estaveis, avgDelta };
  }, [activeClassified, moviPrevClassified, moviPrevData]);

  // ── Drill faixa salarial ───────────────────────────────────────────────
  const faixaDrillRows = useMemo(() => {
    if (!faixaDrill) return [];
    const faixa = FAIXAS.find(f => f.label === faixaDrill);
    if (!faixa) return [];
    return activeClassified
      .filter(e => sal(e) >= faixa.min && sal(e) < faixa.max)
      .sort((a, b) => sal(b) - sal(a));
  }, [faixaDrill, activeClassified]);

  // ── Drill ─────────────────────────────────────────────────────────────────
  const drillRows = useMemo(() =>
    deptDrill ? activeClassified.filter(e => e.grupo === deptDrill).sort((a, b) => sal(b) - sal(a)) : [],
    [deptDrill, activeClassified]);

  // ── Admitidos no mês selecionado (╰ dataAdmissao DD/MM/YYYY) ───────────────
  const admitidosNoMes = useMemo(() =>
    activeClassified.filter(e => {
      const parts = e.dataAdmissao.split('/');
      if (parts.length < 3) return false;
      return parseInt(parts[1]) === selectedMonth && parseInt(parts[2]) === selectedYear;
    }).sort((a, b) => a.nome.localeCompare(b.nome)),
    [activeClassified, selectedMonth, selectedYear]);

  // ── Afastados (somente para listagem no rodapé) ───────────────────────────
  const afastados = useMemo(() =>
    classified.filter(e => e.grupo === 'Afastados').sort((a, b) => a.nome.localeCompare(b.nome)),
    [classified]);

  const histChartData = useMemo(() =>
    histData.map((d, i) => {
      const value = histDept === 'Total' ? d.total : (d.byDept[histDept as GrupoDept] ?? 0);
      const prev  = i > 0 ? (histDept === 'Total' ? histData[i - 1].total : (histData[i - 1].byDept[histDept as GrupoDept] ?? 0)) : null;
      const deltaR   = prev !== null ? value - prev : null;
      const deltaPct = prev !== null && prev > 0 ? ((value - prev) / prev) * 100 : null;
      return {
        label:    `${MONTHS_SHORT[d.month - 1]}/${String(d.year).slice(2)}`,
        value,
        deltaR,
        deltaPct,
      };
    }),
    [histData, histDept]);

  // ── Audi vs VW comparative data (only used when brand === 'total') ─────────
  const audiActive = useMemo(() =>
    (audiRowsProp ?? [])
      .filter(e => !e.departamento.toLowerCase().includes('toyota'))
      .map(e => ({ ...e, grupo: classifyDept(e.departamento) }))
      .filter(e => e.grupo !== 'Afastados'),
    [audiRowsProp]);

  const vwActive = useMemo(() =>
    (vwRowsProp ?? [])
      .filter(e => !e.departamento.toLowerCase().includes('toyota'))
      .map(e => ({ ...e, grupo: classifyDept(e.departamento) }))
      .filter(e => e.grupo !== 'Afastados'),
    [vwRowsProp]);

  const audiTotalFolha    = useMemo(() => audiActive.reduce((a, e) => a + sal(e), 0), [audiActive]);
  const vwTotalFolha      = useMemo(() => vwActive.reduce((a, e) => a + sal(e), 0), [vwActive]);
  const audiHeadcount     = audiActive.length;
  const vwHeadcount       = vwActive.length;
  const audiCountRem      = useMemo(() => audiActive.filter(e => sal(e) > 0).length, [audiActive]);
  const vwCountRem        = useMemo(() => vwActive.filter(e => sal(e) > 0).length, [vwActive]);
  const audiCustoMedio    = audiCountRem > 0 ? audiTotalFolha / audiCountRem : 0;
  const vwCustoMedio      = vwCountRem   > 0 ? vwTotalFolha   / vwCountRem   : 0;
  const grandTotalFolha   = audiTotalFolha + vwTotalFolha;
  const audiPct           = grandTotalFolha > 0 ? (audiTotalFolha / grandTotalFolha) * 100 : 0;
  const vwPct             = grandTotalFolha > 0 ? (vwTotalFolha   / grandTotalFolha) * 100 : 0;

  const compDeptData = useMemo(() =>
    GRUPO_ORDER
      .filter(g => g !== 'Afastados')
      .map(g => {
        const aTot  = audiActive.filter(e => e.grupo === g).reduce((s, e) => s + sal(e), 0);
        const vTot  = vwActive.filter(e => e.grupo === g).reduce((s, e) => s + sal(e), 0);
        const aCnt  = audiActive.filter(e => e.grupo === g && sal(e) > 0).length;
        const vCnt  = vwActive.filter(e => e.grupo === g && sal(e) > 0).length;
        const aMed  = aCnt > 0 ? aTot / aCnt : 0;
        const vMed  = vCnt > 0 ? vTot / vCnt : 0;
        const delta = aTot + vTot > 0 ? Math.abs(aTot - vTot) / Math.max(aTot, vTot) * 100 : 0;
        return { grupo: g, audi: aTot, vw: vTot, audiMed: aMed, vwMed: vMed, delta };
      })
      .filter(d => d.audi > 0 || d.vw > 0),
    [audiActive, vwActive]);

  const maxGapDept = useMemo(() => {
    if (compDeptData.length === 0) return null;
    return compDeptData.reduce((best, d) => d.delta > best.delta ? d : best).grupo;
  }, [compDeptData]);

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 p-8">
        <BarChart2 className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">Nenhum dado de {brandLabel} para o período selecionado.</p>
        <p className="text-xs text-slate-300">Importe o TXT na aba Relação de Salários Fixos.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50 space-y-6">

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total da Folha"
          value={fmtBRL(totalFolha)}
          delta={deltaTotal}
          icon={<DollarSign className="w-4 h-4 text-teal-600" />}
          color="bg-teal-50"
        />
        <KpiCard
          label="Headcount"
          value={String(headcount)}
          sub={headcountComiss > 0 ? `${headcountComFixo} com fixo · ${headcountComiss} comissionados` : undefined}
          delta={deltaHead}
          icon={<Users className="w-4 h-4 text-blue-600" />}
          color="bg-blue-50"
        />
        <KpiCard
          label="Custo Médio / Colaborador"
          value={fmtBRL(custoMedio)}
          sub={headcountComiss > 0 ? `Calculado sobre ${headcountComFixo} de ${headcount} colaboradores` : undefined}
          delta={deltaCusto}
          icon={<Award className="w-4 h-4 text-violet-600" />}
          color="bg-violet-50"
        />
        <KpiCard
          label="Maior Departamento"
          value={maiorGrupo ?? '—'}
          sub={maiorGrupo ? `${fmtBRL(byGrupo.get(maiorGrupo)!.total)} · ${byGrupo.get(maiorGrupo)!.count} func.` : undefined}
          icon={<Building2 className="w-4 h-4 text-amber-600" />}
          color="bg-amber-50"
        />
      </div>

      {/* ── Comparativo de Períodos ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-700">Comparativo de Períodos</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Base period (locked) */}
            <div className="flex items-center gap-1 bg-sky-100 text-sky-700 rounded-lg px-2.5 py-1 text-xs font-semibold border border-sky-200">
              {periodLabel(basePeriod)} <span className="text-sky-400 ml-1 font-normal">base</span>
            </div>
            {compPeriods.map((p, i) => (
              <PeriodPicker
                key={i}
                value={p}
                onChange={np => setCompPeriods(prev => prev.map((x, j) => j === i ? np : x))}
                onRemove={() => {
                  setCompPeriods(prev => prev.filter((_, j) => j !== i));
                  setMoviIdx(idx => Math.min(idx, Math.max(0, compPeriods.length - 2)));
                }}
              />
            ))}
            {compPeriods.length < MAX_COMP && (
              <button
                onClick={() => setCompPeriods(prev => {
                  const last = prev[prev.length - 1] ?? basePeriod;
                  return [...prev, prevOf(last.month, last.year)];
                })}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-semibold px-2 py-1 rounded-lg hover:bg-teal-50 border border-dashed border-teal-300 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Adicionar período
              </button>
            )}
            {compLoading && <span className="text-xs text-slate-400 italic">carregando...</span>}
          </div>
        </div>
        {/* KPI summary table */}
        <div className="overflow-auto mb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-500">Indicador</th>
                {compKpiRows.map((c, i) => (
                  <th key={i} className="text-right px-3 py-2 font-semibold" style={{ color: c.color }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                { key: 'total' as const, label: 'Total da Folha', fmt: fmtBRL },
                { key: 'hc'    as const, label: 'Headcount',      fmt: (v: number) => String(v) },
                { key: 'medio' as const, label: 'Custo Médio',    fmt: fmtBRL },
              ]).map(row => (
                <tr key={row.key} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-600">{row.label}</td>
                  {compKpiRows.map((c, i) => {
                    const val  = c[row.key] as number;
                    const base = compKpiRows[0][row.key] as number;
                    const delta = i > 0 && val > 0 ? ((base - val) / val) * 100 : null;
                    return (
                      <td key={i} className="px-3 py-2 text-right">
                        <span className="font-mono text-slate-800">{row.fmt(val)}</span>
                        {delta !== null && (
                          <span className={`ml-1.5 text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            ({fmtPct(delta)})
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Grouped dept bar chart */}
        {compPeriods.length > 0 && compDeptBars.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compDeptBars}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grupo" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} width={82} />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend />
              {allPeriods.map((p, i) => (
                <Bar key={i} dataKey={periodLabel(p)} fill={PERIOD_COLORS[i]} radius={[4, 4, 0, 0]} opacity={0.85} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Row 1: Custo por Departamento + Headcount vs Folha ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Custo por Departamento — com drill */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-slate-700">Custo da Folha por Departamento</h3>
            {deptDrill && (
              <button
                onClick={() => setDeptDrill(null)}
                className="text-xs text-teal-600 hover:underline"
              >
                ← voltar
              </button>
            )}
          </div>
          {!deptDrill && (
            <p className="text-xs text-slate-400 mb-3">💡 Clique em um departamento para ver os colaboradores</p>
          )}

          {!deptDrill ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={custoPorGrupo} layout="vertical" onClick={d => d?.activePayload && setDeptDrill(d.activePayload[0]?.payload?.grupo)}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="grupo" tick={{ fontSize: 11 }} width={90} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="total" name="Total Folha" radius={[0, 4, 4, 0]} cursor="pointer">
                  {custoPorGrupo.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">
                {deptDrill} — {drillRows.length} colaboradores · {fmtBRL(drillRows.reduce((a, e) => a + sal(e), 0))}
              </p>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Nome</th>
                      <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Cargo</th>
                      <th className="text-right px-2 py-1.5 font-semibold text-slate-500">Salário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillRows.map(e => (
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-1.5 font-medium text-slate-800">{e.nome}</td>
                        <td className="px-2 py-1.5 text-slate-500">{e.cargo}</td>
                        <td className="px-2 py-1.5 text-right text-slate-800 font-mono">{fmtBRL(sal(e))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Variação HC & Folha por Departamento */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Variação HC &amp; Folha por Departamento</h3>
              {closestCompPeriod && (
                <p className="text-xs text-slate-400 mt-0.5">
                  vs <span className="font-semibold text-slate-500">{periodLabel(closestCompPeriod)}</span>
                  {compPeriods.length > 1 && <span className="ml-1 text-slate-300">(período mais próximo)</span>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#38bdf8' }} /> Δ% Headcount</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#14b8a6' }} /> Δ% Folha</span>
            </div>
          </div>

          {!closestCompPeriod ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-xs italic">
              Adicione um período no &quot;Comparativo de Períodos&quot; acima para ver a variação.
            </div>
          ) : compLoading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-xs">Carregando...</div>
          ) : deltaByDept.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-xs italic">
              Sem dados para {periodLabel(closestCompPeriod)}.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deltaByDept} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grupo" tick={{ fontSize: 10 }} />
                <YAxis
                  tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                  tick={{ fontSize: 10 }}
                  domain={['auto', 'auto']}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = deltaByDept.find(x => x.grupo === label);
                    if (!d) return null;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[200px]">
                        <p className="font-bold text-slate-700 mb-2">{label}</p>
                        <div className="space-y-1.5">
                          <div>
                            <p className="text-slate-500 font-semibold mb-0.5">Headcount</p>
                            {d.prevHC === 0 && d.curHC > 0 ? (
                              <p className="text-amber-500 italic">Sem dados de comparação para HC</p>
                            ) : (
                              <p className="text-slate-700">{d.prevHC} → {d.curHC}
                                {d.deltaHC !== null ? (
                                  <span className={`ml-1.5 font-bold ${
                                    d.deltaHC > 0 ? 'text-emerald-600' : d.deltaHC < 0 ? 'text-red-500' : 'text-slate-400'
                                  }`}>{d.deltaHC >= 0 ? '+' : ''}{d.deltaHC.toFixed(1)}%</span>
                                ) : <span className="ml-1.5 text-slate-400">0,0%</span>}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-slate-500 font-semibold mb-0.5">Folha</p>
                            {d.prevFolha === 0 && d.curFolha > 0 ? (
                              <p className="text-amber-500 italic">Sem dados de comparação para Folha</p>
                            ) : (
                              <p className="text-slate-700">{fmtBRL(d.prevFolha)} → {fmtBRL(d.curFolha)}
                                {d.deltaFolha !== null ? (
                                  <span className={`ml-1.5 font-bold ${
                                    d.deltaFolha > 0 ? 'text-emerald-600' : d.deltaFolha < 0 ? 'text-red-500' : 'text-slate-400'
                                  }`}>{d.deltaFolha >= 0 ? '+' : ''}{d.deltaFolha.toFixed(1)}%</span>
                                ) : <span className="ml-1.5 text-slate-400">0,0%</span>}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="deltaHCBar" name="Δ% Headcount" fill="#38bdf8" radius={[3, 3, 0, 0]} opacity={0.9}>
                  <LabelList
                    dataKey="deltaHCBar"
                    position="top"
                    style={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }}
                    formatter={(v: number) => Math.abs(v) <= 0.2 ? '0%' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                  />
                </Bar>
                <Bar dataKey="deltaFolhaBar" name="Δ% Folha" fill="#14b8a6" radius={[3, 3, 0, 0]} opacity={0.85}>
                  <LabelList
                    dataKey="deltaFolhaBar"
                    position="top"
                    style={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }}
                    formatter={(v: number) => Math.abs(v) <= 0.2 ? '0%' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 2: Faixa Salarial + Custo Médio por Dept ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Distribuição por Faixa Salarial */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-slate-700">Distribuição por Faixa Salarial</h3>
            {faixaDrill && (
              <button onClick={() => setFaixaDrill(null)} className="text-xs text-teal-600 hover:underline">
                ← voltar
              </button>
            )}
          </div>
          {!faixaDrill && (
            <p className="text-xs text-slate-400 mb-3">💡 Clique em uma faixa para ver os colaboradores</p>
          )}

          {!faixaDrill ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={faixaDist} onClick={d => d?.activePayload && setFaixaDrill(d.activePayload[0]?.payload?.faixa)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="faixa" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="count" name="Colaboradores" fill="#14b8a6" radius={[4, 4, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">
                {faixaDrill} — {faixaDrillRows.length} colaboradores
              </p>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Nome</th>
                      <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Cargo</th>
                      <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Departamento</th>
                      <th className="text-right px-2 py-1.5 font-semibold text-slate-500">Salário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faixaDrillRows.map(e => (
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-1.5 font-medium text-slate-800">{e.nome}</td>
                        <td className="px-2 py-1.5 text-slate-500">{e.cargo}</td>
                        <td className="px-2 py-1.5 text-slate-500">{e.grupo}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-800">{fmtBRL(sal(e))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Custo Médio por Departamento */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-1">Custo Médio por Colaborador / Departamento</h3>
          <p className="text-xs text-slate-400 mb-4">Colaboradores 100% comissionados (salário fixo R$0) são excluídos deste cálculo.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={custoPorGrupo} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="grupo" tick={{ fontSize: 11 }} width={90} />
              <Tooltip content={<CurrencyTooltip />} />
              <ReferenceLine x={custoMedio} stroke="#94a3b8" strokeDasharray="4 2" label={{ value: 'Média', fill: '#94a3b8', fontSize: 10 }} />
              <Bar dataKey="medio" name="Custo Médio" radius={[0, 4, 4, 0]}>
                {custoPorGrupo.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 3: Tempo de Casa vs Salário (scatter) ──────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Tempo de Casa vs. Salário</h3>
        <p className="text-xs text-slate-400 mb-4">Cada ponto = 1 colaborador. Linha tracejada = salário médio.</p>
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="anos" name="Anos de casa" type="number" unit=" anos" tick={{ fontSize: 10 }} label={{ value: 'Tempo de Casa (anos)', position: 'insideBottom', offset: -4, fontSize: 10 }} />
            <YAxis dataKey="salario" name="Salário" type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg shadow p-2 text-xs max-w-52">
                    <p className="font-semibold text-slate-800 mb-0.5">{d?.nome}</p>
                    <p className="text-slate-500">{d?.grupo}</p>
                    <p className="text-slate-600">Admissão: {d?.anos} anos</p>
                    <p className="text-teal-700 font-semibold">{fmtBRL(d?.salario)}</p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={custoMedio} stroke="#94a3b8" strokeDasharray="4 2" />
            {GRUPO_ORDER.filter(g => scatterData.some(d => d.grupo === g)).map(g => (
              <Scatter
                key={g}
                name={g}
                data={scatterData.filter(d => d.grupo === g)}
                fill={GRUPO_COLORS[g]}
                opacity={0.8}
              />
            ))}
            <Legend />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* ── Movimentação Salarial ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-700">Movimentação Salarial</h3>
          {compPeriods.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              Comparando com:
              <select
                value={safeMoviIdx}
                onChange={e => setMoviIdx(parseInt(e.target.value))}
                className="text-xs bg-slate-100 font-semibold text-slate-700 rounded px-2 py-1 border border-slate-200 outline-none"
              >
                {compPeriods.map((p, i) => (
                  <option key={i} value={i}>{periodLabel(p)}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {!movimentacao ? (
          <div className="py-6 text-center text-xs text-slate-400 italic">
            {compLoading
              ? 'Carregando dados...'
              : compPeriods.length === 0
                ? 'Adicione um período de comparação acima para ver a movimentação.'
                : `Nenhum dado encontrado para ${moviPrev ? periodLabel(moviPrev) : '—'}. Verifique se esse período foi importado na aba Relação.`}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-4">
              Comparativo com {moviPrev ? periodLabel(moviPrev) : '—'}. Δ médio dos reajustes:{' '}
              <span className={`font-semibold ${movimentacao.avgDelta > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                {fmtPct(movimentacao.avgDelta)}
              </span>
            </p>
            {/* Resumo badges */}
            <div className="flex flex-wrap gap-3 mb-4">
              {[
                { label: 'Admissões',     count: movimentacao.novos.length,     color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { label: 'Desligamentos', count: movimentacao.desligados.length, color: 'bg-red-50 text-red-700 border-red-200' },
                { label: 'Reajustes',     count: movimentacao.alterados.length,  color: 'bg-amber-50 text-amber-700 border-amber-200' },
                { label: 'Estáveis',      count: movimentacao.estaveis.length,   color: 'bg-slate-50 text-slate-600 border-slate-200' },
              ].map(b => (
                <div key={b.label} className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 text-xs font-semibold ${b.color}`}>
                  <span className="text-base font-bold">{b.count}</span> {b.label}
                </div>
              ))}
            </div>
            {/* Tabela de reajustes */}
            {movimentacao.alterados.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Reajustes — acima da média marcados em âmbar
                </p>
                <div className="overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Nome</th>
                        <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Departamento</th>
                        <th className="text-right px-2 py-1.5 font-semibold text-slate-500">Anterior</th>
                        <th className="text-right px-2 py-1.5 font-semibold text-slate-500">Atual</th>
                        <th className="text-right px-2 py-1.5 font-semibold text-slate-500">Δ R$</th>
                        <th className="text-right px-2 py-1.5 font-semibold text-slate-500">Δ%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...movimentacao.alterados]
                        .sort((a, b) => b.deltaPct - a.deltaPct)
                        .map((m, i) => {
                          const acimaMed = m.deltaPct > movimentacao.avgDelta && movimentacao.avgDelta > 0;
                          return (
                            <tr key={i} className={`border-b border-slate-100 ${acimaMed ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                              <td className="px-2 py-1.5 font-medium text-slate-800">{m.cur.nome}</td>
                              <td className="px-2 py-1.5 text-slate-500">{m.cur.grupo}</td>
                              <td className="px-2 py-1.5 text-right text-slate-500 font-mono">{fmtBRL(sal(m.prev))}</td>
                              <td className="px-2 py-1.5 text-right text-slate-800 font-mono">{fmtBRL(sal(m.cur))}</td>
                              <td className={`px-2 py-1.5 text-right font-mono font-semibold ${m.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {m.delta >= 0 ? '+' : ''}{fmtBRL(m.delta)}
                              </td>
                              <td className={`px-2 py-1.5 text-right font-semibold ${acimaMed ? 'text-amber-700' : m.deltaPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {fmtPct(m.deltaPct)}{acimaMed && ' ▲'}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Admitidos no Mês ─────────────────────────────────────────── */}
      {admitidosNoMes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-700">Admitidos no Mês</h3>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
              {admitidosNoMes.length}
            </span>
          </div>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Nome</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Departamento</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Cargo</th>
                  <th className="text-right px-2 py-1.5 font-semibold text-slate-500">Salário</th>
                </tr>
              </thead>
              <tbody>
                {admitidosNoMes.map(e => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-1.5 font-medium text-slate-800">{e.nome}</td>
                    <td className="px-2 py-1.5 text-slate-500">{e.grupo}</td>
                    <td className="px-2 py-1.5 text-slate-500">{e.cargo}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-800">
                      {sal(e) > 0 ? fmtBRL(sal(e)) : <span className="text-slate-300">comissionado</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Desligados no Mês ────────────────────────────────────────────── */}
      {movimentacao && movimentacao.desligados.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-slate-700">Desligados no Mês</h3>
            <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full border border-red-200">
              {movimentacao.desligados.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Presentes em {moviPrev ? periodLabel(moviPrev) : '—'} e ausentes no período atual.
          </p>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Nome</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Departamento</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Cargo</th>
                  <th className="text-right px-2 py-1.5 font-semibold text-slate-500">Último Salário</th>
                </tr>
              </thead>
              <tbody>
                {movimentacao.desligados.sort((a, b) => a.nome.localeCompare(b.nome)).map(e => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-1.5 font-medium text-slate-700">{e.nome}</td>
                    <td className="px-2 py-1.5 text-slate-500">{e.grupo}</td>
                    <td className="px-2 py-1.5 text-slate-500">{e.cargo}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-500">
                      {sal(e) > 0 ? fmtBRL(sal(e)) : <span className="text-slate-300">comissionado</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Colaboradores Afastados ───────────────────────────────────────── */}
      {afastados.length > 0 && (
        <details className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group">
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-bold text-slate-500">Colaboradores Afastados</span>
              <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                {afastados.length}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Não incluídos nas análises acima · clique para expandir</span>
          </summary>
          <div className="px-4 pb-4 pt-1">
            <div className="overflow-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Nome</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Cargo</th>
                    <th className="text-left px-2 py-1.5 font-semibold text-slate-500">Departamento</th>
                    <th className="text-right px-2 py-1.5 font-semibold text-slate-500">Salário</th>
                    <th className="text-right px-2 py-1.5 font-semibold text-slate-500">Admissão</th>
                  </tr>
                </thead>
                <tbody>
                  {afastados.map(e => (
                    <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-1.5 font-medium text-slate-600">{e.nome}</td>
                      <td className="px-2 py-1.5 text-slate-400">{e.cargo}</td>
                      <td className="px-2 py-1.5 text-slate-400">{e.departamento}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-500">{sal(e) > 0 ? fmtBRL(sal(e)) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-2 py-1.5 text-right text-slate-400">{e.dataAdmissao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}

      {/* ── Evolução Histórica da Folha ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Evolução da Folha — Últimos 12 Meses</h3>
            <p className="text-xs text-slate-400 mt-0.5">Passe o mouse sobre os pontos para ver a variação em R$ e %.</p>
          </div>
          <select
            value={histDept}
            onChange={e => setHistDept(e.target.value as 'Total' | GrupoDept)}
            className="text-xs bg-slate-100 font-semibold text-slate-700 rounded-lg px-3 py-1.5 border border-slate-200 outline-none cursor-pointer"
          >
            <option value="Total">Total</option>
            {GRUPO_ORDER
              .filter(g => g !== 'Afastados' && g !== 'Outros')
              .map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {histLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs">Carregando histórico...</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={histChartData} margin={{ top: 16, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} width={86} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
                      <p className="font-semibold text-slate-700 mb-2">{label}</p>
                      <p className="text-slate-800 font-mono font-semibold">{fmtBRL(d.value)}</p>
                      {d.deltaR !== null && d.deltaPct !== null ? (
                        <div className={`flex items-center gap-1 mt-1.5 font-semibold ${d.deltaR >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {d.deltaR >= 0
                            ? <TrendingUp className="w-3.5 h-3.5" />
                            : <TrendingDown className="w-3.5 h-3.5" />}
                          <span>{d.deltaR >= 0 ? '+' : ''}{fmtBRL(d.deltaR)}</span>
                          <span className="text-slate-400 font-normal mx-0.5">·</span>
                          <span>{fmtPct(d.deltaPct!)}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">Primeiro ponto do histórico</p>
                      )}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={histDept === 'Total' ? 'Total da Folha' : histDept}
                stroke={histDept === 'Total' ? '#14b8a6' : GRUPO_COLORS[histDept as GrupoDept]}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Audi vs VW (apenas aba Total) ─────────────────────────────────── */}
      {brand === 'total' && (audiRowsProp !== undefined || vwRowsProp !== undefined) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Audi vs VW — Comparativo do Mês</h3>
              <p className="text-xs text-slate-400 mt-0.5">Custo de folha comparado entre marcas para o período selecionado.</p>
            </div>
            {/* Toggle pill */}
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                onClick={() => setCompViewMode('total')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  compViewMode === 'total'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Custo Total
              </button>
              <button
                onClick={() => setCompViewMode('medio')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  compViewMode === 'medio'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Custo Médio
              </button>
            </div>
          </div>

          {/* Sem dados de uma ou ambas as marcas */}
          {(audiHeadcount === 0 || vwHeadcount === 0) && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
              {audiHeadcount === 0 && vwHeadcount === 0
                ? 'Nenhuma das marcas possui dados importados para este período.'
                : audiHeadcount === 0
                  ? 'Audi não possui dados importados para este período. Importe o TXT na aba Relação de Salários Fixos.'
                  : 'VW não possui dados importados para este período. Importe o TXT na aba Relação de Salários Fixos.'}
            </div>
          )}

          {/* Cabeçalho 3 colunas: Audi | Δ | VW */}
          {(audiHeadcount > 0 || vwHeadcount > 0) && (
            <div className="mb-5">
              <div className="grid grid-cols-3 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-blue-700 uppercase tracking-wider">Audi</div>
                <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Δ Diferença</div>
                <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-teal-700 uppercase tracking-wider text-right">VW</div>

                {/* Total da Folha */}
                <div className="bg-white px-4 py-3">
                  <p className="text-xs text-slate-400 mb-0.5">Total da Folha</p>
                  <p className="text-base font-bold text-slate-800 font-mono">{fmtBRL(audiTotalFolha)}</p>
                  <p className="text-xs text-blue-600 font-semibold mt-0.5">{audiPct.toFixed(1)}% do total</p>
                </div>
                <div className="bg-white px-4 py-3 flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-400 mb-0.5">Diferença</p>
                  <p className={`text-sm font-bold font-mono ${audiTotalFolha > vwTotalFolha ? 'text-blue-600' : vwTotalFolha > audiTotalFolha ? 'text-teal-600' : 'text-slate-400'}`}>
                    {grandTotalFolha > 0 ? fmtBRL(Math.abs(audiTotalFolha - vwTotalFolha)) : '—'}
                  </p>
                  {grandTotalFolha > 0 && audiTotalFolha !== vwTotalFolha && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {audiTotalFolha > vwTotalFolha ? 'Audi maior' : 'VW maior'}
                    </p>
                  )}
                </div>
                <div className="bg-white px-4 py-3 text-right">
                  <p className="text-xs text-slate-400 mb-0.5">Total da Folha</p>
                  <p className="text-base font-bold text-slate-800 font-mono">{fmtBRL(vwTotalFolha)}</p>
                  <p className="text-xs text-teal-600 font-semibold mt-0.5">{vwPct.toFixed(1)}% do total</p>
                </div>

                {/* Headcount */}
                <div className="bg-white px-4 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-0.5">Headcount</p>
                  <p className="text-base font-bold text-slate-800">{audiHeadcount}</p>
                  {audiActive.filter(e => sal(e) === 0).length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">{audiActive.filter(e => sal(e) === 0).length} comissionados</p>
                  )}
                </div>
                <div className="bg-white px-4 py-3 border-t border-slate-100 flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-400 mb-0.5">Diferença</p>
                  <p className={`text-sm font-bold ${audiHeadcount !== vwHeadcount ? 'text-slate-700' : 'text-slate-400'}`}>
                    {audiHeadcount !== vwHeadcount
                      ? `${Math.abs(audiHeadcount - vwHeadcount)} func.`
                      : 'igual'}
                  </p>
                  {audiHeadcount !== vwHeadcount && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {audiHeadcount > vwHeadcount ? 'Audi maior' : 'VW maior'}
                    </p>
                  )}
                </div>
                <div className="bg-white px-4 py-3 border-t border-slate-100 text-right">
                  <p className="text-xs text-slate-400 mb-0.5">Headcount</p>
                  <p className="text-base font-bold text-slate-800">{vwHeadcount}</p>
                  {vwActive.filter(e => sal(e) === 0).length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">{vwActive.filter(e => sal(e) === 0).length} comissionados</p>
                  )}
                </div>

                {/* Custo Médio */}
                <div className="bg-white px-4 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-0.5">Custo Médio</p>
                  <p className="text-base font-bold text-slate-800 font-mono">{audiCustoMedio > 0 ? fmtBRL(audiCustoMedio) : '—'}</p>
                </div>
                <div className="bg-white px-4 py-3 border-t border-slate-100 flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-400 mb-0.5">Diferença</p>
                  <p className={`text-sm font-bold font-mono ${audiCustoMedio !== vwCustoMedio ? 'text-slate-700' : 'text-slate-400'}`}>
                    {audiCustoMedio > 0 && vwCustoMedio > 0
                      ? fmtBRL(Math.abs(audiCustoMedio - vwCustoMedio))
                      : '—'}
                  </p>
                  {audiCustoMedio > 0 && vwCustoMedio > 0 && audiCustoMedio !== vwCustoMedio && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {audiCustoMedio > vwCustoMedio ? 'Audi maior' : 'VW maior'}
                    </p>
                  )}
                </div>
                <div className="bg-white px-4 py-3 border-t border-slate-100 text-right">
                  <p className="text-xs text-slate-400 mb-0.5">Custo Médio</p>
                  <p className="text-base font-bold text-slate-800 font-mono">{vwCustoMedio > 0 ? fmtBRL(vwCustoMedio) : '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Gráfico de barras agrupadas por departamento */}
          {compDeptData.length > 0 && (
            <>
              {maxGapDept && (
                <p className="text-xs text-slate-400 mb-3">
                  Maior diferença entre marcas:{' '}
                  <span className="font-semibold text-slate-600" style={{ color: GRUPO_COLORS[maxGapDept as GrupoDept] }}>
                    {maxGapDept}
                  </span>
                </p>
              )}
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={compDeptData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grupo" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9 }} width={82} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const aVal = compViewMode === 'total'
                        ? (payload.find(p => p.dataKey === 'audi')?.value as number ?? 0)
                        : (payload.find(p => p.dataKey === 'audiMed')?.value as number ?? 0);
                      const vVal = compViewMode === 'total'
                        ? (payload.find(p => p.dataKey === 'vw')?.value as number ?? 0)
                        : (payload.find(p => p.dataKey === 'vwMed')?.value as number ?? 0);
                      const diff = Math.abs(aVal - vVal);
                      const bigger = aVal > vVal ? 'Audi' : vVal > aVal ? 'VW' : null;
                      return (
                        <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[180px]">
                          <p className="font-bold text-slate-700 mb-2">{label}</p>
                          <p style={{ color: '#3b82f6' }}>Audi: {fmtBRL(aVal)}</p>
                          <p style={{ color: '#14b8a6' }}>VW: {fmtBRL(vVal)}</p>
                          {bigger && (
                            <p className="mt-1.5 text-slate-500">
                              Δ {fmtBRL(diff)} — <span className="font-semibold">{bigger} maior</span>
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar dataKey={compViewMode === 'total' ? 'audi' : 'audiMed'} name="Audi" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.9} />
                  <Bar dataKey={compViewMode === 'total' ? 'vw' : 'vwMed'} name="VW" fill="#14b8a6" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </div>
  );
}
