import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Cell, PieChart, Pie, LabelList,
  ReferenceLine, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { loadVPecasRows, loadVPecasDevolucaoRows, type VPecasRow } from './vPecasStorage';
import { loadVPecasItemRows, type VPecasItemRow } from './vPecasItemStorage';
import VPecasSeguradoraAnalise from './VPecasSeguradoraAnalise';
import VPecasComparativo from './VPecasComparativo';
import VPecasItemSeguradoraAnalise from './VPecasItemSeguradoraAnalise';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const PALETTE = ['#7c3aed','#a78bfa','#06b6d4','#10b981','#f59e0b','#f97316','#ef4444','#e879f9','#84cc16','#3b82f6','#fb7185','#fbbf24'];
const VIOLET  = '#7c3aed';
const EMERALD = '#10b981';
const AMBER   = '#f59e0b';
const ROSE    = '#f43f5e';
const CYAN    = '#06b6d4';
// Paleta de métricas financeiras (Rec. Bruta / Rec. Líquida / Lucro Bruto)
const M_REC_BRUTA  = '#1d4ed8'; // azul escuro
const M_REC_LIQ    = '#dc2626'; // vermelho
const M_LB         = '#eab308'; // amarelo sol

const DEPT_LABEL: Record<string, string> = {
  '103': 'Peças',
  '104': 'Oficina',
  '106': 'Funilaria',
  '107': 'Acessórios',
};
const DEPT_COLOR: Record<string, string> = {
  '103': '#7c3aed',  // Peças — violeta
  '104': '#f59e0b',  // Oficina — âmbar/amarelo
  '106': '#06b6d4',  // Funilaria — ciano
  '107': '#10b981',  // Acessórios — esmeralda
};
const deptName  = (code: string) => DEPT_LABEL[code] ?? code;
const deptColor = (code: string, fallbackIdx: number) => DEPT_COLOR[code] ?? PALETTE[fallbackIdx % PALETTE.length];

const TRANSACAO_LABEL: Record<string, string> = {
  'P21': 'V. Peças Balcão',
  'O21': 'V. Peças (Of / Fu / Ac)',
  'P24': 'V. Peças Rede VW',
  'P32': 'V. Peças Fora Est s/ST',
  'G21': 'V. Peças Garantia',
  'O26': 'V. Peças Interna (Of / Fu / Ac)',
  'P33': 'V. Peças Rede VW Fora Est',
  'P69': 'V. Peças Exportação',
  'P26': 'V. Peças Interna Balcão',
  'P31': 'V. Peças Fora do Estado',
};
const transacaoName = (code: string) => TRANSACAO_LABEL[code] ?? code;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = (v?: string | null) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRLF = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct  = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

// ─── Período ──────────────────────────────────────────────────────────────────
function getYr(row: VPecasRow): number {
  if (row.periodoImport) { const [y] = row.periodoImport.split('-').map(Number); if (y > 2000) return y; }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[0];
  return 0;
}
function getMo(row: VPecasRow): number {
  if (row.periodoImport) { const [,m] = row.periodoImport.split('-').map(Number); if (m >= 1 && m <= 12) return m; }
  const d = row.data['DTA_DOCUMENTO'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(d))   return +d.split('-')[1];
  return 0;
}

// ─── Cálculo por linha ────────────────────────────────────────────────────────
interface Calc { valorVenda: number; icms: number; pis: number; cofins: number; difal: number; totalImpostos: number; recLiq: number; custo: number; lucroBruto: number; lucroBrutoPct: number; }
function calcPecas(d: Record<string, string>): Calc {
  const valorVenda = n(d['LIQ_NOTA_FISCAL']);
  const icms       = n(d['VAL_ICMS']);
  const pis        = n(d['VAL_PIS']);
  const cofins     = n(d['VAL_COFINS']);
  const difal      = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
  const totalImpostos = icms + pis + cofins + difal;
  const recLiq     = valorVenda - totalImpostos;
  const custo      = n(d['TOT_CUSTO_MEDIO']);
  const lucroBruto = recLiq - custo;
  const lucroBrutoPct = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
  return { valorVenda, icms, pis, cofins, difal, totalImpostos, recLiq, custo, lucroBruto, lucroBrutoPct };
}

// ─── Agregador ────────────────────────────────────────────────────────────────
interface Agg { nfs: number; valorVenda: number; icms: number; pis: number; cofins: number; difal: number; totalImpostos: number; recLiq: number; custo: number; lucroBruto: number; lbPct: number; }
function agg(rows: VPecasRow[]): Agg {
  let nfs = 0, valorVenda = 0, icms = 0, pis = 0, cofins = 0, difal = 0, totalImpostos = 0, recLiq = 0, custo = 0, lucroBruto = 0;
  for (const r of rows) {
    const c = calcPecas(r.data);
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col gap-1" style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}>
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

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-slate-200 gap-2">
      <TrendingUp className="w-6 h-6" />
      <span className="text-xs">Sem dados</span>
    </div>
  );
}

function TipBRL({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[180px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p, i) => p.value !== 0 && (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-mono text-slate-700">
            {p.name === '% LB' ? fmtPct(p.value) : fmtBRLF(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all border ${
        active ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Helpers para Itens de Peças ────────────────────────────────────────────
function getItemYr(row: VPecasItemRow): number {
  if (row.periodoImport) { const [y] = row.periodoImport.split('-').map(Number); if (y > 2000) return y; }
  const d = row.data['DTA_ENTRADA_SAIDA'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[2];
  return 0;
}
function getItemMo(row: VPecasItemRow): number {
  if (row.periodoImport) { const [,m] = row.periodoImport.split('-').map(Number); if (m >= 1 && m <= 12) return m; }
  const d = row.data['DTA_ENTRADA_SAIDA'] ?? '';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return +d.split('/')[1];
  return 0;
}
function calcItem(d: Record<string, string>): { recLiq: number; lucroBruto: number; lbPct: number } {
  const valorVenda = n(d['VAL_VENDA']);
  const impostos   = n(d['VAL_IMPOSTOS']);
  const custo      = n(d['CUSTO_MEDIO']);
  const recLiq     = valorVenda - impostos;
  const lucroBruto = recLiq - custo;
  const lbPct      = recLiq !== 0 ? (lucroBruto / recLiq) * 100 : 0;
  return { recLiq, lucroBruto, lbPct };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VPecasAnalise() {
  const curYear = new Date().getFullYear();
  const [allRows, setAllRows] = useState<VPecasRow[]>([]);
  const [loading, setLoading]  = useState(true);
  const [year, setYear]        = useState(curYear);
  const [month, setMonth]      = useState<number | null>(new Date().getMonth() + 1);
  const [deptMetric, setDeptMetric] = useState<'nfs' | 'valorVenda' | 'recLiq' | 'lucroBruto'>('valorVenda');
  const [vendorSort, setVendorSort] = useState<'valorVenda' | 'nfs' | 'lucroBruto' | 'lbPct'>('valorVenda');
  const [estadoMetric, setEstadoMetric] = useState<'valorVenda' | 'recLiq' | 'lucroBruto'>('valorVenda');
  const [clienteMetric, setClienteMetric] = useState<'valorVenda' | 'nfs'>('valorVenda');
  const [vendorDept, setVendorDept]       = useState('Todos');
  const [clienteDept, setClienteDept]     = useState('Todos');
  const [vendorExpanded, setVendorExpanded] = useState(false);
  const [estadoExpanded, setEstadoExpanded] = useState(false);
  const [prejuizoExpanded, setPrejuizoExpanded] = useState(false);
  const [clienteExpanded, setClienteExpanded] = useState(false);
  const [analiseTab, setAnaliseTab]                     = useState<'nfs' | 'itens' | 'seg' | 'itemSeg'>('nfs');
  const [allItemRows, setAllItemRows]                   = useState<VPecasItemRow[]>([]);
  const [itemPrejuizoDept, setItemPrejuizoDept]         = useState('Todos');
  const [itemPrejuizoExpanded, setItemPrejuizoExpanded] = useState(false);
  const [itemLucroExpanded, setItemLucroExpanded]       = useState(false);

  useEffect(() => {
    loadVPecasItemRows().then(setAllItemRows);
  }, []);

  useEffect(() => {
    Promise.all([loadVPecasRows(), loadVPecasDevolucaoRows()]).then(([rows, devol]) => {
      const filtered = [...rows, ...devol].filter(r => r.data['SERIE_NOTA_FISCAL'] !== 'RPS');
      setAllRows(filtered);
      if (filtered.length > 0) {
        const yr = Math.max(...filtered.map(getYr).filter(y => y > 2000));
        const mo = Math.max(...filtered.filter(r => getYr(r) === yr).map(getMo).filter(m => m >= 1 && m <= 12));
        setYear(yr);
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

  const yearRows = useMemo(() => allRows.filter(r => getYr(r) === year), [allRows, year]);

  const filteredRows = useMemo(() => yearRows.filter(r => {
    if (month !== null && getMo(r) !== month) return false;
    return true;
  }), [yearRows, month]);

  // Mês anterior para delta
  const prevRows = useMemo(() => {
    if (month === null) return [];
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    return allRows.filter(r => getYr(r) === py && getMo(r) === pm);
  }, [allRows, month, year]);

  const metrics     = useMemo(() => agg(filteredRows), [filteredRows]);
  const prevMetrics = useMemo(() => agg(prevRows),    [prevRows]);

  const delta = (cur: number, prev: number) =>
    prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : undefined;

  // ─── 1. Evolução Mensal ────────────────────────────────────────────────────
  const monthlyData = useMemo(() => MS.map((label, i) => {
    const m  = i + 1;
    const mr = yearRows.filter(r => getMo(r) === m);
    const a  = agg(mr);
    return { label, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, lucroBruto: a.lucroBruto, lbPct: a.lbPct };
  }), [yearRows]);

  // ─── 2. Por Departamento ──────────────────────────────────────────────────
  const deptData = useMemo(() => {
    const map = new Map<string, VPecasRow[]>();
    for (const r of filteredRows) {
      const k = r.data['DEPARTAMENTO']?.trim() || '(sem depto)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rows]) => {
      const a = agg(rows);
      return { name, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, lucroBruto: a.lucroBruto, lbPct: a.lbPct };
    }).sort((a, b) => b[deptMetric] - a[deptMetric]);
  }, [filteredRows, deptMetric]);

  const deptDonut = useMemo(() => {
    const total = deptData.reduce((s, d) => s + d.valorVenda, 0);
    return deptData.map((d, i) => ({ name: deptName(d.name), value: d.valorVenda, pct: total ? d.valorVenda / total * 100 : 0, color: deptColor(d.name, i) }));
  }, [deptData]);

  // ─── 3. Ranking Vendedores ────────────────────────────────────────────────
  const availVendorDepts = useMemo(() => {
    const s = new Set(filteredRows.map(r => r.data['DEPARTAMENTO']?.trim() || '(sem depto)'));
    return ['Todos', ...[...s].sort()];
  }, [filteredRows]);

  const vendorData = useMemo(() => {
    const source = vendorDept !== 'Todos'
      ? filteredRows.filter(r => (r.data['DEPARTAMENTO']?.trim() || '(sem depto)') === vendorDept)
      : filteredRows;
    const map = new Map<string, VPecasRow[]>();
    for (const r of source) {
      const k = r.data['NOME_VENDEDOR']?.trim() || '(sem nome)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rows]) => {
      const a = agg(rows);
      return { name, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, lucroBruto: a.lucroBruto, lbPct: a.lbPct };
    }).sort((a, b) => b[vendorSort] - a[vendorSort]);
  }, [filteredRows, vendorSort, vendorDept]);

  const vendorMax = useMemo(() => Math.max(...vendorData.map(v => v[vendorSort]), 1), [vendorData, vendorSort]);

  // ─── 4. Por Estado ────────────────────────────────────────────────────────
  const estadoData = useMemo(() => {
    const map = new Map<string, VPecasRow[]>();
    for (const r of filteredRows) {
      const k = r.data['ESTADO']?.trim() || '(sem UF)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rows]) => {
      const a = agg(rows);
      return { name, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, lucroBruto: a.lucroBruto, lbPct: a.lbPct };
    }).sort((a, b) => b[estadoMetric] - a[estadoMetric]).slice(0, 20);
  }, [filteredRows, estadoMetric]);

  // ─── 5. Composição Impostos ───────────────────────────────────────────────
  const impostosData = useMemo(() => {
    const a = metrics;
    const total = a.icms + a.pis + a.cofins + a.difal;
    return [
      { name: 'ICMS',  value: a.icms,   color: '#818cf8',     pct: total ? a.icms  / total * 100 : 0 },
      { name: 'PIS',   value: a.pis,    color: CYAN,          pct: total ? a.pis   / total * 100 : 0 },
      { name: 'COFINS',value: a.cofins, color: EMERALD,       pct: total ? a.cofins/ total * 100 : 0 },
      { name: 'Difal', value: a.difal,  color: AMBER,         pct: total ? a.difal / total * 100 : 0 },
    ].filter(d => d.value > 0);
  }, [metrics]);

  // ─── 6. Top Clientes ──────────────────────────────────────────────────────
  const availClienteDepts = useMemo(() => {
    const s = new Set(filteredRows.map(r => r.data['DEPARTAMENTO']?.trim() || '(sem depto)'));
    return ['Todos', ...[...s].sort()];
  }, [filteredRows]);

  const clienteData = useMemo(() => {
    const source = clienteDept !== 'Todos'
      ? filteredRows.filter(r => (r.data['DEPARTAMENTO']?.trim() || '(sem depto)') === clienteDept)
      : filteredRows;
    const map = new Map<string, { rows: VPecasRow[]; cidade: string; estado: string }>();
    for (const r of source) {
      const k = r.data['NOME_CLIENTE']?.trim() || '(sem nome)';
      const existing = map.get(k);
      if (existing) existing.rows.push(r);
      else map.set(k, { rows: [r], cidade: r.data['CIDADE'] ?? '', estado: r.data['ESTADO'] ?? '' });
    }
    return [...map.entries()].map(([name, { rows, cidade, estado }]) => {
      const a = agg(rows);
      return { name, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, lucroBruto: a.lucroBruto, lbPct: a.lbPct, cidade, estado };
    }).sort((a, b) => b[clienteMetric] - a[clienteMetric]).slice(0, 15);
  }, [filteredRows, clienteMetric, clienteDept]);

  const clienteMax = useMemo(() => Math.max(...clienteData.map(c => c[clienteMetric]), 1), [clienteData, clienteMetric]);

  // ─── 7. Análise de Risco por Departamento ────────────────────────────────
  // Consolidação: 122→104, 108→103, 129→106
  const DEPT_MERGE: Record<string, string> = { '122': '104', '108': '103', '129': '106' };
  const normDept = (raw: string) => DEPT_MERGE[raw] ?? raw;

  const deptRiskData = useMemo(() => {
    const map = new Map<string, VPecasRow[]>();
    for (const r of filteredRows) {
      const k = normDept(r.data['DEPARTAMENTO']?.trim() || '(sem depto)');
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([dept, rows]) => {
      const calcs = rows.map(r => calcPecas(r.data));
      const total    = calcs.length;
      const withPrej = calcs.filter(c => c.lucroBruto < 0);
      const pct      = (arr: typeof calcs) => total > 0 ? arr.length / total * 100 : 0;
      const sumPrej  = withPrej.reduce((s, c) => s + c.lucroBruto, 0);
      const gt = (thr: number) => withPrej.filter(c => c.recLiq !== 0 && Math.abs(c.lucroBruto / c.recLiq * 100) > thr);
      return {
        dept,
        total,
        withPrej: withPrej.length,
        pctPrej:  pct(withPrej),
        gt5:  gt(5).length,   pctGt5:  pct(gt(5)),
        gt10: gt(10).length,  pctGt10: pct(gt(10)),
        gt15: gt(15).length,  pctGt15: pct(gt(15)),
        gt20: gt(20).length,  pctGt20: pct(gt(20)),
        gt25: gt(25).length,  pctGt25: pct(gt(25)),
        sumPrej,
      };
    }).sort((a, b) => b.pctPrej - a.pctPrej);
  }, [filteredRows]);

  const globalDeptRisk = useMemo(() => {
    const allCalcs = filteredRows.map(r => calcPecas(r.data));
    const total    = allCalcs.length;
    const withPrej = allCalcs.filter(c => c.lucroBruto < 0);
    const sumPrej  = withPrej.reduce((s, c) => s + c.lucroBruto, 0);
    const gt = (thr: number) => withPrej.filter(c => c.recLiq !== 0 && Math.abs(c.lucroBruto / c.recLiq * 100) > thr);
    const pct = (n: number) => total > 0 ? n / total * 100 : 0;
    return {
      total, withPrej: withPrej.length, pctPrej: pct(withPrej.length), sumPrej,
      gt5: gt(5).length, pctGt5: pct(gt(5).length),
      gt10: gt(10).length, pctGt10: pct(gt(10).length),
      gt15: gt(15).length, pctGt15: pct(gt(15).length),
      gt20: gt(20).length, pctGt20: pct(gt(20).length),
      gt25: gt(25).length, pctGt25: pct(gt(25).length),
    };
  }, [filteredRows]);

  // ─── 8. Top NFs com Prejuízo ─────────────────────────────────────────────
  const [prejuizoDept, setPrejuizoDept] = useState('Todos');

  const availPrejuizoDepts = useMemo(() => {
    const s = new Set(filteredRows.map(r => r.data['DEPARTAMENTO']?.trim() || '(sem depto)'));
    return ['Todos', ...[...s].sort()];
  }, [filteredRows]);

  const prejuizoData = useMemo(() => {
    const base = filteredRows.filter(r => (r.data['TIPO_TRANSACAO']?.trim().toUpperCase()) !== 'P07');
    const source = prejuizoDept !== 'Todos'
      ? base.filter(r => (r.data['DEPARTAMENTO']?.trim() || '(sem depto)') === prejuizoDept)
      : base;
    return source
      .map(r => {
        const c = calcPecas(r.data);
        return {
          nf:        r.data['NUMERO_NOTA_FISCAL']?.trim() || '—',
          serie:     r.data['SERIE_NOTA_FISCAL']?.trim() || '',
          cliente:   r.data['NOME_CLIENTE']?.trim() || '(sem cliente)',
          vendedor:  r.data['NOME_VENDEDOR']?.trim() || '(sem vendedor)',
          depto:     r.data['DEPARTAMENTO']?.trim() || '(sem depto)',
          valorVenda: c.valorVenda,
          recLiq:     c.recLiq,
          lucroBruto: c.lucroBruto,
          lbPct:      c.lucroBrutoPct,
        };
      })
      .filter(r => r.lucroBruto < 0)
      .sort((a, b) => a.lucroBruto - b.lucroBruto)
      .slice(0, 20);
  }, [filteredRows, prejuizoDept]);

  // ─── 8. Por Tipo de Transação ─────────────────────────────────────────────
  const transacaoData = useMemo(() => {
    const map = new Map<string, VPecasRow[]>();
    for (const r of filteredRows) {
      const k = r.data['TIPO_TRANSACAO']?.trim() || '(sem tipo)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rows]) => {
      const a = agg(rows);
      return { name: transacaoName(name), code: name, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, lucroBruto: a.lucroBruto, lbPct: a.lbPct };
    }).sort((a, b) => b.valorVenda - a.valorVenda);
  }, [filteredRows]);

  // ─── Itens de Peças ─────────────────────────────────────────────────────────────────────────
  const filteredItemRows = useMemo(() =>
    allItemRows.filter(r => {
      if (getItemYr(r) !== year) return false;
      if (month !== null && getItemMo(r) !== month) return false;
      return true;
    })
  , [allItemRows, year, month]);

  const itemKpis = useMemo(() => {
    let comLucro = 0, comPrejuizo = 0, lucroBrutoTotal = 0, recLiqTotal = 0;
    for (const r of filteredItemRows) {
      const c = calcItem(r.data);
      recLiqTotal    += c.recLiq;
      lucroBrutoTotal += c.lucroBruto;
      if (c.lucroBruto > 0) comLucro++;
      else if (c.lucroBruto < 0) comPrejuizo++;
    }
    const total = filteredItemRows.length;
    const pctLucro  = total > 0 ? (comLucro / total) * 100 : 0;
    const lbPctTotal = recLiqTotal !== 0 ? (lucroBrutoTotal / recLiqTotal) * 100 : 0;
    return { total, comLucro, comPrejuizo, lucroBrutoTotal, pctLucro, lbPctTotal };
  }, [filteredItemRows]);

  const availItemDepts = useMemo(() => {
    const s = new Set(filteredItemRows.map(r => r.data['DEPARTAMENTO']?.trim() || '(sem depto)'));
    return ['Todos', ...[...s].sort()];
  }, [filteredItemRows]);

  const itemPrejuizoData = useMemo(() => {
    const source = itemPrejuizoDept !== 'Todos'
      ? filteredItemRows.filter(r => (r.data['DEPARTAMENTO']?.trim() || '(sem depto)') === itemPrejuizoDept)
      : filteredItemRows;
    return source
      .map(r => {
        const c = calcItem(r.data);
        return {
          codigo:     r.data['ITEM_ESTOQUE_PUB']?.trim() || '—',
          descricao:  r.data['DES_ITEM_ESTOQUE']?.trim() || '—',
          depto:      r.data['DEPARTAMENTO']?.trim() || '(sem depto)',
          vendedor:   r.data['NOME_VENDEDOR']?.trim() || '—',
          cliente:    r.data['NOME_CLIENTE']?.trim() || '—',
          nf:         r.data['NUMERO_NOTA_FISCAL']?.trim() || '—',
          transacao:  r.data['TIPO_TRANSACAO']?.trim() || '—',
          qtd:        r.data['QUANTIDADE']?.trim() || '0',
          recLiq:     c.recLiq,
          custo:      n(r.data['CUSTO_MEDIO']),
          lucroBruto: c.lucroBruto,
          lbPct:      c.lbPct,
        };
      })
      .filter(r => r.lucroBruto < 0)
      .sort((a, b) => a.lucroBruto - b.lucroBruto)
      .slice(0, 40);
  }, [filteredItemRows, itemPrejuizoDept]);

  const itemLucroData = useMemo(() => {
    const source = itemPrejuizoDept !== 'Todos'
      ? filteredItemRows.filter(r => (r.data['DEPARTAMENTO']?.trim() || '(sem depto)') === itemPrejuizoDept)
      : filteredItemRows;
    return source
      .map(r => {
        const c = calcItem(r.data);
        return {
          codigo:     r.data['ITEM_ESTOQUE_PUB']?.trim() || '—',
          descricao:  r.data['DES_ITEM_ESTOQUE']?.trim() || '—',
          depto:      r.data['DEPARTAMENTO']?.trim() || '(sem depto)',
          vendedor:   r.data['NOME_VENDEDOR']?.trim() || '—',
          cliente:    r.data['NOME_CLIENTE']?.trim() || '—',
          nf:         r.data['NUMERO_NOTA_FISCAL']?.trim() || '—',
          transacao:  r.data['TIPO_TRANSACAO']?.trim() || '—',
          qtd:        r.data['QUANTIDADE']?.trim() || '0',
          recLiq:     c.recLiq,
          custo:      n(r.data['CUSTO_MEDIO']),
          lucroBruto: c.lucroBruto,
          lbPct:      c.lbPct,
        };
      })
      .filter(r => r.lucroBruto > 0)
      .sort((a, b) => b.lucroBruto - a.lucroBruto)
      .slice(0, 40);
  }, [filteredItemRows, itemPrejuizoDept]);

  const itemDeptSummary = useMemo(() => {
    const map = new Map<string, { total: number; comLucro: number; comPrejuizo: number; lucroBruto: number; recLiq: number }>();
    for (const r of filteredItemRows) {
      const dept = r.data['DEPARTAMENTO']?.trim() || '(sem depto)';
      const c = calcItem(r.data);
      const entry = map.get(dept) ?? { total: 0, comLucro: 0, comPrejuizo: 0, lucroBruto: 0, recLiq: 0 };
      entry.total++;
      entry.lucroBruto += c.lucroBruto;
      entry.recLiq += c.recLiq;
      if (c.lucroBruto > 0) entry.comLucro++;
      else if (c.lucroBruto < 0) entry.comPrejuizo++;
      map.set(dept, entry);
    }
    return [...map.entries()].map(([depto, v]) => ({
      depto, ...v,
      lbPct: v.recLiq !== 0 ? (v.lucroBruto / v.recLiq) * 100 : 0,
    })).sort((a, b) => b.lucroBruto - a.lucroBruto);
  }, [filteredItemRows]);

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
        <span className="text-sm">Nenhum dado encontrado — importe V. Peças na aba Registros</span>
      </div>
    );
  }

  const deptMetricLabel: Record<typeof deptMetric, string> = { nfs: 'Qtd NFs', valorVenda: 'Receita Bruta', recLiq: 'Rec. Líquida', lucroBruto: 'Lucro Bruto' };
  const estadoMetricLabel: Record<typeof estadoMetric, string> = { valorVenda: 'Receita Bruta', recLiq: 'Rec. Líquida', lucroBruto: 'Lucro Bruto' };
  const vendorSortLabel: Record<typeof vendorSort, string> = { valorVenda: 'Receita Bruta', nfs: 'Qtd NFs', lucroBruto: 'Lucro Bruto', lbPct: '% Lucro Bruto' };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 px-6 py-5 space-y-8" style={{ minHeight: 0 }}>
      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          ANO
          <select
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          >
            {availYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setMonth(null)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${month === null ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Ano todo
          </button>
          {MS.map((m, i) => (
            <button
              key={m}
              onClick={() => setMonth(i + 1)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${month === i + 1 ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-slate-400">{filteredRows.length} NF{filteredRows.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Sub-tabs Análise ──────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2">
        <button
          onClick={() => setAnaliseTab('nfs')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${analiseTab === 'nfs' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          Análise por NF (Vendas de Peças)
        </button>
        <button
          onClick={() => setAnaliseTab('itens')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${analiseTab === 'itens' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          Análise por Item (Itens de Peças)
        </button>
        <button
          onClick={() => setAnaliseTab('seg')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${analiseTab === 'seg' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          Análise Seguradora Balcão
        </button>
        <button
          onClick={() => setAnaliseTab('itemSeg')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${analiseTab === 'itemSeg' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          Itens Seguradora Balcão
        </button>
      </div>

      {analiseTab === 'nfs' && <>
      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="Total de NFs" value={metrics.nfs.toLocaleString('pt-BR')} accent={VIOLET}
          delta={month !== null ? delta(metrics.nfs, prevMetrics.nfs) : undefined} />
        <KpiCard label="Receita Bruta" value={fmtBRL(metrics.valorVenda)} color="text-violet-700" accent={VIOLET}
          delta={month !== null ? delta(metrics.valorVenda, prevMetrics.valorVenda) : undefined} />
        <KpiCard label="Total Impostos" value={fmtBRL(metrics.totalImpostos)} color="text-rose-600" accent={ROSE}
          sub={metrics.valorVenda ? fmtPct(metrics.totalImpostos / metrics.valorVenda * 100) + ' da receita' : undefined} />
        <KpiCard label="Receita Líquida" value={fmtBRL(metrics.recLiq)} color="text-emerald-700" accent={EMERALD}
          delta={month !== null ? delta(metrics.recLiq, prevMetrics.recLiq) : undefined} />
        <KpiCard label="Custo Médio" value={fmtBRL(metrics.custo)} accent="#94a3b8"
          sub={metrics.recLiq ? fmtPct(metrics.custo / metrics.recLiq * 100) + ' da rec. liq.' : undefined} />
        <KpiCard
          label="Lucro Bruto"
          value={fmtBRL(metrics.lucroBruto)}
          color={metrics.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}
          accent={metrics.lucroBruto >= 0 ? EMERALD : ROSE}
          delta={month !== null ? delta(metrics.lucroBruto, prevMetrics.lucroBruto) : undefined}
          sub={fmtPct(metrics.lbPct) + ' margem'}
        />
        <KpiCard
          label="% Lucro Bruto"
          value={fmtPct(metrics.lbPct)}
          color={metrics.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}
          accent={metrics.lbPct >= 0 ? EMERALD : ROSE}
        />
      </div>

      {/* ── Seção 1: Evolução Mensal ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
        <SH>Evolução Mensal — {year}</SH>
        {yearRows.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyData} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="brl" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} width={58} />
              <YAxis yAxisId="pct" orientation="right" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} width={40} />
              <Tooltip content={<TipBRL />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="brl" dataKey="valorVenda" name="Receita Bruta" fill={M_REC_BRUTA} fillOpacity={0.7} radius={[3, 3, 0, 0]}>
                {monthlyData.map((d, i) => (
                  <Cell key={i} fill={month === i + 1 ? M_REC_BRUTA : `${M_REC_BRUTA}55`} />
                ))}
              </Bar>
              <Bar yAxisId="brl" dataKey="recLiq" name="Rec. Líquida" fill={M_REC_LIQ} fillOpacity={0.7} radius={[3, 3, 0, 0]}>
                {monthlyData.map((d, i) => (
                  <Cell key={i} fill={month === i + 1 ? M_REC_LIQ : `${M_REC_LIQ}55`} />
                ))}
              </Bar>
              <Line yAxisId="pct" type="monotone" dataKey="lbPct" name="% LB" stroke={M_LB} strokeWidth={2} dot={{ r: 3, fill: M_LB }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Seção 2: Por Departamento ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
        <SH
          right={
            <div className="flex gap-1">
              {(['nfs', 'valorVenda', 'recLiq', 'lucroBruto'] as const).map(m => (
                <Pill key={m} label={deptMetricLabel[m]} active={deptMetric === m} onClick={() => setDeptMetric(m)} />
              ))}
            </div>
          }
        >
          Vendas por Departamento
        </SH>
        {deptData.length === 0 ? <Empty /> : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Donut */}
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={deptDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {deptDonut.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRLF(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1 w-full mt-1">
                {deptDonut.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-600 truncate flex-1">{d.name}</span>
                    <span className="font-mono text-slate-500">{fmtPct(d.pct)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Barras horizontais */}
            <div className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={Math.max(220, deptData.length * 32 + 20)}>
                <BarChart layout="vertical" data={deptData} margin={{ top: 0, right: 80, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => deptMetric === 'nfs' ? v.toString() : `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} width={100} tickFormatter={(v: string) => deptName(v)} />
                  <Tooltip content={(props: any) => {
                    const { active, payload, label } = props;
                    if (!active || !payload?.length) return null;
                    const entry = payload[0].payload;
                    const val = payload[0].value as number;
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
                        <p className="font-bold text-slate-700 mb-1.5">{label}</p>
                        <div className="flex justify-between gap-4">
                          <span style={{ color: payload[0].color }} className="font-medium">{payload[0].name}</span>
                          <span className="font-mono text-slate-700">{deptMetric === 'nfs' ? val : fmtBRLF(val)}</span>
                        </div>
                        {deptMetric === 'lucroBruto' && (
                          <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
                            <span className="text-slate-500">% Lucro Bruto</span>
                            <span className={`font-mono font-bold ${entry.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtPct(entry.lbPct)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }} />
                  <Bar dataKey={deptMetric} name={deptMetricLabel[deptMetric]} radius={[0, 4, 4, 0]}>
                    {deptData.map((d, i) => <Cell key={i} fill={deptColor(d.name, i)} />)}
                    <LabelList dataKey={deptMetric} position="right" formatter={(v: number) => deptMetric === 'nfs' ? v : fmtBRL(v)} style={{ fontSize: 10, fill: '#64748b' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── Seção 3: Ranking Vendedores ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
        <SH
          right={
            <div className="flex gap-1 flex-wrap justify-end">
              {(['valorVenda', 'nfs', 'lucroBruto', 'lbPct'] as const).map(m => (
                <Pill key={m} label={vendorSortLabel[m]} active={vendorSort === m} onClick={() => setVendorSort(m)} />
              ))}
            </div>
          }
        >
          Ranking de Vendedores
        </SH>
        {/* Filtro de departamento */}
        <div className="flex gap-1 flex-wrap mb-3">
          {availVendorDepts.map(d => (
            <button
              key={d}
              onClick={() => setVendorDept(d)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all border ${
                vendorDept === d ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              {deptName(d)}
            </button>
          ))}
        </div>
        {vendorData.length === 0 ? <Empty /> : (
          <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
              <span>Vendedor</span>
              <span className="text-right">NFs</span>
              <span className="text-right">Rec. Bruta</span>
              <span className="text-right">Lucro Bruto</span>
              <span className="text-right">% LB</span>
            </div>
            {(vendorExpanded ? vendorData : vendorData.slice(0, 5)).map((v, i) => {
              const barW = vendorMax > 0 ? (v[vendorSort] / vendorMax) * 100 : 0;
              const medalColors = ['#f59e0b','#9ca3af','#cd7f32'];
              return (
                <div key={i} className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 items-center px-2 py-1.5 rounded-lg transition-colors hover:bg-violet-50/40 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      {i < 3 && (
                        <span className="text-[10px] font-black w-4 text-center" style={{ color: medalColors[i] }}>{['①','②','③'][i]}</span>
                      )}
                      <span className="text-xs font-semibold text-slate-700 truncate">{v.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 rounded-full bg-slate-100 flex-1 overflow-hidden">
                        <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  </div>
                  <span className="text-right text-xs font-mono text-slate-600">{v.nfs}</span>
                  <span className="text-right text-xs font-mono text-slate-700">{fmtBRL(v.valorVenda)}</span>
                  <span className={`text-right text-xs font-mono font-semibold ${v.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtBRL(v.lucroBruto)}</span>
                  <span className={`text-right text-xs font-mono font-bold ${v.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtPct(v.lbPct)}</span>
                </div>
              );
            })}
            {vendorData.length > 5 && (
              <button
                onClick={() => setVendorExpanded(e => !e)}
                className="mt-1 self-center px-4 py-1 rounded-full text-[11px] font-bold text-violet-600 border border-violet-200 hover:bg-violet-50 transition-all"
              >
                {vendorExpanded ? `Mostrar menos` : `Mostrar mais (${vendorData.length - 5} restantes)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Seção 4: Por Estado ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
        <SH
          right={
            <div className="flex gap-1">
              {(['valorVenda', 'recLiq', 'lucroBruto'] as const).map(m => (
                <Pill key={m} label={estadoMetricLabel[m]} active={estadoMetric === m} onClick={() => setEstadoMetric(m)} />
              ))}
            </div>
          }
        >
          Vendas por Estado (Top 20)
        </SH>
        {estadoData.length === 0 ? <Empty /> : (
          <div className="flex flex-col gap-2">
            <ResponsiveContainer width="100%" height={Math.max(160, (estadoExpanded ? estadoData.length : Math.min(5, estadoData.length)) * 28 + 20)}>
              <BarChart layout="vertical" data={estadoExpanded ? estadoData : estadoData.slice(0, 5)} margin={{ top: 0, right: estadoMetric === 'lucroBruto' ? 150 : 90, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} width={40} />
                <Tooltip content={(props: any) => {
                    const { active, payload, label } = props;
                    if (!active || !payload?.length) return null;
                    const entry = payload[0].payload;
                    const val = payload[0].value as number;
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
                        <p className="font-bold text-slate-700 mb-1.5">{label}</p>
                        <div className="flex justify-between gap-4">
                          <span style={{ color: payload[0].color }} className="font-medium">{payload[0].name}</span>
                          <span className="font-mono text-slate-700">{fmtBRLF(val)}</span>
                        </div>
                        {estadoMetric === 'lucroBruto' && (
                          <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
                            <span className="text-slate-500">% Lucro Bruto</span>
                            <span className={`font-mono font-bold ${entry.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtPct(entry.lbPct)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }} />
                <Bar dataKey={estadoMetric} name={estadoMetricLabel[estadoMetric]} radius={[0, 4, 4, 0]}>
                  {(estadoExpanded ? estadoData : estadoData.slice(0, 5)).map((d, i) => (
                    <Cell key={i}
                      fill={estadoMetric === 'lucroBruto' && d.lucroBruto < 0 ? ROSE : VIOLET}
                      fillOpacity={0.7 + (estadoData.length - i) / estadoData.length * 0.3}
                    />
                  ))}
                  <LabelList
                    dataKey={estadoMetric}
                    position="right"
                    content={(props: any) => {
                      const { x, y, width, height, value, index } = props;
                      const src = estadoExpanded ? estadoData : estadoData.slice(0, 5);
                      const entry = src[index];
                      const label = estadoMetric === 'lucroBruto' && entry
                        ? `${fmtBRL(value)} (${fmtPct(entry.lbPct)})`
                        : fmtBRL(value);
                      return (
                        <text x={x + width + 6} y={y + height / 2} dy={4} fontSize={10} fill="#64748b" textAnchor="start">
                          {label}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {estadoData.length > 5 && (
              <button
                onClick={() => setEstadoExpanded(e => !e)}
                className="mt-1 self-center px-4 py-1 rounded-full text-[11px] font-bold text-violet-600 border border-violet-200 hover:bg-violet-50 transition-all"
              >
                {estadoExpanded ? 'Mostrar menos' : `Mostrar mais (${estadoData.length - 5} restantes)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Seção 5 + 6 (grid 2 colunas): Impostos + Tipo Transação ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 5. Composição de Impostos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
          <SH>Composição dos Impostos</SH>
          {impostosData.length === 0 ? <Empty /> : (
            <div className="flex gap-5 items-start">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={impostosData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {impostosData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRLF(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 flex flex-col gap-2 mt-2">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                  <span />
                  <span>Imposto</span>
                  <span className="text-right">Valor</span>
                  <span className="text-right">% Rec.</span>
                </div>
                {impostosData.map((d, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-center">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-xs font-semibold text-slate-700">{d.name}</span>
                    <span className="text-xs font-mono text-slate-600 text-right">{fmtBRL(d.value)}</span>
                    <span className="text-xs font-mono text-slate-400 text-right">{fmtPct(metrics.valorVenda ? d.value / metrics.valorVenda * 100 : 0)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-center border-t border-slate-100 pt-1 mt-1">
                  <div className="w-2.5 h-2.5" />
                  <span className="text-xs font-bold text-slate-800">Total</span>
                  <span className="text-xs font-mono font-bold text-slate-800 text-right">{fmtBRL(metrics.totalImpostos)}</span>
                  <span className="text-xs font-mono font-bold text-slate-500 text-right">{fmtPct(metrics.valorVenda ? metrics.totalImpostos / metrics.valorVenda * 100 : 0)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. Por Tipo de Transação */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
          <SH>Por Tipo de Transação</SH>
          {transacaoData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={transacaoData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} angle={-20} textAnchor="end" interval={0} height={48} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} width={50} />
                <Tooltip content={(props: any) => {
                  const { active, payload, label } = props;
                  if (!active || !payload?.length) return null;
                  const entry = payload[0].payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
                      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
                      {payload.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between gap-4">
                          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
                          <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Lucro Bruto</span>
                        <span className={`font-mono font-bold ${entry.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtBRLF(entry.lucroBruto)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">% Lucro Bruto</span>
                        <span className={`font-mono font-bold ${entry.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtPct(entry.lbPct)}</span>
                      </div>
                    </div>
                  );
                }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="valorVenda" name="Receita Bruta" fill={M_REC_BRUTA} fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                <Bar dataKey="recLiq" name="Rec. Líquida" fill={M_REC_LIQ} fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                <Bar dataKey="lucroBruto" name="Lucro Bruto" fill={M_LB} fillOpacity={0.8} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Seção 7b: Análise de Risco por Departamento ─────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5 space-y-5">
        <SH>Análise de Risco — NFs com Prejuízo por Departamento</SH>

        {/* KPI cards globais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { label: 'Total NFs',     value: globalDeptRisk.total.toLocaleString('pt-BR'),    sub: '100%',                        color: 'text-slate-700', accent: '#94a3b8' },
            { label: 'c/ Prejuízo',   value: globalDeptRisk.withPrej.toLocaleString('pt-BR'), sub: fmtPct(globalDeptRisk.pctPrej), color: 'text-rose-700',  accent: '#f43f5e' },
            { label: 'Soma Prejuízo', value: fmtBRL(globalDeptRisk.sumPrej),                  sub: '',                            color: 'text-rose-700',  accent: '#f43f5e' },
            { label: 'Margem < −5%',  value: globalDeptRisk.gt5.toLocaleString('pt-BR'),      sub: fmtPct(globalDeptRisk.pctGt5),  color: 'text-orange-600', accent: '#f97316' },
            { label: 'Margem < −10%', value: globalDeptRisk.gt10.toLocaleString('pt-BR'),     sub: fmtPct(globalDeptRisk.pctGt10), color: 'text-orange-700', accent: '#ea580c' },
            { label: 'Margem < −15%', value: globalDeptRisk.gt15.toLocaleString('pt-BR'),     sub: fmtPct(globalDeptRisk.pctGt15), color: 'text-red-600',    accent: '#dc2626' },
            { label: 'Margem < −20%', value: globalDeptRisk.gt20.toLocaleString('pt-BR'),     sub: fmtPct(globalDeptRisk.pctGt20), color: 'text-red-700',    accent: '#b91c1c' },
            { label: 'Margem < −25%', value: globalDeptRisk.gt25.toLocaleString('pt-BR'),     sub: fmtPct(globalDeptRisk.pctGt25), color: 'text-red-800',    accent: '#991b1b' },
          ].map(card => (
            <div key={card.label} className="rounded-lg border border-slate-100 px-3 py-2.5 flex flex-col gap-0.5" style={{ borderLeft: `3px solid ${card.accent}` }}>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-tight">{card.label}</span>
              <span className={`text-sm font-bold leading-tight ${card.color}`}>{card.value}</span>
              {card.sub && <span className="text-[10px] text-slate-400">{card.sub} das NFs</span>}
            </div>
          ))}
        </div>

        {/* Tabela heatmap por departamento */}
        {deptRiskData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Depto','Total NFs','c/ Prej.','% Prej.','<−5%','<−10%','<−15%','<−20%','<−25%','Soma Prejuízo'].map(h => (
                    <th key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide py-1.5 px-2 text-right first:text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deptRiskData.map((s, i) => {
                  const heat = (pct: number) => {
                    if (pct === 0) return '';
                    if (pct < 10)  return 'bg-yellow-50 text-yellow-700';
                    if (pct < 20)  return 'bg-orange-50 text-orange-700';
                    if (pct < 35)  return 'bg-red-50 text-red-700';
                    return 'bg-red-100 text-red-800 font-bold';
                  };
                  return (
                    <tr key={s.dept} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="py-1.5 px-2 font-mono font-semibold text-slate-700">{deptName(s.dept)}</td>
                      <td className="py-1.5 px-2 text-right text-slate-500">{s.total}</td>
                      <td className="py-1.5 px-2 text-right text-rose-600 font-semibold">{s.withPrej}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctPrej)}`}>{fmtPct(s.pctPrej)}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctGt5)}`}>{s.gt5  > 0 ? `${s.gt5}  (${fmtPct(s.pctGt5)})` : '—'}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctGt10)}`}>{s.gt10 > 0 ? `${s.gt10} (${fmtPct(s.pctGt10)})` : '—'}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctGt15)}`}>{s.gt15 > 0 ? `${s.gt15} (${fmtPct(s.pctGt15)})` : '—'}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctGt20)}`}>{s.gt20 > 0 ? `${s.gt20} (${fmtPct(s.pctGt20)})` : '—'}</td>
                      <td className={`py-1.5 px-2 text-right rounded ${heat(s.pctGt25)}`}>{s.gt25 > 0 ? `${s.gt25} (${fmtPct(s.pctGt25)})` : '—'}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-rose-600">{fmtBRL(s.sumPrej)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Seção 8: Top 20 NFs com Prejuízo ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
        <SH right={
          <span className="text-[10px] text-slate-400">{prejuizoData.length} NF{prejuizoData.length !== 1 ? 's' : ''} com prejuízo</span>
        }>
          Top 20 NFs com Prejuízo
        </SH>
        {/* Filtro de departamento */}
        <div className="flex gap-1 flex-wrap mb-3">
          {availPrejuizoDepts.map(d => (
            <button
              key={d}
              onClick={() => setPrejuizoDept(d)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all border ${
                prejuizoDept === d ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-300 hover:text-rose-600'
              }`}
            >
              {deptName(d)}
            </button>
          ))}
        </div>
        {prejuizoData.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-xs text-emerald-600 font-semibold">
            Nenhum prejuízo no período selecionado 🎉
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[auto_1fr_2fr_2fr_1fr_1fr_1fr_1fr_1fr] gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
              <span className="w-5">#</span>
              <span>Nota Fiscal</span>
              <span>Cliente</span>
              <span>Vendedor</span>
              <span>Departamento</span>
              <span className="text-right">Rec. Bruta</span>
              <span className="text-right">Rec. Líq.</span>
              <span className="text-right">Prejuízo</span>
              <span className="text-right">% LB</span>
            </div>
            {(prejuizoExpanded ? prejuizoData : prejuizoData.slice(0, 5)).map((p, i) => {
              const maxPrej = Math.abs(prejuizoData[0].lucroBruto);
              const barW = maxPrej > 0 ? (Math.abs(p.lucroBruto) / maxPrej) * 100 : 0;
              return (
                <div key={i} className={`grid grid-cols-[auto_1fr_2fr_2fr_1fr_1fr_1fr_1fr_1fr] gap-3 items-center px-2 py-1.5 rounded-lg ${i % 2 === 0 ? '' : 'bg-slate-50/40'} hover:bg-rose-50/40 transition-colors`}>
                  <span className="w-5 text-[11px] font-bold text-slate-300 text-center">{i + 1}</span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-mono font-semibold text-slate-700">{p.nf}</span>
                    {p.serie && <span className="text-[10px] text-slate-400">Série {p.serie}</span>}
                  </div>
                  <span className="text-xs font-semibold text-slate-700 truncate">{p.cliente}</span>
                  <span className="text-xs text-slate-600 truncate">{p.vendedor}</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-slate-500 truncate">{deptName(p.depto)}</span>
                    <div className="h-1 rounded-full bg-rose-100 overflow-hidden">
                      <div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                  <span className="text-right text-xs font-mono text-slate-700">{fmtBRL(p.valorVenda)}</span>
                  <span className="text-right text-xs font-mono text-emerald-700">{fmtBRL(p.recLiq)}</span>
                  <span className="text-right text-xs font-mono font-bold text-rose-600">{fmtBRL(p.lucroBruto)}</span>
                  <span className="text-right text-xs font-mono font-bold text-rose-600">{fmtPct(p.lbPct)}</span>
                </div>
              );
            })}
            {prejuizoData.length > 5 && (
              <button
                onClick={() => setPrejuizoExpanded(e => !e)}
                className="mt-1 self-center px-4 py-1 rounded-full text-[11px] font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 transition-all"
              >
                {prejuizoExpanded ? 'Mostrar menos' : `Mostrar mais (${prejuizoData.length - 5} restantes)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Seção 8: Top Clientes ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
        <SH
          right={
            <div className="flex gap-1">
              <Pill label="Receita Bruta" active={clienteMetric === 'valorVenda'} onClick={() => setClienteMetric('valorVenda')} />
              <Pill label="Qtd NFs"       active={clienteMetric === 'nfs'}        onClick={() => setClienteMetric('nfs')} />
            </div>
          }
        >
          Top 15 Clientes
        </SH>
        {/* Filtro de departamento */}
        <div className="flex gap-1 flex-wrap mb-3">
          {availClienteDepts.map(d => (
            <button
              key={d}
              onClick={() => setClienteDept(d)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all border ${
                clienteDept === d ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              {deptName(d)}
            </button>
          ))}
        </div>
        {clienteData.length === 0 ? <Empty /> : (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[auto_3fr_1fr_1fr_1fr_1fr_1fr] gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
              <span className="w-5">#</span>
              <span>Cliente</span>
              <span className="text-right">NFs</span>
              <span className="text-right">Rec. Bruta</span>
              <span className="text-right">Rec. Líq.</span>
              <span className="text-right">Lucro Bruto</span>
              <span className="text-right">% LB</span>
            </div>
            {(clienteExpanded ? clienteData : clienteData.slice(0, 5)).map((c, i) => {
              const barW = clienteMax > 0 ? (c[clienteMetric] / clienteMax) * 100 : 0;
              return (
                <div key={i} className={`grid grid-cols-[auto_3fr_1fr_1fr_1fr_1fr_1fr] gap-3 items-center px-2 py-1.5 rounded-lg ${i % 2 === 0 ? '' : 'bg-slate-50/40'} hover:bg-violet-50/40 transition-colors`}>
                  <span className="w-5 text-[11px] font-bold text-slate-300 text-center">{i + 1}</span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-semibold text-slate-700 truncate">{c.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">{c.cidade}{c.cidade && c.estado ? ' — ' : ''}{c.estado}</span>
                      <div className="h-1 rounded-full bg-slate-100 flex-1 overflow-hidden">
                        <div className="h-full rounded-full bg-violet-300 transition-all" style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  </div>
                  <span className="text-right text-xs font-mono text-slate-600">{c.nfs}</span>
                  <span className="text-right text-xs font-mono text-slate-700">{fmtBRL(c.valorVenda)}</span>
                  <span className="text-right text-xs font-mono text-emerald-700">{fmtBRL(c.recLiq)}</span>
                  <span className={`text-right text-xs font-mono font-semibold ${c.lucroBruto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtBRL(c.lucroBruto)}</span>
                  <span className={`text-right text-xs font-mono font-bold ${c.lbPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtPct(c.lbPct)}</span>
                </div>
              );
            })}
            {clienteData.length > 5 && (
              <button
                onClick={() => setClienteExpanded(e => !e)}
                className="mt-1 self-center px-4 py-1 rounded-full text-[11px] font-bold text-violet-600 border border-violet-200 hover:bg-violet-50 transition-all"
              >
                {clienteExpanded ? 'Mostrar menos' : `Mostrar mais (${clienteData.length - 5} restantes)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Comparativo de Períodos ──────────────────────────────────────── */}
      <VPecasComparativo allRows={allRows} />
      </>}

      {analiseTab === 'itens' && <>
        {/* ── Filtro de Departamento (compartilhado) ─────────────────────── */}
        <div className="flex gap-1 flex-wrap">
          {availItemDepts.map(d => (
            <button
              key={d}
              onClick={() => setItemPrejuizoDept(d)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                itemPrejuizoDept === d ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-500 border-slate-200 hover:border-cyan-300 hover:text-cyan-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* ── Top 40 Itens com Prejuízo ───────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5" style={{ borderLeft: '4px solid #fb7185' }}>
          <SH right={<span className="text-[10px] text-slate-400">{itemPrejuizoData.length} item(s) com prejuízo</span>}>
            Top 40 Itens com Prejuízo
          </SH>
          <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 mb-3 text-xs text-blue-700">
            <span className="shrink-0 mt-0.5">ℹ️</span>
            <span>Esta análise exibe apenas os <strong>40 itens com maior impacto negativo no resultado</strong> dentro do período e departamento selecionados. Itens fora desse corte não aparecem nesta listagem.</span>
          </div>
          {itemPrejuizoData.length === 0 ? (
            <div className="flex items-center justify-center h-16 text-xs text-emerald-600 font-semibold">
              Nenhum item com prejuízo no período 🎉
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="grid grid-cols-[auto_1.2fr_2fr_1.5fr_1fr_1fr_0.5fr_1fr_1fr_1.2fr] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
                <span className="w-5">#</span>
                <span>Código</span>
                <span>Descrição</span>
                <span>Cliente</span>
                <span>NF / Transação</span>
                <span>Vendedor</span>
                <span className="text-right">Qtd</span>
                <span className="text-right">Rec. Líq.</span>
                <span className="text-right">Custo</span>
                <span className="text-right">Lucro Bruto</span>
              </div>
              {(itemPrejuizoExpanded ? itemPrejuizoData : itemPrejuizoData.slice(0, 5)).map((item, i) => (
                <div key={i} className="grid grid-cols-[auto_1.2fr_2fr_1.5fr_1fr_1fr_0.5fr_1fr_1fr_1.2fr] gap-2 items-center px-2 py-1.5 rounded-lg bg-rose-50/40 hover:bg-rose-50 transition-colors">
                  <span className="w-5 text-[11px] font-bold text-slate-300 text-center">{i + 1}</span>
                  <span className="text-xs font-mono text-slate-600 truncate">{item.codigo}</span>
                  <span className="text-xs text-slate-700 truncate">{item.descricao}</span>
                  <span className="text-xs text-slate-500 truncate">{item.cliente}</span>
                  <div className="flex flex-col gap-0">
                    <span className="text-xs font-mono text-slate-600 truncate">{item.nf}</span>
                    <span className="text-[10px] text-slate-400">{item.transacao}</span>
                  </div>
                  <span className="text-xs text-slate-500 truncate">{item.vendedor}</span>
                  <span className="text-right text-xs font-mono text-slate-600">{item.qtd}</span>
                  <span className="text-right text-xs font-mono text-slate-600">{fmtBRLF(item.recLiq)}</span>
                  <span className="text-right text-xs font-mono text-slate-600">{fmtBRLF(item.custo)}</span>
                  <span className="text-right text-xs font-mono font-bold text-rose-600">
                    {fmtBRLF(item.lucroBruto)} <span className="text-[10px] text-rose-400">({fmtPct(item.lbPct)})</span>
                  </span>
                </div>
              ))}
              {itemPrejuizoData.length > 5 && (
                <button
                  onClick={() => setItemPrejuizoExpanded(e => !e)}
                  className="mt-1 self-center px-4 py-1 rounded-full text-[11px] font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 transition-all"
                >
                  {itemPrejuizoExpanded ? 'Mostrar menos' : `Mostrar mais (${itemPrejuizoData.length - 5} restantes)`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Top 40 Itens com Lucro ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5" style={{ borderLeft: '4px solid #10b981' }}>
          <SH right={<span className="text-[10px] text-slate-400">{itemLucroData.length} item(s) com lucro</span>}>
            Top 40 Itens com Lucro
          </SH>
          <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 mb-3 text-xs text-blue-700">
            <span className="shrink-0 mt-0.5">ℹ️</span>
            <span>Esta análise exibe apenas os <strong>40 itens com maior impacto positivo no resultado</strong> dentro do período e departamento selecionados. Itens fora desse corte não aparecem nesta listagem.</span>
          </div>
          {itemLucroData.length === 0 ? (
            <div className="text-center text-sm text-slate-300 py-8">Nenhum item com lucro no período</div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="grid grid-cols-[auto_1.2fr_2fr_1.5fr_1fr_1fr_0.5fr_1fr_1fr_1.2fr] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
                <span className="w-5">#</span>
                <span>Código</span>
                <span>Descrição</span>
                <span>Cliente</span>
                <span>NF / Transação</span>
                <span>Vendedor</span>
                <span className="text-right">Qtd</span>
                <span className="text-right">Rec. Líq.</span>
                <span className="text-right">Custo</span>
                <span className="text-right">Lucro Bruto</span>
              </div>
              {(itemLucroExpanded ? itemLucroData : itemLucroData.slice(0, 5)).map((item, i) => (
                <div key={i} className="grid grid-cols-[auto_1.2fr_2fr_1.5fr_1fr_1fr_0.5fr_1fr_1fr_1.2fr] gap-2 items-center px-2 py-1.5 rounded-lg bg-emerald-50/40 hover:bg-emerald-50 transition-colors">
                  <span className="w-5 text-[11px] font-bold text-slate-300 text-center">{i + 1}</span>
                  <span className="text-xs font-mono text-slate-600 truncate">{item.codigo}</span>
                  <span className="text-xs text-slate-700 truncate">{item.descricao}</span>
                  <span className="text-xs text-slate-500 truncate">{item.cliente}</span>
                  <div className="flex flex-col gap-0">
                    <span className="text-xs font-mono text-slate-600 truncate">{item.nf}</span>
                    <span className="text-[10px] text-slate-400">{item.transacao}</span>
                  </div>
                  <span className="text-xs text-slate-500 truncate">{item.vendedor}</span>
                  <span className="text-right text-xs font-mono text-slate-600">{item.qtd}</span>
                  <span className="text-right text-xs font-mono text-slate-600">{fmtBRLF(item.recLiq)}</span>
                  <span className="text-right text-xs font-mono text-slate-600">{fmtBRLF(item.custo)}</span>
                  <span className="text-right text-xs font-mono font-bold text-emerald-700">
                    {fmtBRLF(item.lucroBruto)} <span className="text-[10px] text-emerald-500">({fmtPct(item.lbPct)})</span>
                  </span>
                </div>
              ))}
              {itemLucroData.length > 5 && (
                <button
                  onClick={() => setItemLucroExpanded(e => !e)}
                  className="mt-1 self-center px-4 py-1 rounded-full text-[11px] font-bold text-emerald-600 border border-emerald-200 hover:bg-emerald-50 transition-all"
                >
                  {itemLucroExpanded ? 'Mostrar menos' : `Mostrar mais (${itemLucroData.length - 5} restantes)`}
                </button>
              )}
            </div>
          )}
        </div>

      </>}

      {analiseTab === 'seg' && <VPecasSeguradoraAnalise />}
      {analiseTab === 'itemSeg' && <VPecasItemSeguradoraAnalise />}
    </div>
  );
}
