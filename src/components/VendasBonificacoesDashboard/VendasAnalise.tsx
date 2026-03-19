import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
} from 'recharts';
import { type VendasRow } from './vendasStorage';
import { TrendingUp, TrendingDown, Minus, Plus, X } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
function fmtBRLFull(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}
function n(s: string): number { return parseFloat(s) || 0; }

function getRowYear(row: VendasRow): number {
  if (!row.dataVenda) return 0;
  return parseInt(row.dataVenda.split('-')[0]) || 0;
}
function getRowMonth(row: VendasRow): number {
  if (!row.dataVenda) return 0;
  return parseInt(row.dataVenda.split('-')[1]) || 0;
}

// Retorna os meses que fazem parte de um tipo de período
function periodMonths(tipo: PeriodType, value: number): number[] {
  if (tipo === 'mes') return [value];
  if (tipo === 'bimestre') { const s = (value - 1) * 2 + 1; return [s, s + 1]; }
  if (tipo === 'trimestre') { const s = (value - 1) * 3 + 1; return [s, s + 1, s + 2]; }
  if (tipo === 'semestre') { const s = (value - 1) * 6 + 1; return [s, s + 1, s + 2, s + 3, s + 4, s + 5]; }
  return [];
}

function periodLabel(tipo: PeriodType, value: number, year: number): string {
  if (tipo === 'mes') return `${MONTHS[value - 1]}/${String(year).slice(2)}`;
  if (tipo === 'bimestre') {
    const s = (value - 1) * 2 + 1;
    return `${MONTHS[s - 1]}-${MONTHS[s]}/${String(year).slice(2)}`;
  }
  if (tipo === 'trimestre') {
    const s = (value - 1) * 3 + 1;
    return `${MONTHS[s - 1]}-${MONTHS[s + 1]}/${String(year).slice(2)}`;
  }
  if (tipo === 'semestre') {
    return value === 1 ? `1º Sem/${String(year).slice(2)}` : `2º Sem/${String(year).slice(2)}`;
  }
  return '';
}

type PeriodType = 'mes' | 'bimestre' | 'trimestre' | 'semestre';
type BrandFilter = 'Todas' | 'VW' | 'Audi';

interface PeriodSlot { year: number; tipo: PeriodType; value: number; }

function filterRows(rows: VendasRow[], year: number, monthChip: number | null, blindadora: string): VendasRow[] {
  return rows.filter(r => {
    if (!r.dataVenda) return false;
    if (getRowYear(r) !== year) return false;
    if (monthChip !== null && getRowMonth(r) !== monthChip) return false;
    if (blindadora !== 'Todas' && r.blindadora !== blindadora) return false;
    return true;
  });
}

function filterByPeriod(rows: VendasRow[], slot: PeriodSlot, blindadora: string): VendasRow[] {
  const months = periodMonths(slot.tipo, slot.value);
  return rows.filter(r => {
    if (!r.dataVenda) return false;
    if (getRowYear(r) !== slot.year) return false;
    if (!months.includes(getRowMonth(r))) return false;
    if (blindadora !== 'Todas' && r.blindadora !== blindadora) return false;
    return true;
  });
}

// ─── Aggregation ──────────────────────────────────────────────────────────────
interface Metrics {
  qtd: number;
  receita: number;
  custo: number;
  lucro: number;
  margem: number;
  sorana: number;
  ticketMedio: number;
  remVendedor: number;
  remGerencia: number;
  remDiretoria: number;
  remSupervisor: number;
  remTotal: number;
}

function calcMetrics(rows: VendasRow[]): Metrics {
  const qtd = rows.length;
  const receita   = rows.reduce((a, r) => a + n(r.valorVendaBlindagem), 0);
  const custo     = rows.reduce((a, r) => a + n(r.custoBlindagem), 0);
  const lucro     = rows.reduce((a, r) => a + n(r.lucroOperacao), 0);
  const margem    = receita > 0 ? (lucro / receita) * 100 : 0;
  const sorana    = rows.reduce((a, r) => a + n(r.comissaoBrutaSorana), 0);
  const ticketMedio = qtd > 0 ? receita / qtd : 0;
  const remVendedor  = rows.reduce((a, r) => a + n(r.remuneracaoVendedor), 0);
  const remGerencia  = rows.reduce((a, r) => a + n(r.remuneracaoGerencia), 0);
  const remDiretoria = rows.reduce((a, r) => a + n(r.remuneracaoDiretoria), 0);
  const remSupervisor = rows.reduce((a, r) => a + n(r.remuneracaoGerenciaSupervisorUsados), 0);
  const remTotal = remVendedor + remGerencia + remDiretoria + remSupervisor;
  return { qtd, receita, custo, lucro, margem, sorana, ticketMedio, remVendedor, remGerencia, remDiretoria, remSupervisor, remTotal };
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];
const PERIOD_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

// ─── Sub-components ───────────────────────────────────────────────────────────
interface KpiCardProps { label: string; value: string; sub?: string; color?: string; }
function KpiCard({ label, value, sub, color = 'text-slate-800' }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wide leading-tight">{label}</span>
      <span className={`text-xl font-bold leading-tight ${color} truncate`}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 mt-1">{children}</h2>
  );
}

function CustomTooltipBRL({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {fmtBRLFull(p.value)}
        </p>
      ))}
    </div>
  );
}

function DeltaBadge({ base, current }: { base: number; current: number }) {
  if (base === 0) return <span className="text-slate-300 text-xs">—</span>;
  const delta = ((current - base) / Math.abs(base)) * 100;
  if (Math.abs(delta) < 0.05) return <span className="text-slate-400 text-xs flex items-center gap-0.5"><Minus className="w-3 h-3" />0%</span>;
  if (delta > 0) return <span className="text-emerald-600 text-xs font-semibold flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{fmtPct(delta)}</span>;
  return <span className="text-red-500 text-xs font-semibold flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{fmtPct(delta)}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface VendasAnaliseProps { rows: VendasRow[]; }

export function VendasAnalise({ rows }: VendasAnaliseProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // ── Filtros globais ──
  const [selectedYear, setSelectedYear]         = useState(currentYear);
  const [monthChip, setMonthChip]               = useState<number | null>(null);
  const [selectedBlindadora, setSelectedBlindadora] = useState('Todas');
  const [selectedBrand, setSelectedBrand]       = useState<BrandFilter>('Todas');

  // ── Comparativo ──
  const [periods, setPeriods] = useState<PeriodSlot[]>([
    { year: currentYear, tipo: 'mes', value: currentMonth },
  ]);

  // Anos disponíveis nos dados
  const availableYears = useMemo(() => {
    const years = [...new Set(rows.map(getRowYear).filter(y => y > 2000))].sort();
    if (!years.includes(currentYear)) years.push(currentYear);
    return years.sort();
  }, [rows, currentYear]);

  // Linhas pré-filtradas por marca
  const brandRows = useMemo(() => {
    if (selectedBrand === 'Todas') return rows;
    const term = selectedBrand.toLowerCase();
    return rows.filter(r => r.revenda.toLowerCase().includes(term));
  }, [rows, selectedBrand]);

  // Blindadoras disponíveis (restritas à marca selecionada)
  const availableBlindadoras = useMemo(() => {
    return ['Todas', ...[...new Set(brandRows.map(r => r.blindadora).filter(Boolean))].sort()];
  }, [brandRows]);

  // Linhas filtradas para análise principal
  const filteredRows = useMemo(
    () => filterRows(brandRows, selectedYear, monthChip, selectedBlindadora),
    [brandRows, selectedYear, monthChip, selectedBlindadora]
  );

  const metrics = useMemo(() => calcMetrics(filteredRows), [filteredRows]);

  // ── Dados mensais (gráfico de evolução) ──
  const monthlyData = useMemo(() => {
    return MONTHS.map((label, mi) => {
      const m = mi + 1;
      const mRows = brandRows.filter(r =>
        getRowYear(r) === selectedYear &&
        getRowMonth(r) === m &&
        (selectedBlindadora === 'Todas' || r.blindadora === selectedBlindadora)
      );
      const receita = mRows.reduce((a, r) => a + n(r.valorVendaBlindagem), 0);
      const lucro   = mRows.reduce((a, r) => a + n(r.lucroOperacao), 0);
      const sorana  = mRows.reduce((a, r) => a + n(r.comissaoBrutaSorana), 0);
      return { label, receita, lucro, sorana, qtd: mRows.length };
    });
  }, [brandRows, selectedYear, selectedBlindadora]);

  // ── Por modelo ──
  const modeloData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRows.forEach(r => {
      const key = r.veiculo || 'Não informado';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].map(([name, qtd]) => ({ name, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  }, [filteredRows]);

  // ── Por revenda ──
  const revendaData = useMemo(() => {
    const map = new Map<string, { qtd: number; receita: number }>();
    filteredRows.forEach(r => {
      const key = r.revenda || 'Não informada';
      const cur = map.get(key) || { qtd: 0, receita: 0 };
      map.set(key, { qtd: cur.qtd + 1, receita: cur.receita + n(r.valorVendaBlindagem) });
    });
    return [...map.entries()]
      .map(([name, v]) => ({ name, qtd: v.qtd, receita: v.receita, ticketMedio: v.qtd > 0 ? v.receita / v.qtd : 0 }))
      .sort((a, b) => b.receita - a.receita);
  }, [filteredRows]);

  // ── Por vendedor ──
  const vendedorData = useMemo(() => {
    const map = new Map<string, { qtd: number; receita: number; lucro: number; remVendedor: number }>();
    filteredRows.forEach(r => {
      const key = r.nomeVendedor || 'Não informado';
      const cur = map.get(key) || { qtd: 0, receita: 0, lucro: 0, remVendedor: 0 };
      map.set(key, {
        qtd: cur.qtd + 1,
        receita: cur.receita + n(r.valorVendaBlindagem),
        lucro: cur.lucro + n(r.lucroOperacao),
        remVendedor: cur.remVendedor + n(r.remuneracaoVendedor),
      });
    });
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        qtd: v.qtd,
        receita: v.receita,
        lucro: v.lucro,
        margem: v.receita > 0 ? (v.lucro / v.receita) * 100 : 0,
        remVendedor: v.remVendedor,
      }))
      .sort((a, b) => b.receita - a.receita);
  }, [filteredRows]);

  // ── Por blindadora ──
  const blindadoraData = useMemo(() => {
    const map = new Map<string, { qtd: number; receita: number; custo: number; lucro: number }>();
    brandRows.filter(r => getRowYear(r) === selectedYear && (monthChip === null || getRowMonth(r) === monthChip)).forEach(r => {
      const key = r.blindadora || 'Não informada';
      const cur = map.get(key) || { qtd: 0, receita: 0, custo: 0, lucro: 0 };
      map.set(key, {
        qtd: cur.qtd + 1,
        receita: cur.receita + n(r.valorVendaBlindagem),
        custo: cur.custo + n(r.custoBlindagem),
        lucro: cur.lucro + n(r.lucroOperacao),
      });
    });
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        qtd: v.qtd,
        custoMedio: v.qtd > 0 ? v.custo / v.qtd : 0,
        lucro: v.lucro,
        receita: v.receita,
      }))
      .sort((a, b) => b.receita - a.receita);
  }, [brandRows, selectedYear, monthChip]);

  // ── Remunerações pizza ──
  const remPieData = useMemo(() => [
    { name: 'Vendedor',    value: metrics.remVendedor,  color: '#f59e0b' },
    { name: 'Gerência',    value: metrics.remGerencia,  color: '#3b82f6' },
    { name: 'Diretoria',   value: metrics.remDiretoria, color: '#8b5cf6' },
    { name: 'Sup. Usados', value: metrics.remSupervisor,color: '#10b981' },
    { name: 'Sorana',      value: metrics.sorana,       color: '#ef4444' },
  ].filter(d => d.value > 0), [metrics]);

  // ── Comparativo de períodos ──
  const periodMetrics = useMemo(
    () => periods.map(slot => ({ slot, metrics: calcMetrics(filterByPeriod(brandRows, slot, selectedBlindadora)) })),
    [periods, brandRows, selectedBlindadora]
  );

  const addPeriod = () => {
    if (periods.length >= 4) return;
    setPeriods(prev => [...prev, { year: currentYear, tipo: 'mes', value: currentMonth }]);
  };
  const removePeriod = (i: number) => setPeriods(prev => prev.filter((_, idx) => idx !== i));
  const updatePeriod = (i: number, patch: Partial<PeriodSlot>) =>
    setPeriods(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));

  const periodoOptions: { tipo: PeriodType; label: string; count: number }[] = [
    { tipo: 'mes', label: 'Mês', count: 12 },
    { tipo: 'bimestre', label: 'Bimestre', count: 6 },
    { tipo: 'trimestre', label: 'Trimestre', count: 4 },
    { tipo: 'semestre', label: 'Semestre', count: 2 },
  ];

  const periodoValueLabels: Record<PeriodType, string[]> = {
    mes: MONTHS,
    bimestre: ['1º Bim (Jan-Fev)', '2º Bim (Mar-Abr)', '3º Bim (Mai-Jun)', '4º Bim (Jul-Ago)', '5º Bim (Set-Out)', '6º Bim (Nov-Dez)'],
    trimestre: ['1º Trim (Jan-Mar)', '2º Trim (Abr-Jun)', '3º Trim (Jul-Set)', '4º Trim (Out-Dez)'],
    semestre: ['1º Sem (Jan-Jun)', '2º Sem (Jul-Dez)'],
  };

  const comparativoRows: { label: string; key: keyof Metrics; fmt: (v: number) => string }[] = [
    { label: 'Qtd de Vendas',      key: 'qtd',        fmt: v => String(v) },
    { label: 'Receita',            key: 'receita',    fmt: fmtBRLFull },
    { label: 'Custo',              key: 'custo',      fmt: fmtBRLFull },
    { label: 'Lucro da Operação',  key: 'lucro',      fmt: fmtBRLFull },
    { label: 'Margem %',           key: 'margem',     fmt: fmtPct },
    { label: 'Ticket Médio',       key: 'ticketMedio',fmt: fmtBRLFull },
    { label: 'Comissão Sorana',    key: 'sorana',     fmt: fmtBRLFull },
    { label: 'Rem. Vendedores',    key: 'remVendedor',fmt: fmtBRLFull },
    { label: 'Rem. Gerência',      key: 'remGerencia',fmt: fmtBRLFull },
    { label: 'Rem. Diretoria',     key: 'remDiretoria',fmt: fmtBRLFull },
    { label: 'Rem. Sup. Usados',   key: 'remSupervisor',fmt: fmtBRLFull },
    { label: 'Total Remunerações', key: 'remTotal',   fmt: fmtBRLFull },
  ];

  // ── Contagem por marca (badges do seletor) ──
  const brandCounts = useMemo(() => {
    const scoped = rows.filter(r =>
      getRowYear(r) === selectedYear && (monthChip === null || getRowMonth(r) === monthChip)
    );
    return {
      todas: scoped.length,
      vw:   scoped.filter(r => r.revenda.toLowerCase().includes('vw')).length,
      audi: scoped.filter(r => r.revenda.toLowerCase().includes('audi')).length,
    };
  }, [rows, selectedYear, monthChip]);

  const hasData = filteredRows.length > 0;

  const brandOptions: { value: BrandFilter; label: string; shortLabel: string; color: string; textColor: string; count: number }[] = [
    { value: 'Todas', label: 'Todas as Revendas', shortLabel: 'Todas',       color: '#f59e0b', textColor: '#ffffff', count: brandCounts.todas },
    { value: 'VW',    label: 'Revenda VW',        shortLabel: 'Revenda VW',  color: '#001E50', textColor: '#ffffff', count: brandCounts.vw   },
    { value: 'Audi',  label: 'Revenda Audi',      shortLabel: 'Revenda Audi',color: '#BB0A21', textColor: '#ffffff', count: brandCounts.audi },
  ];

  return (
    <div className="p-4 space-y-6 bg-slate-50 min-h-full">

      {/* ── BRAND SWITCHER ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Visualizar por</span>
          <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
            {brandOptions.map(opt => {
              const isActive = selectedBrand === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelectedBrand(opt.value)}
                  className="relative flex items-center gap-2.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none"
                  style={isActive
                    ? { background: opt.color, color: opt.textColor, boxShadow: `0 2px 8px ${opt.color}55` }
                    : { color: '#64748b' }
                  }
                >
                  <span className="whitespace-nowrap">{opt.shortLabel}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-bold tabular-nums transition-all duration-200"
                    style={isActive
                      ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#ffffff' }
                      : { backgroundColor: '#e2e8f0', color: '#64748b' }
                    }
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedBrand !== 'Todas' && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: brandOptions.find(o => o.value === selectedBrand)!.color + '18', color: brandOptions.find(o => o.value === selectedBrand)!.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: brandOptions.find(o => o.value === selectedBrand)!.color }} />
              Filtrado: {brandOptions.find(o => o.value === selectedBrand)!.label}
            </span>
          )}
        </div>
      </div>

      {/* ── FILTROS GLOBAIS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">

          {/* Ano */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Blindadora */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Blindadora</span>
            <select
              value={selectedBlindadora}
              onChange={e => setSelectedBlindadora(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {availableBlindadoras.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Chips de mês */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Mês</span>
            <button
              onClick={() => setMonthChip(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${monthChip === null ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Ano todo
            </button>
            {MONTHS.map((m, mi) => {
              const month = mi + 1;
              const isCurrent = month === currentMonth && selectedYear === currentYear;
              return (
                <button
                  key={month}
                  onClick={() => setMonthChip(monthChip === month ? null : month)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    monthChip === month
                      ? 'bg-amber-500 text-white'
                      : isCurrent
                      ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-400 hover:bg-amber-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div>
        <SectionTitle>Visão Geral — {monthChip ? `${MONTHS[monthChip - 1]}/${selectedYear}` : String(selectedYear)}</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiCard label="Total de Vendas" value={String(metrics.qtd)} color="text-slate-800" />
          <KpiCard label="Receita Total" value={fmtBRL(metrics.receita)} color="text-amber-600" />
          <KpiCard label="Custo Total" value={fmtBRL(metrics.custo)} color="text-red-500" />
          <KpiCard label="Lucro da Operação" value={fmtBRL(metrics.lucro)} color="text-emerald-600" />
          <KpiCard label="Margem %" value={fmtPct(metrics.margem)} color={metrics.margem >= 20 ? 'text-emerald-600' : metrics.margem >= 10 ? 'text-amber-600' : 'text-red-500'} />
          <KpiCard label="Ticket Médio" value={fmtBRL(metrics.ticketMedio)} color="text-sky-600" />
          <KpiCard label="Comissão Sorana" value={fmtBRL(metrics.sorana)} color="text-violet-600" sub={metrics.receita > 0 ? fmtPct(metrics.sorana / metrics.receita * 100) + ' da receita' : undefined} />
        </div>
      </div>

      {/* ── EVOLUÇÃO MENSAL ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SectionTitle>Evolução Mensal — {selectedYear}</SectionTitle>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} width={80} />
            <Tooltip content={<CustomTooltipBRL />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="receita" name="Receita" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="lucro" name="Lucro Operação" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="sorana" name="Comissão Sorana" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── ANÁLISE POR DIMENSÃO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Modelos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionTitle>Vendas por Modelo</SectionTitle>
          {modeloData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={modeloData}
                  dataKey="qtd"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={45}
                  paddingAngle={2}
                  label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {modeloData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v, name) => [`${v} venda(s)`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Revendas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionTitle>Revendas — Volume & Ticket Médio</SectionTitle>
          {revendaData.length > 0 ? (
            <div className="space-y-2 mt-1">
              {revendaData.map((r, i) => (
                <div key={r.name} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-700 truncate">{r.name}</span>
                      <span className="text-xs font-semibold text-slate-500 flex-shrink-0">{r.qtd} venda{r.qtd !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${revendaData[0].receita > 0 ? (r.receita / revendaData[0].receita) * 100 : 0}%`, background: PALETTE[i % PALETTE.length] }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0 font-mono">TM: {fmtBRL(r.ticketMedio)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyChart />}
        </div>

        {/* Blindadoras */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionTitle>Comparativo entre Blindadoras</SectionTitle>
          {blindadoraData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={blindadoraData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} width={70} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip content={<CustomTooltipBRL />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Receita" fill="#f59e0b" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="qtd" position="right" formatter={(v: number) => `${v}x`} style={{ fontSize: 11, fill: '#64748b' }} />
                </Bar>
                <Bar dataKey="lucro" name="Lucro" fill="#10b981" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* ── PERFORMANCE POR VENDEDOR ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SectionTitle>Performance por Vendedor</SectionTitle>
        {vendedorData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">#</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Vendedor</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Vendas</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Receita</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Lucro</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Margem</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Remuneração</th>
                  </tr>
                </thead>
                <tbody>
                  {vendedorData.map((v, i) => (
                    <tr key={v.name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="py-2 px-2 text-slate-400 font-mono text-xs">{i + 1}</td>
                      <td className="py-2 px-2 font-medium text-slate-700">{v.name}</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600">{v.qtd}</td>
                      <td className="py-2 px-2 text-right font-mono text-amber-600 font-semibold">{fmtBRL(v.receita)}</td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-600 font-semibold">{fmtBRL(v.lucro)}</td>
                      <td className={`py-2 px-2 text-right font-mono font-semibold ${v.margem >= 20 ? 'text-emerald-600' : v.margem >= 10 ? 'text-amber-600' : 'text-red-500'}`}>{fmtPct(v.margem)}</td>
                      <td className="py-2 px-2 text-right font-mono text-sky-600">{fmtBRL(v.remVendedor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Gráfico */}
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={vendedorData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip content={<CustomTooltipBRL />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Receita" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="#10b981" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyChart />}
      </div>

      {/* ── REMUNERAÇÕES ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SectionTitle>Remunerações e Comissões</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cards + tabela */}
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Vendedores',    value: metrics.remVendedor,  color: 'text-amber-600' },
                { label: 'Gerência',      value: metrics.remGerencia,  color: 'text-blue-600' },
                { label: 'Diretoria',     value: metrics.remDiretoria, color: 'text-violet-600' },
                { label: 'Sup. Usados',   value: metrics.remSupervisor,color: 'text-emerald-600' },
                { label: 'Sorana',        value: metrics.sorana,       color: 'text-red-600' },
                { label: 'Total',         value: metrics.remTotal + metrics.sorana, color: 'text-slate-800' },
              ].map(c => (
                <div key={c.label} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">{c.label}</p>
                  <p className={`text-sm font-bold font-mono ${c.color}`}>{fmtBRL(c.value)}</p>
                </div>
              ))}
            </div>
            {/* Ranking individual de vendedores */}
            {vendedorData.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Ranking individual</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-1.5 px-1 text-xs font-semibold text-slate-400">Vendedor</th>
                      <th className="text-right py-1.5 px-1 text-xs font-semibold text-slate-400">Vendas</th>
                      <th className="text-right py-1.5 px-1 text-xs font-semibold text-slate-400">Remuneração</th>
                      <th className="text-right py-1.5 px-1 text-xs font-semibold text-slate-400">% da Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendedorData.map((v, i) => (
                      <tr key={v.name} className={i % 2 === 0 ? '' : 'bg-slate-50/60'}>
                        <td className="py-1.5 px-1 font-medium text-slate-700">{v.name}</td>
                        <td className="py-1.5 px-1 text-right font-mono text-slate-500">{v.qtd}</td>
                        <td className="py-1.5 px-1 text-right font-mono text-amber-600 font-semibold">{fmtBRL(v.remVendedor)}</td>
                        <td className="py-1.5 px-1 text-right font-mono text-slate-500">{v.receita > 0 ? fmtPct(v.remVendedor / v.receita * 100) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Pizza */}
          {remPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={remPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  paddingAngle={2}
                  label={({ name, percent }) => percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {remPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtBRLFull(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* ── COMPARATIVO DE PERÍODOS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Comparativo de Períodos</SectionTitle>
          {periods.length < 4 && (
            <button
              onClick={addPeriod}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Período
            </button>
          )}
        </div>

        {/* Seletores de período */}
        <div className="flex flex-wrap gap-3 mb-5">
          {periods.map((slot, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: PERIOD_COLORS[i] + '66' }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: PERIOD_COLORS[i] }}
              />
              <span className="text-xs font-semibold text-slate-500">{i === 0 ? 'Base' : `P${i + 1}`}</span>

              {/* Ano */}
              <select
                value={slot.year}
                onChange={e => updatePeriod(i, { year: Number(e.target.value) })}
                className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>

              {/* Tipo */}
              <select
                value={slot.tipo}
                onChange={e => updatePeriod(i, { tipo: e.target.value as PeriodType, value: 1 })}
                className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {periodoOptions.map(o => <option key={o.tipo} value={o.tipo}>{o.label}</option>)}
              </select>

              {/* Valor */}
              <select
                value={slot.value}
                onChange={e => updatePeriod(i, { value: Number(e.target.value) })}
                className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {periodoValueLabels[slot.tipo].map((label, vi) => (
                  <option key={vi + 1} value={vi + 1}>{label}</option>
                ))}
              </select>

              {periods.length > 1 && (
                <button
                  onClick={() => removePeriod(i)}
                  className="text-slate-300 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Tabela comparativa */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Métrica</th>
                {periodMetrics.map(({ slot }, i) => (
                  <th key={i} className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wide" style={{ color: PERIOD_COLORS[i] }}>
                    {i === 0 ? '🔵 Base — ' : `P${i + 1} — `}{periodLabel(slot.tipo, slot.value, slot.year)}
                  </th>
                ))}
                {periodMetrics.slice(1).map((_, i) => (
                  <th key={`d${i}`} className="text-right py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Δ vs Base
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparativoRows.map((row, ri) => (
                <tr key={row.key} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="py-2 px-3 font-medium text-slate-700 border-r border-slate-100">{row.label}</td>
                  {periodMetrics.map(({ metrics: m }, i) => (
                    <td key={i} className="py-2 px-3 text-right font-mono text-slate-700">
                      {row.fmt(m[row.key] as number)}
                    </td>
                  ))}
                  {periodMetrics.slice(1).map(({ metrics: m }, i) => (
                    <td key={`d${i}`} className="py-2 px-3 text-right">
                      <DeltaBadge base={periodMetrics[0].metrics[row.key] as number} current={m[row.key] as number} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Gráfico comparativo */}
        {periods.length > 1 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Receita vs Lucro por Período</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={['receita', 'lucro', 'sorana'].map(key => ({
                  name: key === 'receita' ? 'Receita' : key === 'lucro' ? 'Lucro' : 'Sorana',
                  ...Object.fromEntries(periodMetrics.map(({ slot, metrics: m }, i) => [
                    periodLabel(slot.tipo, slot.value, slot.year),
                    m[key as keyof Metrics],
                  ])),
                }))}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10 }} width={80} />
                <Tooltip content={<CustomTooltipBRL />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {periodMetrics.map(({ slot }, i) => (
                  <Bar key={i} dataKey={periodLabel(slot.tipo, slot.value, slot.year)} fill={PERIOD_COLORS[i]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {!hasData && (
        <div className="text-center py-16 text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum dado para o período selecionado</p>
          <p className="text-sm mt-1">Ajuste os filtros acima para visualizar a análise.</p>
        </div>
      )}

    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[200px] flex items-center justify-center text-slate-300 text-sm">
      Sem dados no período
    </div>
  );
}
