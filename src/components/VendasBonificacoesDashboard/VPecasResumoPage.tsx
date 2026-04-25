/**
 * VPecasResumoPage — Resumo executivo por Condição de Pagamento
 * Sub-abas: Audi | VW | Todas
 * Período:  Mensal (mês específico) | Ano Todo (jan-dez)
 */

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getVPecasRelatorio,
  type VPecasRelMarca,
  type VPecasRelSection,
  type VPecasRelatorioData,
} from './vpecasRelatoriosStorage';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const SECTIONS: VPecasRelSection[] = ['pecas','acessorios','oficina','funilaria'];
const SECTION_LABELS: Record<VPecasRelSection, string> = {
  pecas: 'Peças', acessorios: 'Acessórios', oficina: 'Oficina', funilaria: 'Funilaria',
};
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

// ─── Paleta executiva ─────────────────────────────────────────────────────────
const GROUP_COLORS: Record<string, string> = {
  'Cartão':        '#6366f1',  // indigo
  'Prazo':         '#0ea5e9',  // sky
  'Mercado Livre': '#f59e0b',  // amber
  'E-Peças':       '#10b981',  // emerald
  'Seguradora':    '#f97316',  // orange
  'Outros':        '#94a3b8',  // slate
};
const GROUP_ORDER = ['Cartão','Prazo','Mercado Livre','E-Peças','Seguradora','Outros'];

const DEPT_COLORS: Record<VPecasRelSection, string> = {
  pecas:      '#3b82f6',
  acessorios: '#8b5cf6',
  oficina:    '#10b981',
  funilaria:  '#f59e0b',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseBRL(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}
function fmtBRL(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  if (n >= 1_000)     return `R$ ${(n / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtBRLFull(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtPct(n: number): string {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Classifica uma condição de pagamento no seu grupo executivo */
function classifyGroup(cond: string): string {
  const u = cond.toUpperCase();
  if (/CART[AÃ][OÃ]|CARTOES|CARTÕES/.test(u)) return 'Cartão';
  if (/\d+\s*DIAS?|30\s*\/|PARCEL|DIA/.test(u))  return 'Prazo';
  if (/MERCADO\s*LIVRE|MERC\.?\s*LIVRE/.test(u))  return 'Mercado Livre';
  if (/E[\s-]?PE[ÇC]AS?|EPEÇAS?/.test(u))         return 'E-Peças';
  if (/SEGURA|SEGURAD/.test(u))                    return 'Seguradora';
  return 'Outros';
}

// ─── Types ────────────────────────────────────────────────────────────────────
type CondMap = Record<string, number>; // condição → valor total
type SectionData = Record<VPecasRelSection, CondMap>;

interface MonthlyBundle {
  month: number;   // 1-12
  label: string;   // 'Jan', 'Fev', ...
  sections: SectionData;
}

type ResumoTab = 'audi' | 'vw' | 'todas';
type PeriodoMode = 'mensal' | 'ano';

// ─── Fetch helpers ────────────────────────────────────────────────────────────
async function fetchSectionData(
  marca: VPecasRelMarca,
  section: VPecasRelSection,
  year: number,
  month: number,
): Promise<CondMap> {
  const data: VPecasRelatorioData | null = await getVPecasRelatorio(marca, section, year, month);
  if (!data || !data.rows.length) return {};
  // detect value column index
  const valIdx = data.headers.findIndex(h =>
    /val|opera|valor/i.test(h)
  );
  if (valIdx === -1 && data.headers.length >= 2) {
    // fallback: last column
  }
  const vi = valIdx >= 0 ? valIdx : data.headers.length - 1;

  const map: CondMap = {};
  for (const row of data.rows) {
    const cond = (row[0] ?? '').trim();
    const val  = parseBRL(row[vi] ?? '0');
    if (!cond) continue;
    map[cond] = (map[cond] ?? 0) + val;
  }
  return map;
}

async function fetchMonthBundle(
  marcas: VPecasRelMarca[],
  year: number,
  month: number,
): Promise<MonthlyBundle> {
  const sections: SectionData = { pecas: {}, acessorios: {}, oficina: {}, funilaria: {} };
  await Promise.all(
    SECTIONS.flatMap(sec =>
      marcas.map(async marca => {
        const m = await fetchSectionData(marca, sec, year, month);
        for (const [cond, val] of Object.entries(m)) {
          sections[sec][cond] = (sections[sec][cond] ?? 0) + val;
        }
      })
    )
  );
  return { month, label: MONTHS[month - 1], sections };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number;
  prev?: number;
  color?: string;
}
function KpiCard({ label, value, prev, color = '#3b82f6' }: KpiCardProps) {
  const delta = prev !== undefined && prev > 0 ? ((value - prev) / prev) * 100 : null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{label}</span>
      <span className="text-lg font-bold text-slate-800 truncate" style={{ color }}>
        {fmtBRL(value)}
      </span>
      {delta !== null && (
        <div className={`flex items-center gap-1 text-[11px] font-semibold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {Math.abs(delta).toFixed(1)}% vs anterior
        </div>
      )}
    </div>
  );
}

// ─── Tooltip personalizado ────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 min-w-[180px]">
      <p className="text-xs font-bold text-slate-600 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-600 truncate max-w-[120px]">{p.name}</span>
          </div>
          <span className="font-bold text-slate-800 tabular-nums">{fmtBRLFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Pie Tooltip ──────────────────────────────────────────────────────────────
function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { pct: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-slate-700">{p.name}</p>
      <p className="text-slate-600">{fmtBRLFull(p.value)}</p>
      <p className="text-slate-400">{fmtPct(p.payload.pct)}</p>
    </div>
  );
}

// ─── Group pie chart ─────────────────────────────────────────────────────────
function GroupPieChart({ data }: { data: { name: string; value: number; pct: number }[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-[200px] text-slate-300 text-sm">Sem dados</div>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
          outerRadius={80} innerRadius={44} paddingAngle={2} labelLine={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={GROUP_COLORS[d.name] ?? '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface VPecasResumoPageProps {
  selYear: number;
  selMonth: number;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
}

export function VPecasResumoPage({ selYear, selMonth, onYearChange, onMonthChange }: VPecasResumoPageProps) {
  const [tab,         setTab]         = useState<ResumoTab>('todas');
  const [periodo,     setPeriodo]     = useState<PeriodoMode>('mensal');
  const [loading,     setLoading]     = useState(false);
  const [bundles,     setBundles]     = useState<MonthlyBundle[]>([]);
  const [tableExpand, setTableExpand] = useState<Record<string, boolean>>({});

  const marcas: VPecasRelMarca[] = tab === 'audi' ? ['audi'] : tab === 'vw' ? ['vw'] : ['audi', 'vw'];

  // ── Fetch data ────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setBundles([]);
    const months = periodo === 'mensal' ? [selMonth] : Array.from({ length: 12 }, (_, i) => i + 1);
    Promise.all(months.map(m => fetchMonthBundle(marcas, selYear, m)))
      .then(res => { setBundles(res); setLoading(false); })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, periodo, selYear, selMonth]);

  // ── Aggregated helpers ────────────────────────────────────────────────────
  const allCondsBySection = useMemo((): Record<VPecasRelSection, CondMap> => {
    const agg: Record<VPecasRelSection, CondMap> = { pecas: {}, acessorios: {}, oficina: {}, funilaria: {} };
    for (const b of bundles) {
      for (const sec of SECTIONS) {
        for (const [cond, val] of Object.entries(b.sections[sec])) {
          agg[sec][cond] = (agg[sec][cond] ?? 0) + val;
        }
      }
    }
    return agg;
  }, [bundles]);

  /** Total consolidado de todos os departamentos */
  const totalBySection = useMemo((): Record<VPecasRelSection, number> => {
    const r = {} as Record<VPecasRelSection, number>;
    for (const sec of SECTIONS) {
      r[sec] = Object.values(allCondsBySection[sec]).reduce((a, b) => a + b, 0);
    }
    return r;
  }, [allCondsBySection]);

  const grandTotal = useMemo(() => Object.values(totalBySection).reduce((a, b) => a + b, 0), [totalBySection]);

  /** Condições totais (soma de todos departamentos) */
  const totalCondMap = useMemo((): CondMap => {
    const m: CondMap = {};
    for (const sec of SECTIONS) {
      for (const [cond, val] of Object.entries(allCondsBySection[sec])) {
        m[cond] = (m[cond] ?? 0) + val;
      }
    }
    return m;
  }, [allCondsBySection]);

  /** Grupos com totais */
  const groupTotals = useMemo((): { name: string; value: number; pct: number }[] => {
    const g: Record<string, number> = {};
    for (const [cond, val] of Object.entries(totalCondMap)) {
      const grp = classifyGroup(cond);
      g[grp] = (g[grp] ?? 0) + val;
    }
    const total = Object.values(g).reduce((a, b) => a + b, 0) || 1;
    return GROUP_ORDER
      .filter(k => (g[k] ?? 0) > 0)
      .map(k => ({ name: k, value: g[k], pct: (g[k] / total) * 100 }));
  }, [totalCondMap]);

  /** Para gráfico de barras por departamento e grupo */
  const deptGroupData = useMemo(() => {
    return SECTIONS.map(sec => {
      const total = totalBySection[sec] || 1;
      const conds = allCondsBySection[sec];
      const grp: Record<string, number> = {};
      for (const [cond, val] of Object.entries(conds)) {
        const g = classifyGroup(cond);
        grp[g] = (grp[g] ?? 0) + val;
      }
      const row: Record<string, unknown> = { dept: SECTION_LABELS[sec], total: totalBySection[sec] };
      for (const g of GROUP_ORDER) row[g] = grp[g] ?? 0;
      row._total = total;
      return row;
    });
  }, [allCondsBySection, totalBySection]);

  /** Evolução mensal por grupo (para modo Ano Todo) */
  const monthlyGroupEvolution = useMemo(() => {
    return bundles.map(b => {
      const row: Record<string, unknown> = { label: b.label };
      const g: Record<string, number> = {};
      for (const sec of SECTIONS) {
        for (const [cond, val] of Object.entries(b.sections[sec])) {
          const grp = classifyGroup(cond);
          g[grp] = (g[grp] ?? 0) + val;
        }
      }
      for (const grp of GROUP_ORDER) row[grp] = g[grp] ?? 0;
      return row;
    });
  }, [bundles]);

  /** Condições agrupadas para tabela comparativa */
  const tableData = useMemo(() => {
    // build union of all conditions across all months
    const allConds = new Set<string>();
    for (const b of bundles) {
      for (const sec of SECTIONS) {
        for (const cond of Object.keys(b.sections[sec])) allConds.add(cond);
      }
    }
    // for each cond, sum across sections per month
    const rows: {
      cond: string;
      group: string;
      months: number[];
      total: number;
    }[] = [];
    for (const cond of allConds) {
      const monthVals = bundles.map(b => {
        return SECTIONS.reduce((s, sec) => s + (b.sections[sec][cond] ?? 0), 0);
      });
      const total = monthVals.reduce((a, b) => a + b, 0);
      if (total === 0) continue;
      rows.push({ cond, group: classifyGroup(cond), months: monthVals, total });
    }
    // group → sorted by total desc
    const byGroup: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (!byGroup[row.group]) byGroup[row.group] = [];
      byGroup[row.group].push(row);
    }
    for (const g of Object.keys(byGroup)) {
      byGroup[g].sort((a, b) => b.total - a.total);
    }
    return byGroup;
  }, [bundles]);

  // ─── Render helpers ─────────────────────────────────────────────────────
  const hasData = grandTotal > 0;

  const periodLabel = periodo === 'mensal'
    ? `${MONTHS[selMonth - 1]}/${selYear}`
    : `Ano ${selYear}`;

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-auto bg-slate-50">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-4 flex-wrap shrink-0">
        {/* Sub-abas marca */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
          {(['todas', 'audi', 'vw'] as ResumoTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 transition-colors ${
                tab === t ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t === 'todas' ? 'Todas' : t === 'audi' ? 'Audi' : 'VW'}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Período */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
          <button
            onClick={() => setPeriodo('mensal')}
            className={`px-4 py-1.5 transition-colors ${periodo === 'mensal' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Mensal
          </button>
          <button
            onClick={() => setPeriodo('ano')}
            className={`px-4 py-1.5 transition-colors ${periodo === 'ano' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Ano Todo
          </button>
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Ano */}
        <select
          value={selYear}
          onChange={e => onYearChange(Number(e.target.value))}
          className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Mês — só aparece no modo mensal */}
        {periodo === 'mensal' && (
          <div className="flex items-center gap-1">
            {MONTHS.map((m, i) => (
              <button
                key={i}
                onClick={() => onMonthChange(i + 1)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  selMonth === i + 1 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto text-xs text-slate-400 font-medium">{periodLabel}</div>
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Carregando dados...</span>
          </div>
        </div>
      ) : !hasData ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-4 max-w-md text-center">
            <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6M3 21h18M3 10l9-7 9 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-600">Sem dados para o período</h2>
              <p className="text-sm text-slate-400 mt-1">
                Importe os PDFs na aba <strong>Relatórios</strong> para visualizar o resumo.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 flex flex-col gap-6">

          {/* ── KPIs por departamento ───────────────────────────────────── */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Total por Departamento — {periodLabel}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {SECTIONS.map(sec => (
                <KpiCard
                  key={sec}
                  label={SECTION_LABELS[sec]}
                  value={totalBySection[sec]}
                  color={DEPT_COLORS[sec]}
                />
              ))}
              <KpiCard label="Total Geral" value={grandTotal} color="#1e293b" />
            </div>
          </section>

          {/* ── Linha 1: Participação por Grupo + Departamento ───────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Pie — participação por grupo */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h4 className="text-sm font-bold text-slate-700 mb-1">Participação por Grupo</h4>
              <p className="text-xs text-slate-400 mb-3">
                Distribuição das condições de pagamento — {periodLabel}
              </p>
              <div className="flex gap-4 items-center">
                <div className="flex-1 min-w-0">
                  <GroupPieChart data={groupTotals} />
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {groupTotals.map(g => (
                    <div key={g.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: GROUP_COLORS[g.name] ?? '#94a3b8' }} />
                      <span className="text-slate-600 w-[90px] truncate">{g.name}</span>
                      <span className="font-bold text-slate-800 tabular-nums ml-auto">{fmtPct(g.pct)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 mt-1 pt-1 flex items-center gap-2 text-xs">
                    <span className="text-slate-400 w-[90px]">Total</span>
                    <span className="font-bold text-slate-700 tabular-nums ml-auto">{fmtBRL(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Barra — valor por departamento e grupo */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h4 className="text-sm font-bold text-slate-700 mb-1">Por Departamento e Grupo</h4>
              <p className="text-xs text-slate-400 mb-3">Composição de cada departamento por grupo de pagamento</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={deptGroupData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="dept" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v => fmtBRL(v)} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconType="square" />
                  {GROUP_ORDER.filter(g => groupTotals.some(gt => gt.name === g)).map(g => (
                    <Bar key={g} dataKey={g} stackId="a" fill={GROUP_COLORS[g]} name={g} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Linha 2 (só no modo Ano Todo): Evolução mensal ────────────── */}
          {periodo === 'ano' && bundles.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h4 className="text-sm font-bold text-slate-700 mb-1">Evolução Mensal por Grupo — {selYear}</h4>
              <p className="text-xs text-slate-400 mb-4">Comparativo mês a mês dos grupos de condição de pagamento</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyGroupEvolution} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v => fmtBRL(v)} width={72} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
                  {GROUP_ORDER.filter(g => groupTotals.some(gt => gt.name === g)).map(g => (
                    <Line
                      key={g}
                      type="monotone"
                      dataKey={g}
                      stroke={GROUP_COLORS[g]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name={g}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Linha 3 (só no modo Ano Todo): Barras agrupadas por departamento/mês ── */}
          {periodo === 'ano' && bundles.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {SECTIONS.filter(sec => totalBySection[sec] > 0).map(sec => {
                const chartData = bundles.map(b => {
                  const g: Record<string, number> = {};
                  for (const [cond, val] of Object.entries(b.sections[sec])) {
                    const grp = classifyGroup(cond);
                    g[grp] = (g[grp] ?? 0) + val;
                  }
                  return { label: b.label, ...g };
                });
                const activeGroups = GROUP_ORDER.filter(grp =>
                  chartData.some(d => ((d as Record<string, unknown>)[grp] as number ?? 0) > 0)
                );
                return (
                  <div key={sec} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <h4 className="text-sm font-bold text-slate-700 mb-1">{SECTION_LABELS[sec]}</h4>
                    <p className="text-xs text-slate-400 mb-3">Grupos de pagamento mês a mês</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                          tickFormatter={v => fmtBRL(v)} width={70} />
                        <Tooltip content={<CustomTooltip />} />
                        {activeGroups.map(g => (
                          <Bar key={g} dataKey={g} stackId="a" fill={GROUP_COLORS[g]} name={g} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Linha Mensal: barras horizontais top condições ─────────────── */}
          {periodo === 'mensal' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top condições geral */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h4 className="text-sm font-bold text-slate-700 mb-1">Top Condições — Total Geral</h4>
                <p className="text-xs text-slate-400 mb-3">Maiores volumes no período</p>
                <TopCondsBar data={totalCondMap} />
              </div>
              {/* Por departamento */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h4 className="text-sm font-bold text-slate-700 mb-1">Participação por Grupo — Detalhado</h4>
                <p className="text-xs text-slate-400 mb-3">Valor e % de cada grupo</p>
                <GroupDetailTable groups={groupTotals} total={grandTotal} />
              </div>
            </div>
          )}

          {/* ── Tabela comparativa de condições ────────────────────────────── */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Condições de Pagamento — Tabela Detalhada
              {periodo === 'ano' ? ' (Comparativo Mês a Mês)' : ` — ${periodLabel}`}
            </h3>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
              <CondTable
                tableData={tableData}
                bundles={bundles}
                periodo={periodo}
                grandTotal={grandTotal}
                expand={tableExpand}
                onToggle={grp => setTableExpand(e => ({ ...e, [grp]: !e[grp] }))}
              />
            </div>
          </section>

        </div>
      )}
    </div>
  );
}

// ─── TopCondsBar ──────────────────────────────────────────────────────────────
function TopCondsBar({ data }: { data: CondMap }) {
  const sorted = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const max = sorted[0]?.[1] || 1;
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map(([cond, val], i) => {
        const pct = (val / max) * 100;
        const grp = classifyGroup(cond);
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-[140px] truncate text-slate-600 shrink-0" title={cond}>{cond}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-0">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${pct}%`, background: GROUP_COLORS[grp] ?? '#94a3b8' }}
              />
            </div>
            <span className="tabular-nums font-semibold text-slate-700 w-[80px] text-right shrink-0">{fmtBRL(val)}</span>
            <span className="text-slate-400 w-[38px] text-right shrink-0">{fmtPct((val / total) * 100)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── GroupDetailTable ─────────────────────────────────────────────────────────
function GroupDetailTable({ groups, total }: { groups: { name: string; value: number; pct: number }[]; total: number }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="py-1.5 text-left font-semibold text-slate-500">Grupo</th>
          <th className="py-1.5 text-right font-semibold text-slate-500">Valor</th>
          <th className="py-1.5 text-right font-semibold text-slate-500">% Total</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g, i) => (
          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
            <td className="py-1.5 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: GROUP_COLORS[g.name] ?? '#94a3b8' }} />
              <span className="text-slate-700">{g.name}</span>
            </td>
            <td className="py-1.5 text-right tabular-nums font-semibold text-slate-700">{fmtBRLFull(g.value)}</td>
            <td className="py-1.5 text-right tabular-nums text-slate-500">{fmtPct(g.pct)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-slate-200">
          <td className="py-2 font-bold text-slate-700">Total</td>
          <td className="py-2 text-right tabular-nums font-bold text-slate-700">{fmtBRLFull(total)}</td>
          <td className="py-2 text-right tabular-nums font-bold text-slate-500">100%</td>
        </tr>
      </tbody>
    </table>
  );
}

// ─── CondTable ────────────────────────────────────────────────────────────────
interface CondTableProps {
  tableData: Record<string, { cond: string; group: string; months: number[]; total: number }[]>;
  bundles: MonthlyBundle[];
  periodo: PeriodoMode;
  grandTotal: number;
  expand: Record<string, boolean>;
  onToggle: (grp: string) => void;
}

function CondTable({ tableData, bundles, periodo, grandTotal, expand, onToggle }: CondTableProps) {
  const isMultiMonth = periodo === 'ano';
  // group totals per month
  const grandMonthTotals = useMemo(() => {
    const t = new Array(bundles.length).fill(0);
    for (const rows of Object.values(tableData)) {
      for (const row of rows) {
        row.months.forEach((v, i) => { t[i] += v; });
      }
    }
    return t;
  }, [tableData, bundles]);

  return (
    <table className="text-xs w-full border-collapse">
      <thead className="sticky top-0 bg-slate-50 z-10">
        <tr>
          <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200 min-w-[200px]">
            Condição de Pagamento
          </th>
          <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
            Grupo
          </th>
          {isMultiMonth ? (
            bundles.map((b, i) => (
              <th key={i} className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                {b.label}
              </th>
            ))
          ) : (
            <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
              Val. Operação
            </th>
          )}
          <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
            Total
          </th>
          {isMultiMonth && (
            <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
              % Total
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {GROUP_ORDER.filter(grp => tableData[grp]?.length).map(grp => {
          const rows = tableData[grp] ?? [];
          const isOpen = expand[grp] !== false; // default open
          const grpTotal = rows.reduce((s, r) => s + r.total, 0);
          const grpMonthTotals = rows[0]
            ? rows.reduce((acc, r) => r.months.map((v, i) => (acc[i] ?? 0) + v), [] as number[])
            : [];

          return [
            // group header row
            <tr
              key={`${grp}-hdr`}
              className="cursor-pointer select-none"
              onClick={() => onToggle(grp)}
            >
              <td colSpan={isMultiMonth ? 2 + bundles.length + 2 : 4}
                className="px-3 py-2 border-b border-slate-200"
                style={{ background: (GROUP_COLORS[grp] ?? '#94a3b8') + '18' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: GROUP_COLORS[grp] ?? '#94a3b8' }} />
                  <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">{grp}</span>
                  <span className="ml-2 text-slate-400 font-normal text-[11px]">{fmtBRLFull(grpTotal)}</span>
                  <span className="text-slate-400 font-normal text-[11px]">
                    · {fmtPct(grandTotal > 0 ? (grpTotal / grandTotal) * 100 : 0)}
                  </span>
                  <span className="ml-auto text-slate-400">
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </span>
                </div>
              </td>
            </tr>,

            // rows
            ...(isOpen ? rows.map((row, ri) => (
              <tr key={`${grp}-${ri}`} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="px-3 py-1.5 border-b border-slate-100 text-slate-700 max-w-[240px] truncate" title={row.cond}>
                  {row.cond}
                </td>
                <td className="px-3 py-1.5 border-b border-slate-100">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{ background: (GROUP_COLORS[grp] ?? '#94a3b8') + '22', color: GROUP_COLORS[grp] ?? '#94a3b8' }}>
                    {grp}
                  </span>
                </td>
                {isMultiMonth ? (
                  row.months.map((v, mi) => (
                    <td key={mi} className="px-3 py-1.5 border-b border-slate-100 text-right tabular-nums text-slate-600 whitespace-nowrap">
                      {v > 0 ? fmtBRLFull(v) : <span className="text-slate-200">—</span>}
                    </td>
                  ))
                ) : (
                  <td className="px-3 py-1.5 border-b border-slate-100 text-right tabular-nums font-semibold text-slate-700 whitespace-nowrap">
                    {fmtBRLFull(row.total)}
                  </td>
                )}
                <td className="px-3 py-1.5 border-b border-slate-100 text-right tabular-nums font-bold text-slate-700 whitespace-nowrap">
                  {fmtBRLFull(row.total)}
                </td>
                {isMultiMonth && (
                  <td className="px-3 py-1.5 border-b border-slate-100 text-right tabular-nums text-slate-500 whitespace-nowrap">
                    {fmtPct(grandTotal > 0 ? (row.total / grandTotal) * 100 : 0)}
                  </td>
                )}
              </tr>
            )) : []),

            // group subtotal
            isOpen ? (
              <tr key={`${grp}-sub`} style={{ background: (GROUP_COLORS[grp] ?? '#94a3b8') + '10' }}>
                <td className="px-3 py-1.5 border-b border-slate-200 font-bold text-slate-700">
                  Subtotal {grp}
                </td>
                <td className="px-3 py-1.5 border-b border-slate-200" />
                {isMultiMonth ? (
                  grpMonthTotals.map((v, mi) => (
                    <td key={mi} className="px-3 py-1.5 border-b border-slate-200 text-right tabular-nums font-bold text-slate-700 whitespace-nowrap">
                      {v > 0 ? fmtBRLFull(v) : <span className="text-slate-200">—</span>}
                    </td>
                  ))
                ) : (
                  <td className="px-3 py-1.5 border-b border-slate-200 text-right tabular-nums font-bold text-slate-700">
                    {fmtBRLFull(grpTotal)}
                  </td>
                )}
                <td className="px-3 py-1.5 border-b border-slate-200 text-right tabular-nums font-bold text-slate-700">
                  {fmtBRLFull(grpTotal)}
                </td>
                {isMultiMonth && (
                  <td className="px-3 py-1.5 border-b border-slate-200 text-right tabular-nums font-bold text-slate-500">
                    {fmtPct(grandTotal > 0 ? (grpTotal / grandTotal) * 100 : 0)}
                  </td>
                )}
              </tr>
            ) : null,
          ];
        })}
      </tbody>

      {/* Grand total footer */}
      <tfoot className="sticky bottom-0 bg-slate-100 z-10">
        <tr className="border-t-2 border-slate-300">
          <td className="px-3 py-2 font-bold text-slate-700">Total Geral</td>
          <td className="px-3 py-2" />
          {isMultiMonth ? (
            grandMonthTotals.map((v, i) => (
              <td key={i} className="px-3 py-2 text-right tabular-nums font-bold text-slate-700 whitespace-nowrap">
                {v > 0 ? fmtBRLFull(v) : <span className="text-slate-300">—</span>}
              </td>
            ))
          ) : (
            <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-700">
              {fmtBRLFull(grandTotal)}
            </td>
          )}
          <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-700">
            {fmtBRLFull(grandTotal)}
          </td>
          {isMultiMonth && (
            <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-500">100%</td>
          )}
        </tr>
      </tfoot>
    </table>
  );
}
