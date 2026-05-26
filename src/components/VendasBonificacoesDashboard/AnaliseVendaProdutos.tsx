import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, BarChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { loadProdutosRows } from './produtosMonitoradosStorage';
import type { VPecasItemRow } from './vPecasItemStorage';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const MS      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const VIOLET  = '#7c3aed';
const VIOLETL = '#a78bfa';
const TEAL    = '#0d9488';
const EMERALD = '#10b981';
const AMBER   = '#f59e0b';
const ROSE    = '#f43f5e';
const PALETTE = [
  '#7c3aed','#f97316','#10b981','#ef4444','#0d9488','#f59e0b',
  '#e879f9','#84cc16','#06b6d4','#fb7185','#a78bfa','#fbbf24',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n       = (v?: string | null) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRLF = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct  = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const fmtQtd  = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// ─── Period ───────────────────────────────────────────────────────────────────
interface Period { year: number; month: number; day: number }

function rowPeriod(r: VPecasItemRow): Period | null {
  const dta = r.data['DTA_ENTRADA_SAIDA'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dta)) {
    const [d, m, y] = dta.split('/').map(Number);
    return { year: y, month: m, day: d };
  }
  if (r.periodoImport) {
    const [y, m] = r.periodoImport.split('-').map(Number);
    if (y > 2000 && m >= 1 && m <= 12) return { year: y, month: m, day: 1 };
  }
  return null;
}

const getYr = (r: VPecasItemRow) => rowPeriod(r)?.year ?? 0;
const getMo = (r: VPecasItemRow) => rowPeriod(r)?.month ?? 0;
const getDy = (r: VPecasItemRow) => rowPeriod(r)?.day ?? 0;

// ─── Cálculo e agregação ──────────────────────────────────────────────────────
interface Agg {
  count: number; qtd: number; valVenda: number; valImpostos: number;
  recLiq: number; custoMedio: number; lucroBruto: number; lbPct: number;
}

function aggRows(rows: VPecasItemRow[]): Agg {
  let count = 0, qtd = 0, valVenda = 0, valImpostos = 0,
      recLiq = 0, custoMedio = 0, lucroBruto = 0;
  for (const r of rows) {
    const d  = r.data;
    const vv = n(d['VAL_VENDA']);
    const vi = n(d['VAL_IMPOSTOS']);
    const cm = n(d['CUSTO_MEDIO']);
    const rl = vv - vi;
    count++;
    qtd        += n(d['QUANTIDADE']);
    valVenda   += vv;
    valImpostos += vi;
    recLiq     += rl;
    custoMedio += cm;
    lucroBruto += rl - cm;
  }
  return { count, qtd, valVenda, valImpostos, recLiq, custoMedio, lucroBruto,
    lbPct: recLiq !== 0 ? lucroBruto / recLiq * 100 : 0 };
}

type RankKey = 'valVenda' | 'recLiq' | 'lucroBruto';

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function SH({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
      {right}
    </div>
  );
}

function KpiCard({ label, value, sub, color = 'text-slate-800', accent, delta, deltaLabel = 'vs mesmo mês ano ant.' }: {
  label: string; value: string; sub?: string; color?: string; accent?: string; delta?: number; deltaLabel?: string;
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
          {delta >= 0 ? '+' : ''}{fmtPct(delta)} {deltaLabel}
        </span>
      )}
    </div>
  );
}

function MetricToggle({ value, onChange }: { value: RankKey; onChange: (v: RankKey) => void }) {
  const opts: { k: RankKey; label: string }[] = [
    { k: 'valVenda',   label: 'Receita Bruta' },
    { k: 'recLiq',     label: 'Rec. Líquida' },
    { k: 'lucroBruto', label: 'Lucro Bruto' },
  ];
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
      {opts.map(({ k, label }) => (
        <button key={k} onClick={() => onChange(k)}
          className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${value === k ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// Tooltip BRL genérico (mostra % Margem se lbPct existir no payload)
function TipBRL({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string; payload: Record<string, number | string> }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const brlEntries = payload.filter(p => p.name !== '% Margem');
  const margemEntry = payload.find(p => p.name === '% Margem');
  const firstPayload = payload[0]?.payload;
  const hasAccum =
    typeof firstPayload?.cumValVenda === 'number' &&
    typeof firstPayload?.cumRecLiq === 'number' &&
    typeof firstPayload?.cumLucroBruto === 'number';
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {brlEntries.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
        </div>
      ))}
      {margemEntry && (
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
          <span className="text-slate-500 font-medium">% Margem</span>
          <span className={`font-mono font-bold ${margemEntry.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {fmtPct(margemEntry.value)}
          </span>
        </div>
      )}
      {hasAccum && (
        <>
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-400 mb-1">Acumulado até dia {label}</p>
            <div className="flex justify-between gap-4">
              <span className="text-violet-700 font-medium">Receita Bruta</span>
              <span className="font-mono text-slate-700">{fmtBRLF(Number(firstPayload.cumValVenda))}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-teal-700 font-medium">Rec. Líquida</span>
              <span className="font-mono text-slate-700">{fmtBRLF(Number(firstPayload.cumRecLiq))}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-emerald-700 font-medium">Lucro Bruto</span>
              <span className="font-mono text-slate-700">{fmtBRLF(Number(firstPayload.cumLucroBruto))}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TipComparativoMensal({
  active,
  payload,
  label,
  year,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; payload: Record<string, number | string> }[];
  label?: string;
  year: number;
}) {
  if (!active || !payload?.length) return null;

  const firstPayload = payload[0]?.payload;
  const recLiq = typeof firstPayload?.recLiq === 'number' ? firstPayload.recLiq : 0;
  const lbPct = typeof firstPayload?.lbPct === 'number' ? firstPayload.lbPct : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[220px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
        </div>
      ))}

      <div className="mt-2 pt-2 border-t border-slate-200">
        <div className="flex justify-between gap-4">
          <span className="text-teal-700 font-medium">Rec. Líquida {year}</span>
          <span className="font-mono text-slate-700">{fmtBRLF(recLiq)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-emerald-700 font-medium">% Margem {year}</span>
          <span className={`font-mono font-bold ${lbPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(lbPct)}</span>
        </div>
      </div>
    </div>
  );
}

function TipEvolucaoMensal({
  active,
  payload,
  label,
  year,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; payload: Record<string, number | string> }[];
  label?: string;
  year: number;
}) {
  if (!active || !payload?.length) return null;

  const firstPayload = payload[0]?.payload;
  const recLiq = typeof firstPayload?.recLiq === 'number' ? firstPayload.recLiq : 0;
  const lbPct = typeof firstPayload?.lbPct === 'number' ? firstPayload.lbPct : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[220px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
        </div>
      ))}

      <div className="mt-2 pt-2 border-t border-slate-200">
        <div className="flex justify-between gap-4">
          <span className="text-teal-700 font-medium">Rec. Líquida {year}</span>
          <span className="font-mono text-slate-700">{fmtBRLF(recLiq)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-emerald-700 font-medium">% Margem {year}</span>
          <span className={`font-mono font-bold ${lbPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(lbPct)}</span>
        </div>
      </div>
    </div>
  );
}

// Tooltip para gráfico de vendedores (BRL + nome do item)
function TipVendors({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value > 0 ? p.value : 0), 0);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.filter(p => p.value > 0).map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium truncate max-w-[120px]">{p.name}</span>
          <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
        <span className="text-slate-500 font-medium">Total</span>
        <span className="font-mono font-bold text-slate-700">{fmtBRLF(total)}</span>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AnaliseVendaProdutos() {
  const curYear = new Date().getFullYear();

  const [allRows, setAllRows]   = useState<VPecasItemRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [year, setYear]         = useState(curYear);
  const [prevYear, setPrevYear] = useState(curYear - 1);
  const [month, setMonth]       = useState<number | null>(new Date().getMonth() + 1);

  const [rankMetric, setRankMetric] = useState<RankKey>('valVenda');
  const [cmpMetric,  setCmpMetric]  = useState<RankKey>('valVenda');
  const [showPrevYear, setShowPrevYear] = useState(false);

  useEffect(() => {
    loadProdutosRows().then(rows => {
      setAllRows(rows);
      if (rows.length > 0) {
        const years = rows.map(getYr).filter(y => y > 2000);
        if (years.length) {
          const maxY = Math.max(...years);
          const maxM = Math.max(...rows.filter(r => getYr(r) === maxY).map(getMo).filter(m => m >= 1));
          setYear(maxY);
          setPrevYear(maxY - 1);
          setMonth(maxM || null);
        }
      }
      setLoading(false);
    });
  }, []);

  const availYears = useMemo(() => {
    const s = new Set(allRows.map(getYr).filter(y => y > 2000));
    [curYear - 1, curYear].forEach(y => s.add(y));
    return [...s].sort();
  }, [allRows, curYear]);

  // ─── Row sets ─────────────────────────────────────────────────────────────
  const yearRows     = useMemo(() => allRows.filter(r => getYr(r) === year),     [allRows, year]);
  const prevYearRows = useMemo(() => allRows.filter(r => getYr(r) === prevYear), [allRows, prevYear]);

  const filteredRows = useMemo(() =>
    yearRows.filter(r => month === null || getMo(r) === month),
    [yearRows, month]);

  const prevCompRows = useMemo(() =>
    month === null
      ? prevYearRows
      : prevYearRows.filter(r => getMo(r) === month),
    [prevYearRows, month]);

  // ─── Métricas ─────────────────────────────────────────────────────────────
  const metrics     = useMemo(() => aggRows(filteredRows),  [filteredRows]);
  const prevMetrics = useMemo(() => aggRows(prevCompRows),  [prevCompRows]);

  const delta = (cur: number, prev: number) =>
    prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : undefined;

  const monthCounts = useMemo(() => {
    const c: Record<number, number> = {};
    yearRows.forEach(r => { const m = getMo(r); if (m >= 1) c[m] = (c[m] ?? 0) + 1; });
    return c;
  }, [yearRows]);

  // ─── Evolução Diária ──────────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    if (month === null) return [];
    const daysInMonth = new Date(year, month, 0).getDate();
    let cumValVenda = 0;
    let cumRecLiq = 0;
    let cumLucroBruto = 0;
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day  = i + 1;
      const a    = aggRows(filteredRows.filter(r => getDy(r) === day));
      cumValVenda += a.valVenda;
      cumRecLiq += a.recLiq;
      cumLucroBruto += a.lucroBruto;
      return {
        label: String(day).padStart(2, '0'),
        valVenda: a.valVenda,
        recLiq: a.recLiq,
        lucroBruto: a.lucroBruto,
        lbPct: a.lbPct,
        count: a.count,
        cumValVenda,
        cumRecLiq,
        cumLucroBruto,
      };
    });
  }, [filteredRows, month, year]);

  // ─── Evolução Mensal ──────────────────────────────────────────────────────
  const monthlyData = useMemo(() => MS.map((label, i) => {
    const m  = i + 1;
    const ac = aggRows(yearRows.filter(r => getMo(r) === m));
    const ap = aggRows(prevYearRows.filter(r => getMo(r) === m));
    return {
      label,
      valVenda:       ac.valVenda,
      recLiq:         ac.recLiq,
      lucroBruto:     ac.lucroBruto,
      lbPct:          ac.lbPct,
      prevValVenda:   ap.valVenda,
      prevRecLiq:     ap.recLiq,
      prevLucroBruto: ap.lucroBruto,
      prevLbPct:      ap.lbPct,
    };
  }), [yearRows, prevYearRows]);

  // ─── Ranking por Produto ──────────────────────────────────────────────────
  const productData = useMemo(() => {
    const map = new Map<string, { pub: string; des: string; rows: VPecasItemRow[] }>();
    for (const r of filteredRows) {
      const pub = r.data['ITEM_ESTOQUE_PUB']?.trim() || '(sem código)';
      const des = r.data['DES_ITEM_ESTOQUE']?.trim() || '';
      if (!map.has(pub)) map.set(pub, { pub, des, rows: [] });
      map.get(pub)!.rows.push(r);
    }
    return [...map.values()].map(({ pub, des, rows }) => {
      const a = aggRows(rows);
      return { pub, des, ...a };
    }).sort((a, b) => b[rankMetric] - a[rankMetric]);
  }, [filteredRows, rankMetric]);

  const productMax     = useMemo(() => Math.max(...productData.map(p => p[rankMetric]), 1), [productData, rankMetric]);
  const productPieData = useMemo(() => {
    const total = productData.reduce((s, p) => s + Math.max(p[rankMetric], 0), 0);
    return productData.filter(p => p[rankMetric] > 0).map((p, i) => ({
      name: p.pub, des: p.des, value: p[rankMetric],
      pct: total ? (p[rankMetric] / total) * 100 : 0,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [productData, rankMetric]);

  // ─── Ranking por Vendedor ─────────────────────────────────────────────────
  const vendorData = useMemo(() => {
    const map = new Map<string, VPecasItemRow[]>();
    for (const r of filteredRows) {
      const k = r.data['NOME_VENDEDOR']?.trim() || '(sem vendedor)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rows]) => {
      const a = aggRows(rows);
      return { name, ...a };
    }).sort((a, b) => b[rankMetric] - a[rankMetric]);
  }, [filteredRows, rankMetric]);

  const vendorMax     = useMemo(() => Math.max(...vendorData.map(v => v[rankMetric]), 1), [vendorData, rankMetric]);
  const vendorPieData = useMemo(() => {
    const total = vendorData.reduce((s, v) => s + Math.max(v[rankMetric], 0), 0);
    return vendorData.filter(v => v[rankMetric] > 0).slice(0, 8).map((v, i) => ({
      name: v.name, value: v[rankMetric],
      pct: total ? (v[rankMetric] / total) * 100 : 0,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [vendorData, rankMetric]);

  // Evolução mensal por vendedor (top 5)
  const topVendors = useMemo(() => vendorData.slice(0, 5).map(v => v.name), [vendorData]);
  const vendorMonthlyData = useMemo(() => MS.map((label, i) => {
    const m    = i + 1;
    const mr   = yearRows.filter(r => getMo(r) === m);
    const entry: Record<string, unknown> & { label: string } = { label };
    for (const v of topVendors) {
      entry[v] = aggRows(mr.filter(r => (r.data['NOME_VENDEDOR']?.trim() || '(sem vendedor)') === v))[cmpMetric];
    }
    return entry;
  }), [yearRows, topVendors, cmpMetric]);

  // Prev key for monthly chart line
  const prevDataKey = `prev${cmpMetric.charAt(0).toUpperCase()}${cmpMetric.slice(1)}` as 'prevValVenda' | 'prevRecLiq' | 'prevLucroBruto';

  const metricLabel: Record<RankKey, string> = {
    valVenda: 'Receita Bruta', recLiq: 'Rec. Líquida', lucroBruto: 'Lucro Bruto',
  };
  const deltaLabel = month !== null ? 'vs mesmo mês ano ant.' : 'vs ano anterior';

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Carregando...</div>;
  }
  if (allRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-slate-300 gap-2 text-sm">
        Nenhum dado — importe um TXT em Registros → Itens de Peças
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-5 space-y-7">

        {/* ─── Filtros ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ANO</span>
          <div className="relative mr-2">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="appearance-none text-sm font-bold text-slate-700 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
            >
              {availYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <button
            onClick={() => setMonth(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${month === null ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Ano todo
          </button>
          {MS.map((name, idx) => {
            const m      = idx + 1;
            const count  = monthCounts[m] ?? 0;
            const active = month === m;
            const has    = count > 0;
            return (
              <button
                key={m}
                onClick={() => has ? setMonth(m) : undefined}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active ? 'bg-violet-600 text-white shadow-sm' : has ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300 cursor-default'
                }`}
              >
                {name}
                {has && (
                  <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full leading-none py-0.5 ${active ? 'bg-white text-violet-700' : 'bg-violet-100 text-violet-600'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ─── KPI Cards ─────────────────────────────────────────────────── */}
        <div>
          <SH>Resumo do período{month !== null ? ` — ${MS[month - 1]} ${year}` : ` — ${year}`}</SH>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard
              label="Transações" value={metrics.count.toLocaleString('pt-BR')}
              accent={VIOLET} deltaLabel={deltaLabel}
              delta={delta(metrics.count, prevMetrics.count)}
            />
            <KpiCard
              label="Qtde Total" value={fmtQtd(metrics.qtd)}
              accent={AMBER} deltaLabel={deltaLabel}
              delta={delta(metrics.qtd, prevMetrics.qtd)}
            />
            <KpiCard
              label="Receita Bruta" value={fmtBRL(metrics.valVenda)}
              color="text-violet-700" accent={VIOLET} deltaLabel={deltaLabel}
              delta={delta(metrics.valVenda, prevMetrics.valVenda)}
            />
            <KpiCard
              label="Rec. Líquida" value={fmtBRL(metrics.recLiq)}
              color="text-teal-700" accent={TEAL} deltaLabel={deltaLabel}
              delta={delta(metrics.recLiq, prevMetrics.recLiq)}
            />
            <KpiCard
              label="Lucro Bruto" value={fmtBRL(metrics.lucroBruto)}
              color={metrics.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}
              accent={EMERALD} deltaLabel={deltaLabel}
              delta={delta(metrics.lucroBruto, prevMetrics.lucroBruto)}
            />
            <KpiCard
              label="Margem (% LB)"
              value={fmtPct(metrics.lbPct)}
              color={metrics.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}
              accent={EMERALD}
              sub={prevMetrics.lbPct !== 0 ? `Ant.: ${fmtPct(prevMetrics.lbPct)}` : undefined}
              delta={prevMetrics.lbPct !== 0 ? metrics.lbPct - prevMetrics.lbPct : undefined}
              deltaLabel="pp vs ant."
            />
          </div>
        </div>

        {/* ─── Gráfico de Evolução (dinâmico) ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          {month !== null ? (
            <>
              <SH>Evolução Diária — {MS[month - 1]} {year}</SH>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyData} margin={{ top: 4, right: 50, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="brl" orientation="left" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={85} />
                    <Tooltip content={<TipBRL />} />
                    <Bar yAxisId="brl" dataKey="valVenda"   name="Receita Bruta"   fill={VIOLET}  radius={[3,3,0,0]} maxBarSize={20} />
                    <Bar yAxisId="brl" dataKey="recLiq"     name="Rec. Líquida" fill={TEAL}    radius={[3,3,0,0]} maxBarSize={20} />
                    <Bar yAxisId="brl" dataKey="lucroBruto" name="Lucro Bruto"  fill={EMERALD} radius={[3,3,0,0]} maxBarSize={20} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <>
              <SH right={
                <div className="flex items-center gap-2 flex-wrap">
                  <MetricToggle value={cmpMetric} onChange={setCmpMetric} />
                  <button
                    onClick={() => setShowPrevYear(v => !v)}
                    className={`text-[11px] px-3 py-1.5 rounded-lg border font-semibold transition-colors ${showPrevYear ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    vs {prevYear}
                  </button>
                </div>
              }>Evolução Mensal — {year}</SH>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyData} margin={{ top: 4, right: 50, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="brl" orientation="left" tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={85} />
                    <Tooltip content={<TipEvolucaoMensal year={year} />} />
                    <Bar yAxisId="brl" dataKey={cmpMetric} name={metricLabel[cmpMetric]} fill={VIOLET} radius={[4,4,0,0]} maxBarSize={32} />
                    {showPrevYear && (
                      <Line yAxisId="brl" dataKey={prevDataKey} name={`${metricLabel[cmpMetric]} ${prevYear}`}
                        stroke={VIOLETL} dot={{ r: 3, fill: VIOLETL }} strokeWidth={2} strokeDasharray="5 3" />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        {/* ─── Comparativo Mensal (12 meses) — sempre visível quando mês selecionado ── */}
        {month !== null && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <SH right={
              <div className="flex items-center gap-2">
                <MetricToggle value={cmpMetric} onChange={setCmpMetric} />
              </div>
            }>Comparativo Mensal — {year}</SH>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 4, right: 50, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={85} />
                  <Tooltip content={<TipComparativoMensal year={year} />} />
                  <Bar dataKey={cmpMetric} name={`${metricLabel[cmpMetric]} ${year}`} radius={[3,3,0,0]} maxBarSize={28}>
                    {monthlyData.map((_, idx) => (
                      <Cell key={`cur-${idx}`} fill={idx + 1 === month ? VIOLET : '#ddd8fe'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ─── Rankings ──────────────────────────────────────────────────── */}
        <div>
          <SH right={<MetricToggle value={rankMetric} onChange={setRankMetric} />}>
            Rankings — ordenado por {metricLabel[rankMetric]}
          </SH>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── Performance por Produto ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <SH>Performance por Produto</SH>

            {productData.length === 0 ? (
              <p className="text-slate-300 text-sm text-center py-8">Sem dados no período</p>
            ) : (
              <>
                <div className="flex gap-4 mb-4">
                  {/* Barras */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    {productData.slice(0, 8).map((p, i) => (
                      <div key={p.pub}>
                        <div className="flex items-start justify-between text-xs mb-0.5 gap-2">
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-violet-700 text-[11px]">{p.pub}</span>
                            {p.des && <span className="text-slate-400 text-[10px] ml-1">— {p.des}</span>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-mono text-slate-700 text-[11px]">{fmtBRL(p[rankMetric])}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.lbPct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {fmtPct(p.lbPct)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${(p[rankMetric] / productMax) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[9px] text-slate-400 font-mono">
                          <span>Qtde: {fmtQtd(p.qtd)}</span>
                          <span>Rec. Líq.: {fmtBRL(p.recLiq)}</span>
                          <span className={p.lucroBruto >= 0 ? 'text-emerald-600' : 'text-rose-600'}>Lucro: {fmtBRL(p.lucroBruto)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Pizza */}
                  {productPieData.length > 1 && (
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <PieChart width={140} height={140}>
                        <Pie data={productPieData} cx={70} cy={70} innerRadius={34} outerRadius={62} paddingAngle={2} dataKey="value">
                          {productPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtBRL(v)} />
                      </PieChart>
                      <div className="space-y-0.5 mt-1">
                        {productPieData.slice(0, 5).map((e, i) => (
                          <div key={i} className="flex items-center gap-1 text-[9px] text-slate-500">
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: e.color }} />
                            <span className="font-mono font-bold" style={{ color: e.color }}>{e.name}</span>
                            <span>{fmtPct(e.pct)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tabela produtos */}
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-violet-700 text-white">
                        {['Código', 'Descrição', 'Qtde', 'Receita Bruta', 'Rec. Líq.', 'Lucro Bruto', '% Margem'].map(h => (
                          <th key={h} className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {productData.map((p, i) => (
                        <tr key={p.pub} className={i % 2 === 0 ? 'bg-white' : 'bg-violet-50/40'}>
                          <td className="px-2.5 py-1.5 font-mono font-bold text-violet-700 text-[11px]">{p.pub}</td>
                          <td className="px-2.5 py-1.5 text-slate-500 text-[10px] max-w-[160px] truncate">{p.des || '—'}</td>
                          <td className="px-2.5 py-1.5 font-mono text-right text-slate-700 text-[11px]">{fmtQtd(p.qtd)}</td>
                          <td className="px-2.5 py-1.5 font-mono text-right text-violet-700 text-[11px]">{fmtBRL(p.valVenda)}</td>
                          <td className="px-2.5 py-1.5 font-mono text-right text-teal-700 text-[11px]">{fmtBRL(p.recLiq)}</td>
                          <td className={`px-2.5 py-1.5 font-mono text-right font-semibold text-[11px] ${p.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtBRL(p.lucroBruto)}</td>
                          <td className={`px-2.5 py-1.5 font-mono text-right font-semibold text-[11px] ${p.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtPct(p.lbPct)}</td>
                        </tr>
                      ))}
                      <tr className="bg-violet-100 font-bold border-t-2 border-violet-300">
                        <td colSpan={2} className="px-2.5 py-1.5 text-violet-800 text-[10px] uppercase tracking-wide">Total</td>
                        <td className="px-2.5 py-1.5 font-mono text-right text-slate-700">{fmtQtd(metrics.qtd)}</td>
                        <td className="px-2.5 py-1.5 font-mono text-right text-violet-800">{fmtBRL(metrics.valVenda)}</td>
                        <td className="px-2.5 py-1.5 font-mono text-right text-teal-800">{fmtBRL(metrics.recLiq)}</td>
                        <td className={`px-2.5 py-1.5 font-mono text-right ${metrics.lucroBruto >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>{fmtBRL(metrics.lucroBruto)}</td>
                        <td className={`px-2.5 py-1.5 font-mono text-right ${metrics.lbPct >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>{fmtPct(metrics.lbPct)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* ── Performance por Vendedor ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <SH>Performance por Vendedor</SH>

            {vendorData.length === 0 ? (
              <p className="text-slate-300 text-sm text-center py-8">Sem dados no período</p>
            ) : (
              <>
                <div className="flex gap-4 mb-4">
                  {/* Barras */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    {vendorData.slice(0, 8).map((v, i) => (
                      <div key={v.name}>
                        <div className="flex items-center justify-between text-xs mb-0.5 gap-2">
                          <span className="font-medium text-slate-700 text-[11px] truncate">{v.name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-mono text-slate-700 text-[11px]">{fmtBRL(v[rankMetric])}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${v.lbPct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {fmtPct(v.lbPct)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${(v[rankMetric] / vendorMax) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[9px] text-slate-400 font-mono">
                          <span>Qtde: {fmtQtd(v.qtd)}</span>
                          <span>Rec. Líq.: {fmtBRL(v.recLiq)}</span>
                          <span className={v.lucroBruto >= 0 ? 'text-emerald-600' : 'text-rose-600'}>Lucro: {fmtBRL(v.lucroBruto)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Pizza */}
                  {vendorPieData.length > 1 && (
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <PieChart width={140} height={140}>
                        <Pie data={vendorPieData} cx={70} cy={70} innerRadius={34} outerRadius={62} paddingAngle={2} dataKey="value">
                          {vendorPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtBRL(v)} />
                      </PieChart>
                      <div className="space-y-0.5 mt-1">
                        {vendorPieData.slice(0, 5).map((e, i) => (
                          <div key={i} className="flex items-center gap-1 text-[9px] text-slate-500">
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: e.color }} />
                            <span className="truncate max-w-[80px]" style={{ color: e.color }}>{e.name}</span>
                            <span>{fmtPct(e.pct)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Gráfico barras mensais por vendedor (top 5 empilhado) */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Evolução por Vendedor — top 5</span>
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                      {(['valVenda','recLiq','lucroBruto'] as const).map(k => (
                        <button key={k} onClick={() => setCmpMetric(k)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${cmpMetric === k ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>
                          {k === 'valVenda' ? 'Venda' : k === 'recLiq' ? 'Rec.' : 'Lucro'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={vendorMonthlyData} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={75} />
                        <Tooltip content={<TipVendors />} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                        {topVendors.map((v, i) => (
                          <Bar key={v} dataKey={v} stackId="a" fill={PALETTE[i % PALETTE.length]} maxBarSize={28} name={v} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Tabela vendedores */}
                <div className="overflow-x-auto rounded-xl border border-slate-100 mt-4">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-violet-700 text-white">
                        {['#', 'Vendedor', 'Qtde', 'Receita Bruta', 'Rec. Líq.', 'Lucro Bruto', '% Margem'].map(h => (
                          <th key={h} className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vendorData.map((v, i) => (
                        <tr key={v.name} className={i % 2 === 0 ? 'bg-white' : 'bg-violet-50/40'}>
                          <td className="px-2.5 py-1.5 text-slate-400 text-center font-mono text-[10px]">{i + 1}</td>
                          <td className="px-2.5 py-1.5 text-slate-700 font-medium text-[11px]">{v.name}</td>
                          <td className="px-2.5 py-1.5 font-mono text-right text-slate-700 text-[11px]">{fmtQtd(v.qtd)}</td>
                          <td className="px-2.5 py-1.5 font-mono text-right text-violet-700 text-[11px]">{fmtBRL(v.valVenda)}</td>
                          <td className="px-2.5 py-1.5 font-mono text-right text-teal-700 text-[11px]">{fmtBRL(v.recLiq)}</td>
                          <td className={`px-2.5 py-1.5 font-mono text-right font-semibold text-[11px] ${v.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtBRL(v.lucroBruto)}</td>
                          <td className={`px-2.5 py-1.5 font-mono text-right font-semibold text-[11px] ${v.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtPct(v.lbPct)}</td>
                        </tr>
                      ))}
                      <tr className="bg-violet-100 font-bold border-t-2 border-violet-300">
                        <td colSpan={2} className="px-2.5 py-1.5 text-violet-800 text-[10px] uppercase tracking-wide">Total</td>
                        <td className="px-2.5 py-1.5 font-mono text-right text-slate-700">{fmtQtd(metrics.qtd)}</td>
                        <td className="px-2.5 py-1.5 font-mono text-right text-violet-800">{fmtBRL(metrics.valVenda)}</td>
                        <td className="px-2.5 py-1.5 font-mono text-right text-teal-800">{fmtBRL(metrics.recLiq)}</td>
                        <td className={`px-2.5 py-1.5 font-mono text-right ${metrics.lucroBruto >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>{fmtBRL(metrics.lucroBruto)}</td>
                        <td className={`px-2.5 py-1.5 font-mono text-right ${metrics.lbPct >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>{fmtPct(metrics.lbPct)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
