import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, X } from 'lucide-react';
import { loadVPecasSegRows, loadVPecasSegDevolucaoRows, type VPecasSegRow } from './vPecasSeguradoraStorage';

// ─── Paleta sky ───────────────────────────────────────────────────────────────
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const PALETTE = [
  '#0ea5e9','#f59e0b','#10b981','#ef4444','#7c3aed','#f97316',
  '#e879f9','#84cc16','#06b6d4','#fb7185','#a78bfa','#fbbf24',
];
const SKY     = '#0ea5e9';
const SKY_D   = '#0369a1';
const EMERALD = '#10b981';
const AMBER   = '#f59e0b';
const ROSE    = '#f43f5e';
const SLATE   = '#94a3b8';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = (v?: string | null) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRLF = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct  = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

function getYr(row: VPecasSegRow): number {
  if (row.periodoImport) { const [y] = row.periodoImport.split('-').map(Number); if (y > 2000) return y; }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[0];
  return 0;
}
function getMo(row: VPecasSegRow): number {
  if (row.periodoImport) { const [,m] = row.periodoImport.split('-').map(Number); if (m >= 1 && m <= 12) return m; }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[1];
  return 0;
}

// ─── Cálculo por linha ────────────────────────────────────────────────────────
interface Calc {
  valorVenda: number; icms: number; pis: number; cofins: number; difal: number;
  totalImpostos: number; recLiq: number; custo: number; lucroBruto: number; lucroBrutoPct: number;
}
function calcRow(d: Record<string, string>): Calc {
  const valorVenda    = n(d['LIQ_NOTA_FISCAL']);
  const icms          = n(d['VAL_ICMS']);
  const pis           = n(d['VAL_PIS']);
  const cofins        = n(d['VAL_COFINS']);
  const difal         = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
  const totalImpostos = icms + pis + cofins + difal;
  const recLiq        = valorVenda - totalImpostos;
  const custo         = n(d['TOT_CUSTO_MEDIO']);
  const lucroBruto    = recLiq - custo;
  const lucroBrutoPct = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
  return { valorVenda, icms, pis, cofins, difal, totalImpostos, recLiq, custo, lucroBruto, lucroBrutoPct };
}

interface Agg {
  nfs: number; valorVenda: number; icms: number; pis: number; cofins: number;
  difal: number; totalImpostos: number; recLiq: number; custo: number; lucroBruto: number; lbPct: number;
}
function agg(rows: VPecasSegRow[]): Agg {
  let nfs = 0, valorVenda = 0, icms = 0, pis = 0, cofins = 0, difal = 0, totalImpostos = 0, recLiq = 0, custo = 0, lucroBruto = 0;
  for (const r of rows) {
    const c = calcRow(r.data);
    nfs++; valorVenda += c.valorVenda; icms += c.icms; pis += c.pis; cofins += c.cofins;
    difal += c.difal; totalImpostos += c.totalImpostos; recLiq += c.recLiq; custo += c.custo; lucroBruto += c.lucroBruto;
  }
  return { nfs, valorVenda, icms, pis, cofins, difal, totalImpostos, recLiq, custo, lucroBruto, lbPct: recLiq ? lucroBruto / recLiq * 100 : 0 };
}

// ─── Sub-componentes UI ───────────────────────────────────────────────────────
function SH({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
      {right}
    </div>
  );
}

function KpiCard({ label, value, sub, color = 'text-slate-800', accent, delta }: {
  label: string; value: string; sub?: string; color?: string; accent?: string; delta?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col gap-1"
      style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}>
      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</span>
      <span className={`font-bold text-lg leading-tight truncate ${color}`}>{value}</span>
      {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
      {delta !== undefined && (
        <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {delta >= 0 ? '+' : ''}{fmtPct(delta)} vs mês ant.
        </span>
      )}
    </div>
  );
}

function TipBRL({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  // calcula margem: lucroBruto / recLiq — procura as entradas pelo nome
  const recLiqEntry  = payload.find(p => p.name.startsWith('Rec. Líq'));
  const lucroEntry   = payload.find(p => p.name.startsWith('Lucro'));
  const margem = recLiqEntry && lucroEntry && recLiqEntry.value !== 0
    ? (lucroEntry.value / recLiqEntry.value) * 100
    : null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p, i) => p.value !== 0 && (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
        </div>
      ))}
      {margem !== null && (
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
          <span className="text-slate-500 font-medium">% Margem</span>
          <span className={`font-mono font-bold ${margem >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(margem)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VPecasSeguradoraAnalise() {
  const curYear = new Date().getFullYear();
  const [allRows, setAllRows]   = useState<VPecasSegRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [year, setYear]         = useState(curYear);
  const [prevYear, setPrevYear] = useState(curYear - 1);
  const [month, setMonth]       = useState<number | null>(new Date().getMonth() + 1);

  // ranking controls
  const [rankMetric, setRankMetric] = useState<'valorVenda' | 'recLiq' | 'lucroBruto' | 'nfs'>('valorVenda');
  const [rankExpanded, setRankExpanded] = useState(false);

  // comparativo
  const [cmpMetric, setCmpMetric] = useState<'valorVenda' | 'recLiq' | 'lucroBruto'>('valorVenda');
  const [showPrevYear, setShowPrevYear] = useState(false);

  // painel detalhe seguradora
  const [selectedSeg, setSelectedSeg] = useState<string | null>(null);

  // NFs com prejuízo
  const [prejExpanded, setPrejExpanded] = useState(false);
  const [prejSeg, setPrejSeg] = useState('Todas');
  // NFs com lucro
  const [lucroExpanded, setLucroExpanded] = useState(false);
  const [lucroSeg, setLucroSeg] = useState('Todas');
  useEffect(() => {
    Promise.all([loadVPecasSegRows(), loadVPecasSegDevolucaoRows()]).then(([rows, devol]) => {
      setAllRows([...rows, ...devol]);
      const all = [...rows, ...devol];
      if (all.length > 0) {
        const yr = Math.max(...all.map(getYr).filter(y => y > 2000));
        const mo = Math.max(...all.filter(r => getYr(r) === yr).map(getMo).filter(m => m >= 1 && m <= 12));
        setYear(yr);
        setPrevYear(yr - 1);
        setMonth(mo);
      }
      setLoading(false);
    });
  }, []);

  const availYears = useMemo(() => {
    const s = new Set(allRows.map(getYr).filter(y => y > 2000));
    [curYear - 1, curYear].forEach(y => s.add(y));
    return [...s].sort();
  }, [allRows, curYear]);

  const yearRows     = useMemo(() => allRows.filter(r => getYr(r) === year),     [allRows, year]);
  const prevYearRows = useMemo(() => allRows.filter(r => getYr(r) === prevYear), [allRows, prevYear]);

  const filteredRows = useMemo(() => yearRows.filter(r => month === null || getMo(r) === month), [yearRows, month]);
  const prevMonthRows = useMemo(() => {
    if (month === null) return [];
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    return allRows.filter(r => getYr(r) === py && getMo(r) === pm);
  }, [allRows, month, year]);

  const metrics     = useMemo(() => agg(filteredRows),   [filteredRows]);
  const prevMetrics = useMemo(() => agg(prevMonthRows),  [prevMonthRows]);
  const delta = (cur: number, prev: number) => prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : undefined;

  // ─── 1. Evolução Mensal ────────────────────────────────────────────────────
  const monthlyData = useMemo(() => MS.map((label, i) => {
    const m  = i + 1;
    const mr = yearRows.filter(r => getMo(r) === m);
    const pr = prevYearRows.filter(r => getMo(r) === m);
    const a  = agg(mr);
    const ap = agg(pr);
    return {
      label,
      nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, lucroBruto: a.lucroBruto, lbPct: a.lbPct,
      prevValorVenda: ap.valorVenda, prevRecLiq: ap.recLiq, prevLucroBruto: ap.lucroBruto,
    };
  }), [yearRows, prevYearRows]);

  // ─── 2. Ranking por Seguradora ────────────────────────────────────────────
  const segData = useMemo(() => {
    const map = new Map<string, VPecasSegRow[]>();
    for (const r of filteredRows) {
      const k = r.data['NOME_CLIENTE']?.trim() || '(sem seguradora)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rows]) => {
      const a = agg(rows);
      return { name, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, lucroBruto: a.lucroBruto, lbPct: a.lbPct };
    }).sort((a, b) => b[rankMetric] - a[rankMetric]);
  }, [filteredRows, rankMetric]);

  const segMax = useMemo(() => Math.max(...segData.map(s => s[rankMetric]), 1), [segData, rankMetric]);
  const availSegs = useMemo(() => ['Todas', ...segData.map(s => s.name)], [segData]);

  // ─── 3. Comparativo mensal por seguradora ────────────────────────────────
  const cmpData = useMemo(() => {
    const topSegs = segData.slice(0, 6).map(s => s.name);
    return MS.map((label, i) => {
      const m = i + 1;
      const mr = yearRows.filter(r => getMo(r) === m);
      const entry: Record<string, number> & { label: string } = { label };
      for (const seg of topSegs) {
        const rows = mr.filter(r => (r.data['NOME_CLIENTE']?.trim() || '(sem seguradora)') === seg);
        entry[seg] = agg(rows)[cmpMetric];
      }
      return entry;
    });
  }, [yearRows, segData, cmpMetric]);

  const topSegsForCmp = useMemo(() => segData.slice(0, 6).map(s => s.name), [segData]);

  // ─── 4. Pizza distribuição ────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const validData = segData.filter(d => d[rankMetric] > 0);
    const total = validData.reduce((s, d) => s + d[rankMetric], 0);
    return validData.slice(0, 8).map((d, i) => ({
      name: d.name,
      value: d[rankMetric],
      pct: total ? (d[rankMetric] / total) * 100 : 0,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [segData, rankMetric]);

  // ─── 5. Detalhe seguradora selecionada ───────────────────────────────────
  const segDetail = useMemo(() => {
    if (!selectedSeg) return null;
    const rows = yearRows.filter(r => (r.data['NOME_CLIENTE']?.trim() || '(sem seguradora)') === selectedSeg);
    const monthly = MS.map((label, i) => {
      const m = i + 1;
      const mr = rows.filter(r => getMo(r) === m);
      const a  = agg(mr);
      return { label, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, lucroBruto: a.lucroBruto };
    });
    const nfs = filteredRows
      .filter(r => (r.data['NOME_CLIENTE']?.trim() || '(sem seguradora)') === selectedSeg)
      .map(r => {
        const c = calcRow(r.data);
        return {
          nf:         r.data['NUMERO_NOTA_FISCAL']?.trim() || '—',
          serie:      r.data['SERIE_NOTA_FISCAL']?.trim() || '',
          vendedor:   r.data['NOME_VENDEDOR']?.trim() || '—',
          valorVenda: c.valorVenda,
          recLiq:     c.recLiq,
          lucroBruto: c.lucroBruto,
          lbPct:      c.lucroBrutoPct,
        };
      })
      .sort((a, b) => b.lucroBruto - a.lucroBruto);
    return { monthly, nfs, totals: agg(filteredRows.filter(r => (r.data['NOME_CLIENTE']?.trim() || '(sem seguradora)') === selectedSeg)) };
  }, [selectedSeg, yearRows, filteredRows]);

  // ─── 6. NFs com prejuízo ────────────────────────────────────────────────
  const prejData = useMemo(() => {
    const source = prejSeg !== 'Todas'
      ? filteredRows.filter(r => (r.data['NOME_CLIENTE']?.trim() || '(sem seguradora)') === prejSeg)
      : filteredRows;
    return source
      .map(r => {
        const c = calcRow(r.data);
        return {
          nf:         r.data['NUMERO_NOTA_FISCAL']?.trim() || '—',
          serie:      r.data['SERIE_NOTA_FISCAL']?.trim() || '',
          seguradora: r.data['NOME_CLIENTE']?.trim() || '—',
          vendedor:   r.data['NOME_VENDEDOR']?.trim() || '—',
          valorVenda: c.valorVenda,
          recLiq:     c.recLiq,
          lucroBruto: c.lucroBruto,
          lbPct:      c.lucroBrutoPct,
        };
      })
      .filter(r => r.lucroBruto < 0)
      .sort((a, b) => a.lucroBruto - b.lucroBruto);
  }, [filteredRows, prejSeg]);

  // ─── 7. NFs com Lucro ────────────────────────────────────────────────────
  const lucroData = useMemo(() => {
    const source = lucroSeg !== 'Todas'
      ? filteredRows.filter(r => (r.data['NOME_CLIENTE']?.trim() || '(sem seguradora)') === lucroSeg)
      : filteredRows;
    return source
      .map(r => {
        const c = calcRow(r.data);
        return {
          nf:         r.data['NUMERO_NOTA_FISCAL']?.trim() || '—',
          serie:      r.data['SERIE_NOTA_FISCAL']?.trim() || '',
          seguradora: r.data['NOME_CLIENTE']?.trim() || '—',
          vendedor:   r.data['NOME_VENDEDOR']?.trim() || '—',
          valorVenda: c.valorVenda,
          recLiq:     c.recLiq,
          lucroBruto: c.lucroBruto,
          lbPct:      c.lucroBrutoPct,
        };
      })
      .filter(r => r.lucroBruto > 0)
      .sort((a, b) => b.lucroBruto - a.lucroBruto);
  }, [filteredRows, lucroSeg]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-300">
        <span className="text-sm animate-pulse">Carregando análises...</span>
      </div>
    );
  }

  if (allRows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
        <TrendingUp className="w-12 h-12" />
        <span className="text-sm">Nenhum dado — importe Peças Seguradora Balcão na aba Registros</span>
      </div>
    );
  }

  const rankLabel: Record<typeof rankMetric, string> = { valorVenda: 'Receita Bruta', recLiq: 'Rec. Líquida', lucroBruto: 'Lucro Bruto', nfs: 'Qtd NFs' };
  const cmpLabel:  Record<typeof cmpMetric, string>  = { valorVenda: 'Receita Bruta', recLiq: 'Rec. Líquida', lucroBruto: 'Lucro Bruto' };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 px-6 py-5 space-y-8" style={{ minHeight: 0 }}>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          ANO
          <select
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sky-400"
          >
            {availYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setMonth(null)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${month === null ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Ano todo
          </button>
          {MS.map((m, i) => (
            <button key={m} onClick={() => setMonth(i + 1)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${month === i + 1 ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-slate-400">{filteredRows.length} NF{filteredRows.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="Total de NFs"    value={metrics.nfs.toLocaleString('pt-BR')} accent={SKY}
          delta={month !== null ? delta(metrics.nfs, prevMetrics.nfs) : undefined} />
        <KpiCard label="Receita Bruta"   value={fmtBRL(metrics.valorVenda)} color="text-sky-700" accent={SKY}
          delta={month !== null ? delta(metrics.valorVenda, prevMetrics.valorVenda) : undefined} />
        <KpiCard label="Total Impostos"  value={fmtBRL(metrics.totalImpostos)} color="text-rose-600" accent={ROSE}
          sub={metrics.valorVenda ? fmtPct(metrics.totalImpostos / metrics.valorVenda * 100) + ' da receita' : undefined} />
        <KpiCard label="Receita Líquida" value={fmtBRL(metrics.recLiq)} color="text-emerald-700" accent={EMERALD}
          delta={month !== null ? delta(metrics.recLiq, prevMetrics.recLiq) : undefined} />
        <KpiCard label="Custo Médio"     value={fmtBRL(metrics.custo)} color="text-amber-700" accent={AMBER}
          sub={metrics.recLiq ? fmtPct(metrics.custo / metrics.recLiq * 100) + ' da Rec. Líq.' : undefined} />
        <KpiCard label="Lucro Bruto"     value={fmtBRL(metrics.lucroBruto)} color={metrics.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'} accent={metrics.lucroBruto >= 0 ? EMERALD : ROSE}
          delta={month !== null ? delta(metrics.lucroBruto, prevMetrics.lucroBruto) : undefined} />
        <KpiCard label="% Margem"        value={fmtPct(metrics.lbPct)} color={metrics.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'} accent={metrics.lbPct >= 0 ? EMERALD : ROSE} />
      </div>

      {/* ── Evolução Mensal ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SH right={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPrevYear}
                onChange={e => { setShowPrevYear(e.target.checked); if (e.target.checked) setPrevYear(year - 1); }}
                className="accent-sky-500 w-3.5 h-3.5"
              />
              Comparar com
              <select
                value={prevYear}
                onChange={e => setPrevYear(+e.target.value)}
                onClick={e => e.stopPropagation()}
                className="border border-slate-200 rounded px-1.5 py-0.5 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
              >
                {availYears.filter(y => y !== year).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
        }>Evolução Mensal — {year}</SH>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtBRL(v).replace('R$\u00a0', 'R$')} width={80} />
            <Tooltip content={<TipBRL />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="valorVenda"    name={`Rec. Bruta ${year}`}    fill={SKY}     fillOpacity={0.85} radius={[3,3,0,0]} />
            <Bar dataKey="recLiq"        name={`Rec. Líquida ${year}`}  fill={EMERALD} fillOpacity={0.85} radius={[3,3,0,0]} />
            <Bar dataKey="lucroBruto"    name={`Lucro Bruto ${year}`}   fill={AMBER}   fillOpacity={0.85} radius={[3,3,0,0]} />
            {showPrevYear && <Bar dataKey="prevValorVenda"  name={`Rec. Bruta ${prevYear}`}  fill={SKY}     fillOpacity={0.3} radius={[3,3,0,0]} />}
            {showPrevYear && <Bar dataKey="prevRecLiq"      name={`Rec. Líq. ${prevYear}`}   fill={EMERALD} fillOpacity={0.3} radius={[3,3,0,0]} />}
            {showPrevYear && <Bar dataKey="prevLucroBruto"  name={`L. Bruto ${prevYear}`}    fill={AMBER}   fillOpacity={0.3} radius={[3,3,0,0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Ranking por Seguradora + Pizza ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Ranking */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SH right={
            <div className="flex gap-1 flex-wrap">
              {(['valorVenda', 'recLiq', 'lucroBruto', 'nfs'] as const).map(m => (
                <button key={m} onClick={() => setRankMetric(m)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all ${
                    rankMetric === m ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300'
                  }`}
                >
                  {rankLabel[m]}
                </button>
              ))}
            </div>
          }>Ranking por Seguradora</SH>

          {segData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-slate-200 gap-2">
              <span className="text-xs">Sem dados</span>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="grid grid-cols-[1.5fr_0.5fr_1fr_1fr_1fr_0.8fr] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
                <span>Seguradora</span>
                <span className="text-right">NFs</span>
                <span className="text-right">Rec. Bruta</span>
                <span className="text-right">Rec. Líq.</span>
                <span className="text-right">Lucro Bruto</span>
                <span className="text-right">% Margem</span>
              </div>
              {(rankExpanded ? segData : segData.slice(0, 8)).map((s, i) => {
                const barW = segMax > 0 ? (s[rankMetric] / segMax) * 100 : 0;
                const isSelected = selectedSeg === s.name;
                return (
                  <div key={s.name}
                    onClick={() => setSelectedSeg(isSelected ? null : s.name)}
                    className={`grid grid-cols-[1.5fr_0.5fr_1fr_1fr_1fr_0.8fr] gap-2 items-center px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-sky-50 border border-sky-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 text-[10px] font-bold text-slate-300">{i + 1}</span>
                        <span className="text-xs font-semibold text-slate-700 truncate">{s.name}</span>
                      </div>
                      <div className="ml-5 h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${barW}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                      </div>
                    </div>
                    <span className="text-right text-xs font-mono text-slate-600">{s.nfs}</span>
                    <span className="text-right text-xs font-mono text-slate-700">{fmtBRL(s.valorVenda)}</span>
                    <span className="text-right text-xs font-mono text-emerald-700">{fmtBRL(s.recLiq)}</span>
                    <span className={`text-right text-xs font-mono font-bold ${s.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtBRL(s.lucroBruto)}</span>
                    <span className={`text-right text-xs font-mono ${s.lbPct >= 0 ? 'text-slate-600' : 'text-rose-600'}`}>{fmtPct(s.lbPct)}</span>
                  </div>
                );
              })}
              {segData.length > 8 && (
                <button onClick={() => setRankExpanded(e => !e)}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-sky-600 hover:text-sky-800 font-semibold py-1"
                >
                  {rankExpanded ? <><ChevronUp className="w-3.5 h-3.5" /> Ver menos</> : <><ChevronDown className="w-3.5 h-3.5" /> Ver todas ({segData.length})</>}
                </button>
              )}
              {segData.length > 0 && (
                <p className="mt-2 text-[10px] text-slate-400 text-center">Clique em uma seguradora para ver o detalhe mensal e NFs</p>
              )}
            </>
          )}
        </div>

        {/* Pizza */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SH>Distribuição % — {rankLabel[rankMetric]}</SH>
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-200 gap-2">
              <span className="text-xs">Sem dados</span>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => rankMetric === 'nfs' ? v.toLocaleString('pt-BR') : fmtBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-[11px] text-slate-600 truncate flex-1">{d.name}</span>
                    <span className="text-[11px] font-mono text-slate-500">{fmtPct(d.pct)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Painel detalhe seguradora selecionada ────────────────────────────── */}
      {selectedSeg && segDetail && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-sky-800">{selectedSeg}</h3>
              <div className="flex gap-4 mt-1 text-[11px] text-sky-700">
                <span>{segDetail.totals.nfs} NF{segDetail.totals.nfs !== 1 ? 's' : ''}</span>
                <span>Rec. Bruta: <strong>{fmtBRL(segDetail.totals.valorVenda)}</strong></span>
                <span>Rec. Líq.: <strong>{fmtBRL(segDetail.totals.recLiq)}</strong></span>
                <span>Lucro: <strong className={segDetail.totals.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{fmtBRL(segDetail.totals.lucroBruto)}</strong></span>
                <span>Margem: <strong>{fmtPct(segDetail.totals.lbPct)}</strong></span>
              </div>
            </div>
            <button onClick={() => setSelectedSeg(null)} className="text-sky-400 hover:text-sky-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Evolução mensal da seguradora */}
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={segDetail.monthly} margin={{ top: 2, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7dd3fc' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#7dd3fc' }} axisLine={false} tickLine={false} tickFormatter={v => fmtBRL(v).replace('R$\u00a0', 'R$')} width={80} />
              <Tooltip content={<TipBRL />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="valorVenda" name="Rec. Bruta"   fill={SKY}     fillOpacity={0.85} radius={[3,3,0,0]} />
              <Bar dataKey="recLiq"     name="Rec. Líquida" fill={EMERALD} fillOpacity={0.85} radius={[3,3,0,0]} />
              <Bar dataKey="lucroBruto" name="Lucro Bruto"  fill={AMBER}   fillOpacity={0.85} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Lista de NFs */}
          {segDetail.nfs.length > 0 && (
            <div>
              <div className="grid grid-cols-[auto_1.5fr_1fr_1fr_1fr_0.8fr] gap-2 text-[10px] font-bold text-sky-400 uppercase tracking-wider px-2 pb-1 border-b border-sky-200">
                <span className="w-5">#</span>
                <span>NF</span>
                <span>Vendedor</span>
                <span className="text-right">Rec. Bruta</span>
                <span className="text-right">Lucro Bruto</span>
                <span className="text-right">% Margem</span>
              </div>
              {segDetail.nfs.slice(0, 10).map((nf, i) => (
                <div key={i} className="grid grid-cols-[auto_1.5fr_1fr_1fr_1fr_0.8fr] gap-2 items-center px-2 py-1.5 rounded hover:bg-sky-100 transition-colors">
                  <span className="w-5 text-[10px] font-bold text-sky-300">{i + 1}</span>
                  <div>
                    <span className="text-xs font-mono font-semibold text-sky-800">{nf.nf}</span>
                    {nf.serie && <span className="text-[10px] text-sky-400 ml-1">S{nf.serie}</span>}
                  </div>
                  <span className="text-xs text-slate-500 truncate">{nf.vendedor}</span>
                  <span className="text-right text-xs font-mono text-slate-700">{fmtBRL(nf.valorVenda)}</span>
                  <span className={`text-right text-xs font-mono font-bold ${nf.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtBRL(nf.lucroBruto)}</span>
                  <span className={`text-right text-xs font-mono ${nf.lbPct >= 0 ? 'text-slate-600' : 'text-rose-600'}`}>{fmtPct(nf.lbPct)}</span>
                </div>
              ))}
              {segDetail.nfs.length > 10 && (
                <p className="text-center text-[10px] text-sky-400 mt-1">+ {segDetail.nfs.length - 10} NFs (período selecionado)</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Comparativo entre as Top Seguradoras ─────────────────────────────── */}
      {topSegsForCmp.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SH right={
            <div className="flex gap-1">
              {(['valorVenda', 'recLiq', 'lucroBruto'] as const).map(m => (
                <button key={m} onClick={() => setCmpMetric(m)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all ${
                    cmpMetric === m ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300'
                  }`}
                >
                  {cmpLabel[m]}
                </button>
              ))}
            </div>
          }>Comparativo Mensal — Top {topSegsForCmp.length} Seguradoras</SH>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cmpData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={1} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtBRL(v).replace('R$\u00a0', 'R$')} width={80} />
              <Tooltip content={<TipBRL />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {topSegsForCmp.map((seg, i) => (
                <Bar key={seg} dataKey={seg} name={seg} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} radius={[3,3,0,0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── NFs com Prejuízo ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SH right={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Seguradora:</span>
            <select value={prejSeg} onChange={e => setPrejSeg(e.target.value)}
              className="border border-slate-200 rounded px-2 py-0.5 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
            >
              {availSegs.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        }>NFs com Prejuízo {prejData.length > 0 && <span className="ml-1 text-rose-500">({prejData.length})</span>}</SH>

        {prejData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-16 gap-1">
            <span className="text-xs text-slate-300">Nenhuma NF com prejuízo no período</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[auto_1fr_2fr_1.5fr_1fr_1fr_0.8fr] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
              <span className="w-5">#</span>
              <span>NF</span>
              <span>Seguradora</span>
              <span>Vendedor</span>
              <span className="text-right">Rec. Bruta</span>
              <span className="text-right">Lucro Bruto</span>
              <span className="text-right">% Margem</span>
            </div>
            {(prejExpanded ? prejData : prejData.slice(0, 8)).map((p, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_2fr_1.5fr_1fr_1fr_0.8fr] gap-2 items-center px-2 py-2 rounded-lg hover:bg-rose-50 transition-colors">
                <span className="w-5 text-[10px] font-bold text-slate-300">{i + 1}</span>
                <div>
                  <span className="text-xs font-mono font-semibold text-slate-700">{p.nf}</span>
                  {p.serie && <span className="text-[10px] text-slate-400 ml-1">S{p.serie}</span>}
                </div>
                <span className="text-xs text-slate-600 truncate">{p.seguradora}</span>
                <span className="text-xs text-slate-500 truncate">{p.vendedor}</span>
                <span className="text-right text-xs font-mono text-slate-700">{fmtBRL(p.valorVenda)}</span>
                <span className="text-right text-xs font-mono font-bold text-rose-600">{fmtBRL(p.lucroBruto)}</span>
                <span className="text-right text-xs font-mono text-rose-600">{fmtPct(p.lbPct)}</span>
              </div>
            ))}
            {prejData.length > 8 && (
              <button onClick={() => setPrejExpanded(e => !e)}
                className="mt-1 w-full flex items-center justify-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 font-semibold py-1"
              >
                {prejExpanded
                  ? <><ChevronUp className="w-3.5 h-3.5" /> Ver menos</>
                  : <><ChevronDown className="w-3.5 h-3.5" /> Ver todas ({prejData.length})</>}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── NFs com Lucro ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SH right={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Seguradora:</span>
            <select value={lucroSeg} onChange={e => setLucroSeg(e.target.value)}
              className="border border-slate-200 rounded px-2 py-0.5 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-emerald-300"
            >
              {availSegs.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        }>NFs com Lucro {lucroData.length > 0 && <span className="ml-1 text-emerald-600">({lucroData.length})</span>}</SH>

        {lucroData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-16 gap-1">
            <span className="text-xs text-slate-300">Nenhuma NF com lucro no período</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[auto_1fr_2fr_1.5fr_1fr_1fr_0.8fr] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
              <span className="w-5">#</span>
              <span>NF</span>
              <span>Seguradora</span>
              <span>Vendedor</span>
              <span className="text-right">Rec. Bruta</span>
              <span className="text-right">Lucro Bruto</span>
              <span className="text-right">% Margem</span>
            </div>
            {(lucroExpanded ? lucroData : lucroData.slice(0, 8)).map((p, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_2fr_1.5fr_1fr_1fr_0.8fr] gap-2 items-center px-2 py-2 rounded-lg hover:bg-emerald-50 transition-colors">
                <span className="w-5 text-[10px] font-bold text-slate-300">{i + 1}</span>
                <div>
                  <span className="text-xs font-mono font-semibold text-slate-700">{p.nf}</span>
                  {p.serie && <span className="text-[10px] text-slate-400 ml-1">S{p.serie}</span>}
                </div>
                <span className="text-xs text-slate-600 truncate">{p.seguradora}</span>
                <span className="text-xs text-slate-500 truncate">{p.vendedor}</span>
                <span className="text-right text-xs font-mono text-slate-700">{fmtBRL(p.valorVenda)}</span>
                <span className="text-right text-xs font-mono font-bold text-emerald-700">{fmtBRL(p.lucroBruto)}</span>
                <span className="text-right text-xs font-mono text-emerald-600">{fmtPct(p.lbPct)}</span>
              </div>
            ))}
            {lucroData.length > 8 && (
              <button onClick={() => setLucroExpanded(e => !e)}
                className="mt-1 w-full flex items-center justify-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold py-1"
              >
                {lucroExpanded
                  ? <><ChevronUp className="w-3.5 h-3.5" /> Ver menos</>
                  : <><ChevronDown className="w-3.5 h-3.5" /> Ver todas ({lucroData.length})</>}
              </button>
            )}
          </>
        )}
      </div>

    </div>
  );
}