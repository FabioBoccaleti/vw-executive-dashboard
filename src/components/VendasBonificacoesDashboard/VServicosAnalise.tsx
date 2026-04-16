import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Cell, PieChart, Pie, LabelList, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { loadVPecasRows, type VPecasRow } from './vPecasStorage';
import VServicosConsultorAnalise from './VServicosConsultorAnalise';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const PALETTE  = ['#7c3aed','#a78bfa','#06b6d4','#10b981','#f59e0b','#f97316','#ef4444','#e879f9','#84cc16','#3b82f6','#fb7185','#fbbf24'];
const TEAL     = '#0d9488';
const TEAL2    = '#14b8a6';
const EMERALD  = '#10b981';
const ROSE     = '#f43f5e';
const AMBER    = '#f59e0b';
const INDIGO   = '#6366f1';
const CYAN     = '#06b6d4';

// ─── Configuração de sub-abas ─────────────────────────────────────────────────
type ServicoTab = 'oficina' | 'funilaria' | 'acessorios';

const SERVICO_CONFIG: Record<ServicoTab, { label: string; depts: string[]; color: string; accent: string }> = {
  oficina:    { label: 'Oficina',    depts: ['104', '122'], color: TEAL,   accent: 'border-teal-500 text-teal-700 bg-teal-50' },
  funilaria:  { label: 'Funilaria',  depts: ['106', '129'], color: INDIGO, accent: 'border-indigo-500 text-indigo-700 bg-indigo-50' },
  acessorios: { label: 'Acessórios', depts: ['107'],        color: AMBER,  accent: 'border-amber-500 text-amber-700 bg-amber-50' },
};

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

// ─── Cálculo por linha (sem custo) ────────────────────────────────────────────
interface Calc {
  valorVenda: number;
  iss: number;
  icms: number;
  pis: number;
  cofins: number;
  difal: number;
  totalImpostos: number;
  recLiq: number;
}
function calcRow(d: Record<string, string>): Calc {
  const valorVenda    = n(d['LIQ_NOTA_FISCAL']);
  const iss           = n(d['VAL_ISS']);
  const icms          = n(d['VAL_ICMS']);
  const pis           = n(d['VAL_PIS']);
  const cofins        = n(d['VAL_COFINS']);
  const difal         = n(d['VAL_ICMS_PARTIL_UF_DEST']) + n(d['VAL_ICMS_COMB_POBREZA']);
  const totalImpostos = iss + icms + pis + cofins + difal;
  const recLiq        = valorVenda - totalImpostos;
  return { valorVenda, iss, icms, pis, cofins, difal, totalImpostos, recLiq };
}

// ─── Agregador ────────────────────────────────────────────────────────────────
interface Agg {
  nfs: number;
  valorVenda: number;
  iss: number;
  icms: number;
  pis: number;
  cofins: number;
  difal: number;
  totalImpostos: number;
  recLiq: number;
}
function agg(rows: VPecasRow[]): Agg {
  let nfs = 0, valorVenda = 0, iss = 0, icms = 0, pis = 0, cofins = 0, difal = 0, totalImpostos = 0, recLiq = 0;
  for (const r of rows) {
    const c = calcRow(r.data);
    nfs++; valorVenda += c.valorVenda; iss += c.iss; icms += c.icms; pis += c.pis;
    cofins += c.cofins; difal += c.difal; totalImpostos += c.totalImpostos; recLiq += c.recLiq;
  }
  return { nfs, valorVenda, iss, icms, pis, cofins, difal, totalImpostos, recLiq };
}

// ─── Filtro por departamento ──────────────────────────────────────────────────
function filterByDepts(rows: VPecasRow[], depts: string[]): VPecasRow[] {
  return rows.filter(r => {
    const dept = r.data['DEPARTAMENTO']?.trim() ?? '';
    return depts.includes(dept);
  });
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
          <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && total !== 0 && (
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
          <span className="font-bold text-slate-600">Total</span>
          <span className="font-mono font-bold text-slate-700">{fmtBRLF(total)}</span>
        </div>
      )}
    </div>
  );
}

function Pill({ label, active, onClick, activeClass }: { label: string; active: boolean; onClick: () => void; activeClass?: string }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all border ${
        active
          ? (activeClass ?? 'bg-teal-600 text-white border-teal-600 shadow-sm')
          : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300 hover:text-teal-600'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Painel de análise de uma categoria ──────────────────────────────────────
function ServicoPanel({ rows, color }: { rows: VPecasRow[]; color: string }) {
  const curYear = new Date().getFullYear();
  const [year, setYear]   = useState(curYear);
  const [month, setMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [vendorSort, setVendorSort] = useState<'valorVenda' | 'nfs' | 'recLiq'>('valorVenda');
  const [estadoMetric, setEstadoMetric] = useState<'valorVenda' | 'recLiq' | 'totalImpostos'>('valorVenda');
  const [clienteMetric, setClienteMetric] = useState<'valorVenda' | 'nfs'>('valorVenda');
  const [vendorExpanded, setVendorExpanded] = useState(false);
  const [estadoExpanded, setEstadoExpanded] = useState(false);
  const [clienteExpanded, setClienteExpanded] = useState(false);

  const availYears = useMemo(() => {
    const s = new Set(rows.map(getYr).filter(y => y > 2000));
    [curYear - 1, curYear].forEach(y => s.add(y));
    return [...s].sort();
  }, [rows, curYear]);

  const yearRows = useMemo(() => rows.filter(r => getYr(r) === year), [rows, year]);

  const filteredRows = useMemo(() => yearRows.filter(r =>
    month === null || getMo(r) === month
  ), [yearRows, month]);

  const prevRows = useMemo(() => {
    if (month === null) return [];
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    return rows.filter(r => getYr(r) === py && getMo(r) === pm);
  }, [rows, month, year]);

  const metrics     = useMemo(() => agg(filteredRows), [filteredRows]);
  const prevMetrics = useMemo(() => agg(prevRows),     [prevRows]);

  const delta = (cur: number, prev: number) =>
    prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : undefined;

  // Evolução mensal
  const monthlyData = useMemo(() => MS.map((label, i) => {
    const mr = yearRows.filter(r => getMo(r) === i + 1);
    const a  = agg(mr);
    return { label, valorVenda: a.valorVenda, totalImpostos: a.totalImpostos, recLiq: a.recLiq };
  }), [yearRows]);

  // Por tipo de transação
  const transacaoData = useMemo(() => {
    const map = new Map<string, VPecasRow[]>();
    for (const r of filteredRows) {
      const k = r.data['TIPO_TRANSACAO']?.trim() || '(sem tipo)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rs]) => {
      const a = agg(rs);
      return { name, valorVenda: a.valorVenda, totalImpostos: a.totalImpostos, recLiq: a.recLiq };
    }).sort((a, b) => b.valorVenda - a.valorVenda);
  }, [filteredRows]);

  // Composição impostos
  const impostosData = useMemo(() => {
    const a = metrics;
    const total = a.totalImpostos;
    return [
      { name: 'ISS',    value: a.iss,    color: TEAL,    pct: total ? a.iss    / total * 100 : 0 },
      { name: 'ICMS',   value: a.icms,   color: INDIGO,  pct: total ? a.icms   / total * 100 : 0 },
      { name: 'PIS',    value: a.pis,    color: CYAN,    pct: total ? a.pis    / total * 100 : 0 },
      { name: 'COFINS', value: a.cofins, color: EMERALD, pct: total ? a.cofins / total * 100 : 0 },
      { name: 'Difal',  value: a.difal,  color: AMBER,   pct: total ? a.difal  / total * 100 : 0 },
    ].filter(d => d.value > 0);
  }, [metrics]);

  // Vendedores
  const vendorData = useMemo(() => {
    const map = new Map<string, VPecasRow[]>();
    for (const r of filteredRows) {
      const k = r.data['NOME_VENDEDOR']?.trim() || '(sem nome)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rs]) => {
      const a = agg(rs);
      return { name, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq };
    }).sort((a, b) => b[vendorSort] - a[vendorSort]);
  }, [filteredRows, vendorSort]);

  const vendorMax = useMemo(() => Math.max(...vendorData.map(v => v[vendorSort]), 1), [vendorData, vendorSort]);

  // Por estado
  const estadoData = useMemo(() => {
    const map = new Map<string, VPecasRow[]>();
    for (const r of filteredRows) {
      const k = r.data['ESTADO']?.trim() || '(sem UF)';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([name, rs]) => {
      const a = agg(rs);
      return { name, valorVenda: a.valorVenda, totalImpostos: a.totalImpostos, recLiq: a.recLiq };
    }).sort((a, b) => b[estadoMetric] - a[estadoMetric]).slice(0, 20);
  }, [filteredRows, estadoMetric]);

  // Top clientes
  const clienteData = useMemo(() => {
    const map = new Map<string, { rs: VPecasRow[]; cidade: string; estado: string }>();
    for (const r of filteredRows) {
      const k = r.data['NOME_CLIENTE']?.trim() || '(sem nome)';
      const ex = map.get(k);
      if (ex) ex.rs.push(r);
      else map.set(k, { rs: [r], cidade: r.data['CIDADE'] ?? '', estado: r.data['ESTADO'] ?? '' });
    }
    return [...map.entries()].map(([name, { rs, cidade, estado }]) => {
      const a = agg(rs);
      return { name, nfs: a.nfs, valorVenda: a.valorVenda, recLiq: a.recLiq, cidade, estado };
    }).sort((a, b) => b[clienteMetric] - a[clienteMetric]).slice(0, 15);
  }, [filteredRows, clienteMetric]);

  const clienteMax = useMemo(() => Math.max(...clienteData.map(c => c[clienteMetric]), 1), [clienteData, clienteMetric]);

  const vendorSortLabel: Record<typeof vendorSort, string> = { valorVenda: 'Receita Bruta', nfs: 'Qtd NFs', recLiq: 'Rec. Líquida' };
  const estadoMetricLabel: Record<typeof estadoMetric, string> = { valorVenda: 'Receita Bruta', recLiq: 'Rec. Líquida', totalImpostos: 'Impostos' };
  const clienteMetricLabel: Record<typeof clienteMetric, string> = { valorVenda: 'Receita Bruta', nfs: 'Qtd NFs' };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 px-6 py-5 space-y-6" style={{ minHeight: 0 }}>
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          ANO
          <select
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
          >
            {availYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setMonth(null)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${month === null ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Ano todo
          </button>
          {MS.map((m, i) => (
            <button
              key={m}
              onClick={() => setMonth(i + 1)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${month === i + 1 ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-slate-400">{filteredRows.length} NF{filteredRows.length !== 1 ? 's' : ''}</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total de NFs"
          value={metrics.nfs.toLocaleString('pt-BR')}
          accent={color}
          delta={month !== null ? delta(metrics.nfs, prevMetrics.nfs) : undefined}
        />
        <KpiCard
          label="Receita Bruta"
          value={fmtBRL(metrics.valorVenda)}
          color="text-teal-700"
          accent={color}
          delta={month !== null ? delta(metrics.valorVenda, prevMetrics.valorVenda) : undefined}
        />
        <KpiCard
          label="Total Impostos"
          value={fmtBRL(metrics.totalImpostos)}
          color="text-rose-600"
          accent={ROSE}
          sub={metrics.valorVenda ? fmtPct(metrics.totalImpostos / metrics.valorVenda * 100) + ' da receita' : undefined}
        />
        <KpiCard
          label="Receita Líquida"
          value={fmtBRL(metrics.recLiq)}
          color="text-emerald-700"
          accent={EMERALD}
          delta={month !== null ? delta(metrics.recLiq, prevMetrics.recLiq) : undefined}
        />
      </div>

      {/* Evolução Mensal */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
        <SH>Evolução Mensal — {year}</SH>
        {yearRows.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyData} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} width={58} />
              <Tooltip content={<TipBRL />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="valorVenda" name="Receita Bruta" fill={color} fillOpacity={0.7} radius={[3, 3, 0, 0]}>
                {monthlyData.map((_, i) => (
                  <Cell key={i} fill={color} fillOpacity={month === i + 1 ? 1 : 0.4} />
                ))}
              </Bar>
              <Bar dataKey="totalImpostos" name="Impostos" fill={ROSE} fillOpacity={0.7} radius={[3, 3, 0, 0]}>
                {monthlyData.map((_, i) => (
                  <Cell key={i} fill={ROSE} fillOpacity={month === i + 1 ? 1 : 0.4} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="recLiq" name="Rec. Líquida" stroke={EMERALD} strokeWidth={2.5} dot={{ r: 3, fill: EMERALD }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Por Tipo de Transação */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
        <SH>Por Tipo de Transação</SH>
        {transacaoData.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={Math.max(200, transacaoData.length * 30 + 40)}>
            <BarChart data={transacaoData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} width={55} />
              <Tooltip
                content={(props: any) => {
                  const { active, payload, label } = props;
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[200px]">
                      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
                      {payload.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between gap-4">
                          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
                          <span className="font-mono text-slate-700">{fmtBRLF(p.value)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="valorVenda"    name="Receita Bruta" fill={color}   radius={[3, 3, 0, 0]} />
              <Bar dataKey="totalImpostos" name="Impostos"      fill={ROSE}    radius={[3, 3, 0, 0]} />
              <Bar dataKey="recLiq"        name="Rec. Líquida"  fill={EMERALD} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Composição Impostos + Por Estado (2 colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Composição Impostos */}
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
                  <span /><span>Imposto</span><span className="text-right">Valor</span><span className="text-right">% Rec.</span>
                </div>
                {impostosData.map((d, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-center">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-xs font-semibold text-slate-700">{d.name}</span>
                    <span className="text-xs font-mono text-slate-600 text-right">{fmtBRL(d.value)}</span>
                    <span className="text-xs font-mono text-slate-400 text-right">
                      {fmtPct(metrics.valorVenda ? d.value / metrics.valorVenda * 100 : 0)}
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-center border-t border-slate-100 pt-1 mt-1">
                  <div className="w-2.5 h-2.5" />
                  <span className="text-xs font-bold text-slate-800">Total</span>
                  <span className="text-xs font-mono font-bold text-slate-800 text-right">{fmtBRL(metrics.totalImpostos)}</span>
                  <span className="text-xs font-mono font-bold text-slate-500 text-right">
                    {fmtPct(metrics.valorVenda ? metrics.totalImpostos / metrics.valorVenda * 100 : 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Por Estado */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
          <SH
            right={
              <div className="flex gap-1">
                {(['valorVenda', 'recLiq', 'totalImpostos'] as const).map(m => (
                  <Pill key={m} label={estadoMetricLabel[m]} active={estadoMetric === m} onClick={() => setEstadoMetric(m)} />
                ))}
              </div>
            }
          >
            Por Estado (Top 20)
          </SH>
          {estadoData.length === 0 ? <Empty /> : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(140, (estadoExpanded ? estadoData.length : Math.min(5, estadoData.length)) * 28 + 20)}>
                <BarChart
                  layout="vertical"
                  data={estadoExpanded ? estadoData : estadoData.slice(0, 5)}
                  margin={{ top: 0, right: 80, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} width={40} />
                  <Tooltip content={<TipBRL />} />
                  <Bar dataKey={estadoMetric} name={estadoMetricLabel[estadoMetric]} radius={[0, 4, 4, 0]}>
                    {(estadoExpanded ? estadoData : estadoData.slice(0, 5)).map((_, i) => (
                      <Cell key={i} fill={estadoMetric === 'totalImpostos' ? ROSE : color} fillOpacity={0.75} />
                    ))}
                    <LabelList
                      dataKey={estadoMetric}
                      position="right"
                      formatter={(v: number) => fmtBRL(v)}
                      style={{ fontSize: 10, fill: '#64748b' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {estadoData.length > 5 && (
                <button
                  onClick={() => setEstadoExpanded(e => !e)}
                  className="mt-2 self-center block mx-auto px-4 py-1 rounded-full text-[11px] font-bold text-teal-600 border border-teal-200 hover:bg-teal-50 transition-all"
                >
                  {estadoExpanded ? 'Mostrar menos' : `Mostrar mais (${estadoData.length - 5} restantes)`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Ranking Vendedores */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
        <SH
          right={
            <div className="flex gap-1">
              {(['valorVenda', 'nfs', 'recLiq'] as const).map(m => (
                <Pill key={m} label={vendorSortLabel[m]} active={vendorSort === m} onClick={() => setVendorSort(m)} />
              ))}
            </div>
          }
        >
          Ranking de Vendedores
        </SH>
        {vendorData.length === 0 ? <Empty /> : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
              <span>Vendedor</span>
              <span className="text-right">NFs</span>
              <span className="text-right">Rec. Bruta</span>
              <span className="text-right">Rec. Líquida</span>
            </div>
            {(vendorExpanded ? vendorData : vendorData.slice(0, 8)).map((v, i) => {
              const barW = vendorMax > 0 ? (v[vendorSort] / vendorMax) * 100 : 0;
              const medalColors = ['#f59e0b','#9ca3af','#cd7f32'];
              return (
                <div key={i} className={`grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 items-center px-2 py-1.5 rounded-lg hover:bg-teal-50/40 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      {i < 3 && (
                        <span className="text-[10px] font-black w-4 text-center" style={{ color: medalColors[i] }}>{['①','②','③'][i]}</span>
                      )}
                      <span className="text-xs font-semibold text-slate-700 truncate">{v.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 rounded-full bg-slate-100 flex-1 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${barW}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                  <span className="text-right text-xs font-mono text-slate-600">{v.nfs}</span>
                  <span className="text-right text-xs font-mono text-slate-700">{fmtBRL(v.valorVenda)}</span>
                  <span className="text-right text-xs font-mono text-emerald-700">{fmtBRL(v.recLiq)}</span>
                </div>
              );
            })}
            {vendorData.length > 8 && (
              <button
                onClick={() => setVendorExpanded(e => !e)}
                className="mt-1 self-center px-4 py-1 rounded-full text-[11px] font-bold text-teal-600 border border-teal-200 hover:bg-teal-50 transition-all"
              >
                {vendorExpanded ? 'Mostrar menos' : `Mostrar mais (${vendorData.length - 8} restantes)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Top Clientes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-5">
        <SH
          right={
            <div className="flex gap-1">
              {(['valorVenda', 'nfs'] as const).map(m => (
                <Pill key={m} label={clienteMetricLabel[m]} active={clienteMetric === m} onClick={() => setClienteMetric(m)} />
              ))}
            </div>
          }
        >
          Top Clientes
        </SH>
        {clienteData.length === 0 ? <Empty /> : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[2fr_0.8fr_0.8fr_1fr_1fr] gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-1 border-b border-slate-100">
              <span>Cliente</span>
              <span>Cidade</span>
              <span>UF</span>
              <span className="text-right">NFs</span>
              <span className="text-right">Rec. Bruta</span>
            </div>
            {(clienteExpanded ? clienteData : clienteData.slice(0, 8)).map((c, i) => {
              const barW = clienteMax > 0 ? (c[clienteMetric] / clienteMax) * 100 : 0;
              return (
                <div key={i} className={`grid grid-cols-[2fr_0.8fr_0.8fr_1fr_1fr] gap-3 items-center px-2 py-1.5 rounded-lg hover:bg-teal-50/40 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-semibold text-slate-700 truncate">{c.name}</span>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${barW}%`, background: color }} />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 truncate">{c.cidade}</span>
                  <span className="text-xs text-slate-500">{c.estado}</span>
                  <span className="text-right text-xs font-mono text-slate-600">{c.nfs}</span>
                  <span className="text-right text-xs font-mono text-slate-700">{fmtBRL(c.valorVenda)}</span>
                </div>
              );
            })}
            {clienteData.length > 8 && (
              <button
                onClick={() => setClienteExpanded(e => !e)}
                className="mt-1 self-center px-4 py-1 rounded-full text-[11px] font-bold text-teal-600 border border-teal-200 hover:bg-teal-50 transition-all"
              >
                {clienteExpanded ? 'Mostrar menos' : `Mostrar mais (${clienteData.length - 8} restantes)`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VServicosAnalise() {
  const [allRows, setAllRows]   = useState<VPecasRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<ServicoTab>('oficina');
  const [oficinaInnerTab, setOficinaInnerTab]       = useState<'analise' | 'consultor'>('analise');
  const [funilariaInnerTab, setFunilariaInnerTab]   = useState<'analise' | 'consultor'>('analise');
  const [acessoriosInnerTab, setAcessoriosInnerTab] = useState<'analise' | 'consultor'>('analise');

  useEffect(() => {
    loadVPecasRows().then(rows => {
      setAllRows(rows.filter(r => r.data['SERIE_NOTA_FISCAL'] === 'RPS'));
      setLoading(false);
    });
  }, []);

  const tabRows = useMemo(() =>
    filterByDepts(allRows, SERVICO_CONFIG[activeTab].depts)
  , [allRows, activeTab]);

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
        <span className="text-sm">Nenhum dado encontrado — importe V. Peças (SERIE = RPS) na aba Registros</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      {/* Sub-tabs principais */}
      <div className="flex gap-1 bg-white border-b border-slate-200 px-5 py-2 flex-shrink-0">
        {(Object.keys(SERVICO_CONFIG) as ServicoTab[]).map(tab => {
          const cfg = SERVICO_CONFIG[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${
                isActive ? cfg.accent + ' shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-100'
              }`}
            >
              {cfg.label}
            </button>
          );
        })}
        <span className="ml-auto self-center text-[11px] text-slate-400 pr-1">
          {tabRows.length} NF{tabRows.length !== 1 ? 's' : ''} · Depts: {SERVICO_CONFIG[activeTab].depts.join(', ')}
        </span>
      </div>

      {/* Inner tabs da Oficina */}
      {activeTab === 'oficina' && (
        <div className="flex gap-1 bg-slate-50 border-b border-slate-200 px-5 py-1.5 flex-shrink-0">
          <button
            onClick={() => setOficinaInnerTab('analise')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
              oficinaInnerTab === 'analise'
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300 hover:text-teal-600'
            }`}
          >
            Análise Geral
          </button>
          <button
            onClick={() => setOficinaInnerTab('consultor')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
              oficinaInnerTab === 'consultor'
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300 hover:text-teal-600'
            }`}
          >
            Por Consultor
          </button>
        </div>
      )}

      {/* Inner tabs da Funilaria */}
      {activeTab === 'funilaria' && (
        <div className="flex gap-1 bg-slate-50 border-b border-slate-200 px-5 py-1.5 flex-shrink-0">
          <button
            onClick={() => setFunilariaInnerTab('analise')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
              funilariaInnerTab === 'analise'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            Análise Geral
          </button>
          <button
            onClick={() => setFunilariaInnerTab('consultor')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
              funilariaInnerTab === 'consultor'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            Por Consultor
          </button>
        </div>
      )}

      {/* Inner tabs de Acessórios */}
      {activeTab === 'acessorios' && (
        <div className="flex gap-1 bg-slate-50 border-b border-slate-200 px-5 py-1.5 flex-shrink-0">
          <button
            onClick={() => setAcessoriosInnerTab('analise')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
              acessoriosInnerTab === 'analise'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600'
            }`}
          >
            Análise Geral
          </button>
          <button
            onClick={() => setAcessoriosInnerTab('consultor')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
              acessoriosInnerTab === 'consultor'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600'
            }`}
          >
            Por Consultor
          </button>
        </div>
      )}

      {/* Painel da sub-tab ativa */}
      {activeTab === 'oficina' && oficinaInnerTab === 'consultor'
        ? <VServicosConsultorAnalise servicosRows={tabRows} pecasDepts={['104', '122']} />
        : activeTab === 'funilaria' && funilariaInnerTab === 'consultor'
        ? <VServicosConsultorAnalise servicosRows={tabRows} pecasDepts={['106', '129']} />
        : activeTab === 'acessorios' && acessoriosInnerTab === 'consultor'
        ? <VServicosConsultorAnalise servicosRows={tabRows} pecasDepts={['107']} />
        : <ServicoPanel key={activeTab} rows={tabRows} color={SERVICO_CONFIG[activeTab].color} />
      }
    </div>
  );
}
