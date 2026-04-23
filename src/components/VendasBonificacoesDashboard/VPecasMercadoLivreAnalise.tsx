import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { kvGet } from '@/lib/kvClient';
import { loadVPecasMLRows, loadVPecasMLDevolucaoRows } from './vPecasMercadoLivreStorage';
import type { VPecasMLRow } from './vPecasMercadoLivreStorage';
import { loadTaxaMLRows } from './taxaMercadoLivreStorage';

// ─── Paleta laranja ───────────────────────────────────────────────────────────
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const PALETTE = [
  '#f97316','#0ea5e9','#10b981','#ef4444','#7c3aed','#f59e0b',
  '#e879f9','#84cc16','#06b6d4','#fb7185','#a78bfa','#fbbf24',
];
const ORANGE   = '#f97316';
const ORANGE_D = '#c2410c';
const EMERALD  = '#10b981';
const AMBER    = '#f59e0b';
const ROSE     = '#f43f5e';

// ─── Overrides ────────────────────────────────────────────────────────────────
const OV_KEY = 'vendas_pecas_ml_vendas_ov';
interface PecasOverride { condPgto: string; taxaML: string; taxaEPecas: string; comissao: string; dsr: string; provisoes: string; }
function emptyOv(): PecasOverride { return { condPgto: '', taxaML: '', taxaEPecas: '', comissao: '', dsr: '', provisoes: '' }; }
async function loadOverrides(): Promise<Record<string, PecasOverride>> {
  try {
    const data = await kvGet(OV_KEY);
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, PecasOverride>;
    return {};
  } catch { return {}; }
}
function ovKey(d: Record<string, string>): string {
  return `${d['NUMERO_NOTA_FISCAL'] ?? ''}_${d['SERIE_NOTA_FISCAL'] ?? ''}_${d['DTA_DOCUMENTO'] ?? ''}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = (v?: string | null) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRLF = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct  = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

function getYr(row: VPecasMLRow): number {
  if (row.periodoImport) { const [y] = row.periodoImport.split('-').map(Number); if (y > 2000) return y; }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[0];
  return 0;
}
function getMo(row: VPecasMLRow): number {
  if (row.periodoImport) { const [,m] = row.periodoImport.split('-').map(Number); if (m >= 1 && m <= 12) return m; }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[1];
  return 0;
}

// ─── Cálculo por linha ────────────────────────────────────────────────────────
interface Calc {
  valorVenda: number; icms: number; pis: number; cofins: number; difal: number;
  taxaML: number; taxaEPecas: number; totalImpostos: number;
  recLiq: number; custo: number; lucroBruto: number; lucroBrutoPct: number;
  comissao: number; dsr: number; provisoes: number; resultado: number;
}
function calcRow(
  d: Record<string, string>,
  ov: PecasOverride,
  autoTaxaML: number,
): Calc {
  const valorVenda    = n(d['LIQ_NOTA_FISCAL']);
  const icms          = n(d['VAL_ICMS']);
  const pis           = n(d['VAL_PIS']);
  const cofins        = n(d['VAL_COFINS']);
  const difal         = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
  const taxaML        = autoTaxaML;
  const taxaEPecas    = n(ov.taxaEPecas);
  const totalImpostos = icms + pis + cofins + difal;
  const recLiq        = valorVenda - totalImpostos;
  const custo         = n(d['TOT_CUSTO_MEDIO']);
  const lucroBruto    = recLiq - taxaML - taxaEPecas - custo;
  const lucroBrutoPct = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
  const comissao      = n(ov.comissao);
  const dsr           = n(ov.dsr);
  const provisoes     = n(ov.provisoes);
  const resultado     = lucroBruto - comissao - dsr - provisoes;
  return { valorVenda, icms, pis, cofins, difal, taxaML, taxaEPecas, totalImpostos, recLiq, custo, lucroBruto, lucroBrutoPct, comissao, dsr, provisoes, resultado };
}

interface Agg {
  nfs: number; valorVenda: number; icms: number; pis: number; cofins: number;
  difal: number; taxaML: number; taxaEPecas: number; totalImpostos: number;
  recLiq: number; custo: number; lucroBruto: number; lbPct: number;
  comissao: number; dsr: number; provisoes: number; resultado: number;
}
function aggRows(rows: VPecasMLRow[], overrides: Record<string, PecasOverride>, taxaMLLookup: Map<string, number>): Agg {
  let nfs = 0, valorVenda = 0, icms = 0, pis = 0, cofins = 0, difal = 0,
      taxaML = 0, taxaEPecas = 0, totalImpostos = 0, recLiq = 0, custo = 0, lucroBruto = 0,
      comissao = 0, dsr = 0, provisoes = 0, resultado = 0;
  for (const r of rows) {
    const ov     = overrides[ovKey(r.data)] ?? emptyOv();
    const epSum  = taxaMLLookup.get(r.data['NUMERO_NOTA_FISCAL']) ?? 0;
    const autoML = epSum > 0 ? n(r.data['LIQ_NOTA_FISCAL']) - epSum : 0;
    const c = calcRow(r.data, ov, autoML);
    nfs++; valorVenda += c.valorVenda; icms += c.icms; pis += c.pis; cofins += c.cofins;
    difal += c.difal; taxaML += c.taxaML; taxaEPecas += c.taxaEPecas;
    totalImpostos += c.totalImpostos; recLiq += c.recLiq; custo += c.custo;
    lucroBruto += c.lucroBruto; comissao += c.comissao; dsr += c.dsr;
    provisoes += c.provisoes; resultado += c.resultado;
  }
  return { nfs, valorVenda, icms, pis, cofins, difal, taxaML, taxaEPecas, totalImpostos, recLiq, custo, lucroBruto,
    lbPct: recLiq !== 0 ? lucroBruto / recLiq * 100 : 0, comissao, dsr, provisoes, resultado };
}

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
  const recEntry   = payload.find(p => p.name.startsWith('Rec. Líq'));
  const lucroEntry = payload.find(p => p.name.startsWith('Lucro'));
  const margem = recEntry && lucroEntry && recEntry.value !== 0 ? (lucroEntry.value / recEntry.value) * 100 : null;
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

function TipTaxaML({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { valorVenda: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const rv  = payload[0].payload.valorVenda;
  const pct = rv > 0 ? (val / rv) * 100 : null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      <div className="flex justify-between gap-4">
        <span style={{ color: '#ef4444' }} className="font-medium">Taxa ML</span>
        <span className="font-mono text-slate-700">{fmtBRLF(val)}</span>
      </div>
      {pct !== null && (
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
          <span className="text-slate-500 font-medium">% sobre Rec. Bruta</span>
          <span className="font-mono font-bold text-red-600">{fmtPct(pct)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VPecasMercadoLivreAnalise() {
  const curYear = new Date().getFullYear();
  const [allRows, setAllRows]   = useState<VPecasMLRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, PecasOverride>>({});
  const [allTaxaRows, setAllTaxaRows] = useState<{ data: Record<string, string>; periodoImport?: string }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [year, setYear]         = useState(curYear);
  const [prevYear, setPrevYear] = useState(curYear - 1);
  const [month, setMonth]       = useState<number | null>(new Date().getMonth() + 1);

  const [rankMetric, setRankMetric] = useState<'valorVenda' | 'recLiq' | 'lucroBruto' | 'nfs'>('valorVenda');
  const [rankExpanded, setRankExpanded] = useState(false);
  const [cmpMetric, setCmpMetric] = useState<'valorVenda' | 'recLiq' | 'lucroBruto'>('valorVenda');
  const [showPrevYear, setShowPrevYear] = useState(false);
  const [prejExpanded, setPrejExpanded] = useState(false);
  const [lucroExpanded, setLucroExpanded] = useState(false);

  useEffect(() => {
    Promise.all([loadVPecasMLRows(), loadVPecasMLDevolucaoRows(), loadOverrides(), loadTaxaMLRows()]).then(([rows, devol, ov, taxaRows]) => {
      const all = [...rows, ...devol].filter(r => r.data['SERIE_NOTA_FISCAL'] !== 'RPS');
      setAllRows(all);
      setOverrides(ov);
      setAllTaxaRows(taxaRows as { data: Record<string, string>; periodoImport?: string }[]);
      if (all.length > 0) {
        const yr = Math.max(...all.map(getYr).filter(y => y > 2000));
        const mo = Math.max(...all.filter(r => getYr(r) === yr).map(getMo).filter(m => m >= 1 && m <= 12));
        setYear(yr); setPrevYear(yr - 1); setMonth(mo);
      }
      setLoading(false);
    });
  }, []);

  const availYears = useMemo(() => {
    const s = new Set(allRows.map(getYr).filter(y => y > 2000));
    [curYear - 1, curYear].forEach(y => s.add(y));
    return [...s].sort();
  }, [allRows, curYear]);

  // ─── Taxa ML lookup: TITULO → soma VAL_TITULO (no período filtrado) ──────
  const taxaMLLookup = useMemo(() => {
    const periodo = month !== null ? `${year}-${String(month).padStart(2, '0')}` : null;
    const filtered = periodo
      ? allTaxaRows.filter(r => r.periodoImport === periodo)
      : allTaxaRows.filter(r => {
          const p = r.periodoImport?.split('-').map(Number);
          return p && p[0] === year;
        });
    const map = new Map<string, number>();
    filtered.forEach(r => {
      const titulo = r.data['TITULO'];
      if (titulo) map.set(titulo, (map.get(titulo) ?? 0) + n(r.data['VAL_TITULO']));
    });
    return map;
  }, [allTaxaRows, year, month]);

  const yearRows      = useMemo(() => allRows.filter(r => getYr(r) === year),     [allRows, year]);
  const prevYearRows  = useMemo(() => allRows.filter(r => getYr(r) === prevYear), [allRows, prevYear]);
  const filteredRows  = useMemo(() => yearRows.filter(r => month === null || getMo(r) === month), [yearRows, month]);
  const prevMonthRows = useMemo(() => {
    if (month === null) return [];
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    return allRows.filter(r => getYr(r) === py && getMo(r) === pm);
  }, [allRows, month, year]);

  // lookup para ano todo (usada nos gráficos de evolução mensal)
  const taxaMLLookupYear = useMemo(() => {
    const filtered = allTaxaRows.filter(r => {
      const p = r.periodoImport?.split('-').map(Number);
      return p && p[0] === year;
    });
    const map = new Map<string, number>();
    filtered.forEach(r => {
      const titulo = r.data['TITULO'];
      if (titulo) map.set(titulo, (map.get(titulo) ?? 0) + n(r.data['VAL_TITULO']));
    });
    return map;
  }, [allTaxaRows, year]);

  const taxaMLLookupPrevYear = useMemo(() => {
    const filtered = allTaxaRows.filter(r => {
      const p = r.periodoImport?.split('-').map(Number);
      return p && p[0] === prevYear;
    });
    const map = new Map<string, number>();
    filtered.forEach(r => {
      const titulo = r.data['TITULO'];
      if (titulo) map.set(titulo, (map.get(titulo) ?? 0) + n(r.data['VAL_TITULO']));
    });
    return map;
  }, [allTaxaRows, prevYear]);

  const metrics      = useMemo(() => aggRows(filteredRows, overrides, taxaMLLookup),    [filteredRows, overrides, taxaMLLookup]);
  const prevMetrics  = useMemo(() => aggRows(prevMonthRows, overrides, taxaMLLookup),   [prevMonthRows, overrides, taxaMLLookup]);
  const delta = (cur: number, prev: number) => prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : undefined;

  // ─── 1. Evolução Mensal ────────────────────────────────────────────────────
  const monthlyData = useMemo(() => MS.map((label, i) => {
    const m  = i + 1;
    const mr = yearRows.filter(r => getMo(r) === m);
    const pr = prevYearRows.filter(r => getMo(r) === m);
    const lookupM = new Map<string, number>();
    allTaxaRows.filter(r => r.periodoImport === `${year}-${String(m).padStart(2, '0')}`).forEach(r => {
      const t = r.data['TITULO']; if (t) lookupM.set(t, (lookupM.get(t) ?? 0) + n(r.data['VAL_TITULO']));
    });
    const lookupPM = new Map<string, number>();
    allTaxaRows.filter(r => r.periodoImport === `${prevYear}-${String(m).padStart(2, '0')}`).forEach(r => {
      const t = r.data['TITULO']; if (t) lookupPM.set(t, (lookupPM.get(t) ?? 0) + n(r.data['VAL_TITULO']));
    });
    const a  = aggRows(mr, overrides, lookupM);
    const ap = aggRows(pr, overrides, lookupPM);
    return {
      label,
      nfs: a.nfs, valorVenda: a.valorVenda, taxaML: a.taxaML, recLiq: a.recLiq, lucroBruto: a.lucroBruto, lbPct: a.lbPct,
      prevValorVenda: ap.valorVenda, prevRecLiq: ap.recLiq, prevLucroBruto: ap.lucroBruto,
    };
  }), [yearRows, prevYearRows, overrides, allTaxaRows, year, prevYear]);

  // ─── 2. Ranking por Vendedor ──────────────────────────────────────────────
  const vendorData = useMemo(() => {
    const map = new Map<string, VPecasMLRow[]>();
    for (const r of filteredRows) {
      const k = r.data['NOME_VENDEDOR']?.trim() || '(sem vendedor)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rows]) => {
      const a = aggRows(rows, overrides, taxaMLLookup);
      return { name, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, lucroBruto: a.lucroBruto, lbPct: a.lbPct, taxaML: a.taxaML };
    }).sort((a, b) => b[rankMetric] - a[rankMetric]);
  }, [filteredRows, overrides, taxaMLLookup, rankMetric]);

  const vendorMax = useMemo(() => Math.max(...vendorData.map(s => s[rankMetric]), 1), [vendorData, rankMetric]);

  // ─── 3. Comparativo mensal por vendedor ──────────────────────────────────
  const cmpData = useMemo(() => {
    const topVendors = vendorData.slice(0, 6).map(v => v.name);
    return MS.map((label, i) => {
      const m  = i + 1;
      const mr = yearRows.filter(r => getMo(r) === m);
      const lookupM = new Map<string, number>();
      allTaxaRows.filter(r => r.periodoImport === `${year}-${String(m).padStart(2, '0')}`).forEach(r => {
        const t = r.data['TITULO']; if (t) lookupM.set(t, (lookupM.get(t) ?? 0) + n(r.data['VAL_TITULO']));
      });
      const entry: Record<string, number> & { label: string } = { label };
      for (const v of topVendors) {
        const vRows = mr.filter(r => (r.data['NOME_VENDEDOR']?.trim() || '(sem vendedor)') === v);
        entry[v] = aggRows(vRows, overrides, lookupM)[cmpMetric];
      }
      return entry;
    });
  }, [yearRows, vendorData, overrides, allTaxaRows, year, cmpMetric]);

  const topVendorsForCmp = useMemo(() => vendorData.slice(0, 6).map(v => v.name), [vendorData]);

  // ─── 4. Pizza ────────────────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const validData = vendorData.filter(d => d[rankMetric] > 0);
    const total = validData.reduce((s, d) => s + d[rankMetric], 0);
    return validData.slice(0, 8).map((d, i) => ({
      name: d.name, value: d[rankMetric],
      pct: total ? (d[rankMetric] / total) * 100 : 0,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [vendorData, rankMetric]);

  // ─── 5. NFs com prejuízo ────────────────────────────────────────────────
  const prejData = useMemo(() => filteredRows.map(r => {
    const ov    = overrides[ovKey(r.data)] ?? emptyOv();
    const epSum = taxaMLLookup.get(r.data['NUMERO_NOTA_FISCAL']) ?? 0;
    const autoML = epSum > 0 ? n(r.data['LIQ_NOTA_FISCAL']) - epSum : 0;
    const c = calcRow(r.data, ov, autoML);
    return {
      nf:         r.data['NUMERO_NOTA_FISCAL']?.trim() || '—',
      serie:      r.data['SERIE_NOTA_FISCAL']?.trim() || '',
      vendedor:   r.data['NOME_VENDEDOR']?.trim() || '—',
      cliente:    r.data['NOME_CLIENTE']?.trim() || '—',
      valorVenda: c.valorVenda,
      taxaML:     c.taxaML,
      recLiq:     c.recLiq,
      lucroBruto: c.lucroBruto,
      lbPct:      c.lucroBrutoPct,
    };
  }).filter(r => r.lucroBruto < 0).sort((a, b) => a.lucroBruto - b.lucroBruto),
  [filteredRows, overrides, taxaMLLookup]);

  // ─── 6. NFs com lucro ────────────────────────────────────────────────────
  const lucroData = useMemo(() => filteredRows.map(r => {
    const ov    = overrides[ovKey(r.data)] ?? emptyOv();
    const epSum = taxaMLLookup.get(r.data['NUMERO_NOTA_FISCAL']) ?? 0;
    const autoML = epSum > 0 ? n(r.data['LIQ_NOTA_FISCAL']) - epSum : 0;
    const c = calcRow(r.data, ov, autoML);
    return {
      nf:         r.data['NUMERO_NOTA_FISCAL']?.trim() || '—',
      serie:      r.data['SERIE_NOTA_FISCAL']?.trim() || '',
      vendedor:   r.data['NOME_VENDEDOR']?.trim() || '—',
      cliente:    r.data['NOME_CLIENTE']?.trim() || '—',
      valorVenda: c.valorVenda,
      taxaML:     c.taxaML,
      recLiq:     c.recLiq,
      lucroBruto: c.lucroBruto,
      lbPct:      c.lucroBrutoPct,
    };
  }).filter(r => r.lucroBruto > 0).sort((a, b) => b.lucroBruto - a.lucroBruto),
  [filteredRows, overrides, taxaMLLookup]);

  // ─── 7. Análise de Risco por Vendedor ────────────────────────────────────
  const riskData = useMemo(() => {
    const map = new Map<string, VPecasMLRow[]>();
    for (const r of filteredRows) {
      const k = r.data['NOME_VENDEDOR']?.trim() || '(sem vendedor)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rows]) => {
      const calcs = rows.map(r => {
        const ov = overrides[ovKey(r.data)] ?? emptyOv();
        const epSum = taxaMLLookup.get(r.data['NUMERO_NOTA_FISCAL']) ?? 0;
        const autoML = epSum > 0 ? n(r.data['LIQ_NOTA_FISCAL']) - epSum : 0;
        return calcRow(r.data, ov, autoML);
      });
      const total    = calcs.length;
      const withPrej = calcs.filter(c => c.lucroBruto < 0);
      const pct      = (arr: typeof calcs) => total > 0 ? arr.length / total * 100 : 0;
      const sumPrej  = withPrej.reduce((s, c) => s + c.lucroBruto, 0);
      const gt = (thr: number) => withPrej.filter(c => c.recLiq !== 0 && Math.abs(c.lucroBruto / c.recLiq * 100) > thr);
      return {
        name, total,
        withPrej: withPrej.length,
        pctPrej: pct(withPrej),
        gt5:  gt(5).length,  pctGt5:  pct(gt(5)),
        gt10: gt(10).length, pctGt10: pct(gt(10)),
        gt15: gt(15).length, pctGt15: pct(gt(15)),
        gt20: gt(20).length, pctGt20: pct(gt(20)),
        gt25: gt(25).length, pctGt25: pct(gt(25)),
        sumPrej,
      };
    }).sort((a, b) => b.pctPrej - a.pctPrej);
  }, [filteredRows, overrides, taxaMLLookup]);

  const globalRisk = useMemo(() => {
    const allCalcs = filteredRows.map(r => {
      const ov = overrides[ovKey(r.data)] ?? emptyOv();
      const epSum = taxaMLLookup.get(r.data['NUMERO_NOTA_FISCAL']) ?? 0;
      const autoML = epSum > 0 ? n(r.data['LIQ_NOTA_FISCAL']) - epSum : 0;
      return calcRow(r.data, ov, autoML);
    });
    const total    = allCalcs.length;
    const withPrej = allCalcs.filter(c => c.lucroBruto < 0);
    const sumPrej  = withPrej.reduce((s, c) => s + c.lucroBruto, 0);
    const gt = (thr: number) => withPrej.filter(c => c.recLiq !== 0 && Math.abs(c.lucroBruto / c.recLiq * 100) > thr);
    const pct = (count: number) => total > 0 ? count / total * 100 : 0;
    return {
      total, withPrej: withPrej.length, pctPrej: pct(withPrej.length), sumPrej,
      gt5:  gt(5).length,  pctGt5:  pct(gt(5).length),
      gt10: gt(10).length, pctGt10: pct(gt(10).length),
      gt15: gt(15).length, pctGt15: pct(gt(15).length),
      gt20: gt(20).length, pctGt20: pct(gt(20).length),
      gt25: gt(25).length, pctGt25: pct(gt(25).length),
    };
  }, [filteredRows, overrides, taxaMLLookup]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-300"><span className="text-sm animate-pulse">Carregando análises...</span></div>;
  }

  if (allRows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
        <TrendingUp className="w-12 h-12" />
        <span className="text-sm">Nenhum dado — importe dados via Registros → Peças E-Peças</span>
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
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            {availYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setMonth(null)} className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${month === null ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            Ano todo
          </button>
          {MS.map((m, i) => (
            <button key={m} onClick={() => setMonth(i + 1)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${month === i + 1 ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {m}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-slate-400">{filteredRows.length} NF{filteredRows.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard label="Total de NFs"    value={metrics.nfs.toLocaleString('pt-BR')} accent={ORANGE}
          delta={month !== null ? delta(metrics.nfs, prevMetrics.nfs) : undefined} />
        <KpiCard label="Receita Bruta"   value={fmtBRL(metrics.valorVenda)} color="text-orange-700" accent={ORANGE}
          delta={month !== null ? delta(metrics.valorVenda, prevMetrics.valorVenda) : undefined} />
        <KpiCard label="Taxa Mercado Livre" value={fmtBRL(metrics.taxaML)} color="text-orange-600" accent={ORANGE_D}
          sub={metrics.valorVenda ? fmtPct(metrics.taxaML / metrics.valorVenda * 100) + ' da receita' : undefined}
          delta={month !== null ? delta(metrics.taxaML, prevMetrics.taxaML) : undefined} />
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
              <input type="checkbox" checked={showPrevYear} onChange={e => { setShowPrevYear(e.target.checked); if (e.target.checked) setPrevYear(year - 1); }} className="accent-orange-500 w-3.5 h-3.5" />
              Comparar com
              <select value={prevYear} onChange={e => setPrevYear(+e.target.value)} onClick={e => e.stopPropagation()} className="border border-slate-200 rounded px-1.5 py-0.5 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-orange-300">
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
            <Bar dataKey="valorVenda" name="Rec. Bruta" fill={ORANGE} fillOpacity={0.35} radius={[2, 2, 0, 0]} />
            <Bar dataKey="taxaML"     name="Taxa ML"    fill="#ef4444" fillOpacity={0.9} radius={[2, 2, 0, 0]} />
            <Bar dataKey="recLiq"     name="Rec. Líq."  fill={EMERALD} fillOpacity={0.85} radius={[2, 2, 0, 0]} />
            <Bar dataKey="lucroBruto" name="Lucro Bruto" fill="#a78bfa" fillOpacity={0.85} radius={[2, 2, 0, 0]} />
            {showPrevYear && <Bar dataKey="prevRecLiq" name={`Rec. Líq. ${prevYear}`} fill={EMERALD} fillOpacity={0.3} radius={[2, 2, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Taxa ML por Mês ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SH>Taxa Mercado Livre por Mês — {year}</SH>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtBRL(v).replace('R$\u00a0', 'R$')} width={80} />
            <Tooltip content={<TipTaxaML />} />
            <Bar dataKey="taxaML" name="Taxa ML" fill="#ef4444" fillOpacity={0.9} radius={[3, 3, 0, 0]}>
              {monthlyData.map((_, i) => <Cell key={i} fill="#ef4444" fillOpacity={month === null || month === i + 1 ? 0.9 : 0.35} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Ranking por Vendedor ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SH right={
            <div className="flex gap-1">
              {(['valorVenda', 'recLiq', 'lucroBruto', 'nfs'] as const).map(m => (
                <button key={m} onClick={() => setRankMetric(m)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all ${rankMetric === m ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'}`}
                >
                  {rankLabel[m]}
                </button>
              ))}
            </div>
          }>Ranking por Vendedor — {rankLabel[rankMetric]}</SH>
          <div className="space-y-2">
            <div className="grid grid-cols-[1.5fr_0.5fr_1fr_1fr_1fr_1fr_0.8fr] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
              <span>Vendedor</span>
              <span className="text-right">NFs</span>
              <span className="text-right">Rec. Bruta</span>
              <span className="text-right">Taxa ML</span>
              <span className="text-right">Rec. Líq.</span>
              <span className="text-right">Lucro Bruto</span>
              <span className="text-right">% Margem</span>
            </div>
            {(rankExpanded ? vendorData : vendorData.slice(0, 8)).map((v, i) => (
              <div key={v.name} className="grid grid-cols-[1.5fr_0.5fr_1fr_1fr_1fr_1fr_0.8fr] gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-slate-300 w-4 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700 truncate">{v.name}</div>
                    <div className="h-1 bg-slate-100 rounded-full mt-0.5">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(100, (v[rankMetric] / vendorMax) * 100)}%` }} />
                    </div>
                  </div>
                </div>
                <span className="text-right text-xs font-mono text-slate-600">{v.nfs}</span>
                <span className="text-right text-xs font-mono text-slate-600">{fmtBRL(v.valorVenda)}</span>
                <span className="text-right text-xs font-mono text-orange-700 font-semibold">{fmtBRL(v.taxaML)}</span>
                <span className="text-right text-xs font-mono text-emerald-700">{fmtBRL(v.recLiq)}</span>
                <span className={`text-right text-xs font-mono font-semibold ${v.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtBRL(v.lucroBruto)}</span>
                <span className={`text-right text-xs font-mono font-semibold ${v.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtPct(v.lbPct)}</span>
              </div>
            ))}
            {vendorData.length > 8 && (
              <button onClick={() => setRankExpanded(e => !e)} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-orange-500 transition-colors mt-1 px-2">
                {rankExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {rankExpanded ? 'Mostrar menos' : `Mostrar mais (${vendorData.length - 8} vendedores)`}
              </button>
            )}
          </div>
        </div>

        {/* Pizza */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SH>Distribuição — {rankLabel[rankMetric]}</SH>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtBRL(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="truncate text-slate-600 flex-1">{d.name}</span>
                <span className="font-mono font-bold text-slate-700">{fmtPct(d.pct)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Comparativo Mensal por Vendedor ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SH right={
          <div className="flex gap-1">
            {(['valorVenda', 'recLiq', 'lucroBruto'] as const).map(m => (
              <button key={m} onClick={() => setCmpMetric(m)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all ${cmpMetric === m ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'}`}
              >{cmpLabel[m]}</button>
            ))}
          </div>
        }>Comparativo Mensal — Top {topVendorsForCmp.length} Vendedores</SH>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={cmpData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={1} barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtBRL(v).replace('R$\u00a0', 'R$')} width={80} />
            <Tooltip content={<TipBRL />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {topVendorsForCmp.map((v, i) => (
              <Bar key={v} dataKey={v} name={v} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Análise de Risco por Vendedor ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        <SH>Análise de Risco — NFs com Prejuízo por Vendedor</SH>

        {/* KPI cards globais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {([
            { label: 'Total NFs',    value: globalRisk.total.toLocaleString('pt-BR'),      sub: '100% das NFs',                              color: 'text-slate-700', accent: '#94a3b8' },
            { label: 'c/ Prejuízo', value: globalRisk.withPrej.toLocaleString('pt-BR'),   sub: fmtPct(globalRisk.pctPrej) + ' das NFs',     color: 'text-rose-700',  accent: '#f43f5e' },
            { label: 'Soma Prejuízo',value: fmtBRL(globalRisk.sumPrej),                    sub: '',                                           color: 'text-rose-700',  accent: '#f43f5e' },
            { label: 'Margem < −5%', value: globalRisk.gt5.toLocaleString('pt-BR'),       sub: fmtPct(globalRisk.pctGt5) + ' das NFs',      color: 'text-orange-600',accent: '#f97316' },
            { label: 'Margem < −10%',value: globalRisk.gt10.toLocaleString('pt-BR'),      sub: fmtPct(globalRisk.pctGt10) + ' das NFs',     color: 'text-orange-700',accent: '#ea580c' },
            { label: 'Margem < −15%',value: globalRisk.gt15.toLocaleString('pt-BR'),      sub: fmtPct(globalRisk.pctGt15) + ' das NFs',     color: 'text-red-600',   accent: '#dc2626' },
            { label: 'Margem < −20%',value: globalRisk.gt20.toLocaleString('pt-BR'),      sub: fmtPct(globalRisk.pctGt20) + ' das NFs',     color: 'text-red-700',   accent: '#b91c1c' },
            { label: 'Margem < −25%',value: globalRisk.gt25.toLocaleString('pt-BR'),      sub: fmtPct(globalRisk.pctGt25) + ' das NFs',     color: 'text-red-800',   accent: '#991b1b' },
          ] as const).map(card => (
            <div key={card.label} className="rounded-lg border border-slate-100 px-3 py-2.5 flex flex-col gap-0.5" style={{ borderLeft: `3px solid ${card.accent}` }}>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-tight">{card.label}</span>
              <span className={`text-sm font-bold leading-tight ${card.color}`}>{card.value}</span>
              {card.sub && <span className="text-[10px] text-slate-400">{card.sub}</span>}
            </div>
          ))}
        </div>

        {/* Tabela por vendedor */}
        {riskData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Vendedor','Total NFs','c/ Prej.','% Prej.','<−5%','<−10%','<−15%','<−20%','<−25%','Soma Prejuízo'].map(h => (
                    <th key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide py-1.5 px-2 text-right first:text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riskData.map((s, i) => {
                  const heat = (pct: number) => {
                    if (pct === 0) return '';
                    if (pct < 10)  return 'bg-yellow-50 text-yellow-700';
                    if (pct < 20)  return 'bg-orange-50 text-orange-700';
                    if (pct < 35)  return 'bg-red-50 text-red-700';
                    return 'bg-red-100 text-red-800 font-bold';
                  };
                  return (
                    <tr key={s.name} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="py-1.5 px-2 font-medium text-slate-700 max-w-[160px] truncate">{s.name}</td>
                      <td className="py-1.5 px-2 text-right text-slate-500">{s.total}</td>
                      <td className="py-1.5 px-2 text-right text-rose-600 font-semibold">{s.withPrej}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctPrej)}`}>{fmtPct(s.pctPrej)}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctGt5)}`}>{s.gt5 > 0 ? `${s.gt5} (${fmtPct(s.pctGt5)})` : '—'}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctGt10)}`}>{s.gt10 > 0 ? `${s.gt10} (${fmtPct(s.pctGt10)})` : '—'}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctGt15)}`}>{s.gt15 > 0 ? `${s.gt15} (${fmtPct(s.pctGt15)})` : '—'}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctGt20)}`}>{s.gt20 > 0 ? `${s.gt20} (${fmtPct(s.pctGt20)})` : '—'}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctGt25)}`}>{s.gt25 > 0 ? `${s.gt25} (${fmtPct(s.pctGt25)})` : '—'}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-rose-600">{s.sumPrej < 0 ? fmtBRL(s.sumPrej) : '—'}</td>
                    </tr>
                  );
                })}
                {/* Linha Total */}
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                  <td className="py-2 px-2 text-slate-700 text-xs font-bold">TOTAL</td>
                  <td className="py-2 px-2 text-right text-xs font-mono text-slate-700">{globalRisk.total}</td>
                  <td className="py-2 px-2 text-right text-xs font-mono text-rose-600">{globalRisk.withPrej}</td>
                  <td className="py-2 px-2 text-right text-xs font-mono text-rose-600">{fmtPct(globalRisk.pctPrej)}</td>
                  <td className="py-2 px-2 text-right text-xs font-mono text-orange-600">{globalRisk.gt5 > 0 ? `${globalRisk.gt5} (${fmtPct(globalRisk.pctGt5)})` : '—'}</td>
                  <td className="py-2 px-2 text-right text-xs font-mono text-orange-700">{globalRisk.gt10 > 0 ? `${globalRisk.gt10} (${fmtPct(globalRisk.pctGt10)})` : '—'}</td>
                  <td className="py-2 px-2 text-right text-xs font-mono text-red-600">{globalRisk.gt15 > 0 ? `${globalRisk.gt15} (${fmtPct(globalRisk.pctGt15)})` : '—'}</td>
                  <td className="py-2 px-2 text-right text-xs font-mono text-red-700">{globalRisk.gt20 > 0 ? `${globalRisk.gt20} (${fmtPct(globalRisk.pctGt20)})` : '—'}</td>
                  <td className="py-2 px-2 text-right text-xs font-mono text-red-800">{globalRisk.gt25 > 0 ? `${globalRisk.gt25} (${fmtPct(globalRisk.pctGt25)})` : '—'}</td>
                  <td className="py-2 px-2 text-right text-xs font-mono font-bold text-rose-700">{globalRisk.sumPrej < 0 ? fmtBRL(globalRisk.sumPrej) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── NFs com Prejuízo ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SH right={<span className="text-[11px] font-bold text-rose-500">{prejData.length} NF{prejData.length !== 1 ? 's' : ''} com prejuízo</span>}>
          NFs com Prejuízo
        </SH>
        {prejData.length === 0
          ? <p className="text-xs text-slate-400 text-center py-6">Nenhuma NF com lucro bruto negativo no período</p>
          : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">NF</th>
                      <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Vendedor</th>
                      <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Cliente</th>
                      <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Rec. Bruta</th>
                      <th className="text-right py-2 px-2 text-[10px] font-bold text-orange-400 uppercase">Taxa ML</th>
                      <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Rec. Líq.</th>
                      <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Lucro Bruto</th>
                      <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">% Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(prejExpanded ? prejData : prejData.slice(0, 10)).map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-rose-50/40 transition-colors">
                        <td className="py-1.5 px-2 font-mono text-slate-600">{r.nf}{r.serie ? `-${r.serie}` : ''}</td>
                        <td className="py-1.5 px-2 text-slate-600">{r.vendedor}</td>
                        <td className="py-1.5 px-2 text-slate-500 max-w-[160px] truncate">{r.cliente}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{fmtBRL(r.valorVenda)}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-orange-600 font-semibold">{r.taxaML > 0 ? fmtBRL(r.taxaML) : '—'}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{fmtBRL(r.recLiq)}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-rose-600">{fmtBRL(r.lucroBruto)}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-rose-600">{fmtPct(r.lbPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {prejData.length > 10 && (
                <button onClick={() => setPrejExpanded(e => !e)} className="mt-2 self-center flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors">
                  {prejExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {prejExpanded ? 'Mostrar menos' : `Mostrar mais (${prejData.length - 10} restantes)`}
                </button>
              )}
            </>
          )
        }
      </div>

      {/* ── NFs com Lucro ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SH right={<span className="text-[11px] font-bold text-emerald-600">{lucroData.length} NF{lucroData.length !== 1 ? 's' : ''} com lucro</span>}>
          NFs com Lucro
        </SH>
        {lucroData.length === 0
          ? <p className="text-xs text-slate-400 text-center py-6">Nenhuma NF com lucro bruto positivo no período</p>
          : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">NF</th>
                      <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Vendedor</th>
                      <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Cliente</th>
                      <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Rec. Bruta</th>
                      <th className="text-right py-2 px-2 text-[10px] font-bold text-orange-400 uppercase">Taxa ML</th>
                      <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Rec. Líq.</th>
                      <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Lucro Bruto</th>
                      <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">% Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lucroExpanded ? lucroData : lucroData.slice(0, 10)).map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-emerald-50/40 transition-colors">
                        <td className="py-1.5 px-2 font-mono text-slate-600">{r.nf}{r.serie ? `-${r.serie}` : ''}</td>
                        <td className="py-1.5 px-2 text-slate-600">{r.vendedor}</td>
                        <td className="py-1.5 px-2 text-slate-500 max-w-[160px] truncate">{r.cliente}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{fmtBRL(r.valorVenda)}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-orange-600 font-semibold">{r.taxaML > 0 ? fmtBRL(r.taxaML) : '—'}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{fmtBRL(r.recLiq)}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-700">{fmtBRL(r.lucroBruto)}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-700">{fmtPct(r.lbPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lucroData.length > 10 && (
                <button onClick={() => setLucroExpanded(e => !e)} className="mt-2 self-center flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-emerald-600 transition-colors">
                  {lucroExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {lucroExpanded ? 'Mostrar menos' : `Mostrar mais (${lucroData.length - 10} restantes)`}
                </button>
              )}
            </>
          )
        }
      </div>
    </div>
  );
}
