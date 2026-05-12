import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, LabelList, Legend,
} from 'recharts';
import { loadDreVw, type DreVwRow } from './dreVwStorage';
import { loadDreAudi, type DreAudiRow } from './dreAudiStorage';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

type DeptConfig = { key: string; label: string; color: string };

const VW_DEPTS: DeptConfig[] = [
  { key: 'novos',     label: 'Veículos Novos',            color: '#1d4ed8' },
  { key: 'direta',    label: 'Venda Direta',              color: '#0891b2' },
  { key: 'usados',    label: 'Veículos Usados',           color: '#7c3aed' },
  { key: 'pecas',     label: 'Peças e Acessórios',        color: '#059669' },
  { key: 'oficina',   label: 'Oficina / Assist. Técnica', color: '#d97706' },
  { key: 'funilaria', label: 'Funilaria',                 color: '#db2777' },
];

const AUDI_DEPTS: DeptConfig[] = [
  { key: 'novos',     label: 'Veículos Novos',            color: '#1d4ed8' },
  { key: 'usados',    label: 'Veículos Usados',           color: '#7c3aed' },
  { key: 'pecas',     label: 'Peças e Acessórios',        color: '#059669' },
  { key: 'oficina',   label: 'Oficina / Assist. Técnica', color: '#d97706' },
  { key: 'funilaria', label: 'Funilaria',                 color: '#db2777' },
];

const CON_DEPTS: DeptConfig[] = [
  { key: 'novos',     label: 'Veículos Novos',            color: '#1d4ed8' },
  { key: 'direta',    label: 'Venda Direta (VW)',         color: '#0891b2' },
  { key: 'usados',    label: 'Veículos Usados',           color: '#7c3aed' },
  { key: 'pecas',     label: 'Peças e Acessórios',        color: '#059669' },
  { key: 'oficina',   label: 'Oficina / Assist. Técnica', color: '#d97706' },
  { key: 'funilaria', label: 'Funilaria',                 color: '#db2777' },
];

type SubBrand = 'vw' | 'audi' | 'consolidado';

// Mapeamento deptKey → Department (para loadDREDataAsync)
const VW_DEPT_TO_DEPT: Record<string, Department> = {
  novos:     'novos',
  direta:    'vendaDireta',
  usados:    'usados',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
};

const AUDI_DEPT_TO_DEPT: Record<string, Department> = {
  novos:     'novos',
  usados:    'usados',
  pecas:     'pecas',
  oficina:   'oficina',
  funilaria: 'funilaria',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseVal(v: string | number | undefined | null): number {
  if (v == null || v === '') return 0;
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtK(v: number): string {
  if (Math.abs(v) >= 1_000_000)
    return (v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
  if (Math.abs(v) >= 1_000)
    return (v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + 'K';
  return fmtBRL(v);
}

/** Extrai ROL do resultado de loadDREDataAsync para um dado mês (0-based). */
function extractROL(dreLines: any[] | null, monthIdx: number): number {
  if (!dreLines) return 0;
  for (const line of dreLines) {
    const desc = ((line.descricao as string) || (line.label as string) || '').toUpperCase().trim();
    if (desc === 'RECEITA OPERACIONAL LIQUIDA') {
      const meses: number[] = line.meses || line.values || [];
      return meses[monthIdx] ?? 0;
    }
  }
  return 0;
}

/** ROL do KV manual (DreVwRow/DreAudiRow) para um dept. */
function getKvROL(row: DreVwRow | DreAudiRow | null, deptKey: string): number {
  if (!row) return 0;
  const dept = (row as Record<string, any>)[deptKey];
  if (!dept) return 0;
  return parseVal(dept.receitaOperacionalLiquida);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  year: number;
  month: number; // 0 = ano completo
}

export function ReceitaVendasEvolucaoTab({ year, month }: Props) {
  const [subBrand, setSubBrand] = useState<SubBrand>('vw');
  const [loading, setLoading] = useState(true);

  // KV manual (por mês, 0-based index)
  const [vwCurr,   setVwCurr]   = useState<(DreVwRow   | null)[]>([]);
  const [vwPrev,   setVwPrev]   = useState<(DreVwRow   | null)[]>([]);
  const [audiCurr, setAudiCurr] = useState<(DreAudiRow | null)[]>([]);
  const [audiPrev, setAudiPrev] = useState<(DreAudiRow | null)[]>([]);

  // DRE async (dashboard executivo) — por deptKey: { curr, prev }
  type DreLines = any[] | null;
  const [vwAsync,   setVwAsync]   = useState<Record<string, { curr: DreLines; prev: DreLines }>>({});
  const [audiAsync, setAudiAsync] = useState<Record<string, { curr: DreLines; prev: DreLines }>>({});

  const prevYear  = year - 1;
  const upToMonth = month === 0 ? 12 : month;

  useEffect(() => {
    setLoading(true);
    const months12 = Array.from({ length: 12 }, (_, i) => i + 1);
    const yr     = year     as 2024 | 2025 | 2026 | 2027;
    const prevYr = prevYear as 2024 | 2025 | 2026 | 2027;

    const vwDeptKeys   = Object.keys(VW_DEPT_TO_DEPT);
    const audiDeptKeys = Object.keys(AUDI_DEPT_TO_DEPT);

    Promise.all([
      // KV por mês
      Promise.all(months12.map(m => loadDreVw(year, m))),
      Promise.all(months12.map(m => loadDreVw(prevYear, m))),
      Promise.all(months12.map(m => loadDreAudi(year, m))),
      Promise.all(months12.map(m => loadDreAudi(prevYear, m))),
      // DRE async por dept (ano atual)
      Promise.all(vwDeptKeys.map(k =>
        loadDREDataAsync(yr, VW_DEPT_TO_DEPT[k], 'vw').then(d => ({ key: k, d }))
      )),
      Promise.all(vwDeptKeys.map(k =>
        loadDREDataAsync(prevYr, VW_DEPT_TO_DEPT[k], 'vw').then(d => ({ key: k, d }))
      )),
      Promise.all(audiDeptKeys.map(k =>
        loadDREDataAsync(yr, AUDI_DEPT_TO_DEPT[k], 'audi').then(d => ({ key: k, d }))
      )),
      Promise.all(audiDeptKeys.map(k =>
        loadDREDataAsync(prevYr, AUDI_DEPT_TO_DEPT[k], 'audi').then(d => ({ key: k, d }))
      )),
    ]).then(([vc, vp, ac, ap, vwCurrAsync, vwPrevAsync, audiCurrAsync, audiPrevAsync]) => {
      setVwCurr(vc);
      setVwPrev(vp);
      setAudiCurr(ac);
      setAudiPrev(ap);

      const vwMap: Record<string, { curr: DreLines; prev: DreLines }> = {};
      for (const { key, d } of vwCurrAsync) vwMap[key] = { curr: d, prev: null };
      for (const { key, d } of vwPrevAsync)  vwMap[key] = { ...vwMap[key], prev: d };
      setVwAsync(vwMap);

      const audiMap: Record<string, { curr: DreLines; prev: DreLines }> = {};
      for (const { key, d } of audiCurrAsync) audiMap[key] = { curr: d, prev: null };
      for (const { key, d } of audiPrevAsync)  audiMap[key] = { ...audiMap[key], prev: d };
      setAudiAsync(audiMap);

      setLoading(false);
    });
  }, [year, prevYear]);

  const depts          = subBrand === 'audi' ? AUDI_DEPTS : subBrand === 'vw' ? VW_DEPTS : CON_DEPTS;
  const brandColor     = subBrand === 'vw' ? '#001e50' : subBrand === 'audi' ? '#bb0a30' : '#7c3aed';
  const brandColorDark = subBrand === 'vw' ? '#001238' : subBrand === 'audi' ? '#9a0827' : '#5b21b6';

  function getVwROL(mIdx: number, deptKey: string, usePrev: boolean): number {
    const kv = usePrev ? vwPrev[mIdx] : vwCurr[mIdx];
    const kvVal = getKvROL(kv ?? null, deptKey);
    if (kvVal !== 0) return kvVal;
    const async_ = usePrev ? vwAsync[deptKey]?.prev : vwAsync[deptKey]?.curr;
    return extractROL(async_ ?? null, mIdx);
  }

  function getAudiROL(mIdx: number, deptKey: string, usePrev: boolean): number {
    const kv = usePrev ? audiPrev[mIdx] : audiCurr[mIdx];
    const kvVal = getKvROL(kv ?? null, deptKey);
    if (kvVal !== 0) return kvVal;
    const async_ = usePrev ? audiAsync[deptKey]?.prev : audiAsync[deptKey]?.curr;
    return extractROL(async_ ?? null, mIdx);
  }

  function getCurr(mIdx: number, deptKey: string): number {
    if (subBrand === 'vw')   return getVwROL(mIdx, deptKey, false);
    if (subBrand === 'audi') return getAudiROL(mIdx, deptKey, false);
    // consolidado — deptKey 'direta' só existe no VW
    return getVwROL(mIdx, deptKey, false) + (deptKey !== 'direta' ? getAudiROL(mIdx, deptKey, false) : 0);
  }

  function getPrev(mIdx: number, deptKey: string): number {
    if (subBrand === 'vw')   return getVwROL(mIdx, deptKey, true);
    if (subBrand === 'audi') return getAudiROL(mIdx, deptKey, true);
    return getVwROL(mIdx, deptKey, true) + (deptKey !== 'direta' ? getAudiROL(mIdx, deptKey, true) : 0);
  }

  const ytdIdxs   = Array.from({ length: upToMonth }, (_, i) => i); // 0-based

  const totalCurr = depts.reduce((s, d) => s + ytdIdxs.reduce((ms, i) => ms + getCurr(i, d.key), 0), 0);
  const totalPrev = depts.reduce((s, d) => s + ytdIdxs.reduce((ms, i) => ms + getPrev(i, d.key), 0), 0);
  const totalVar  = totalCurr - totalPrev;
  const totalPct  = totalPrev !== 0 ? (totalVar / totalPrev) * 100 : 0;

  // Chart data — grouped bars per month
  const chartData = ytdIdxs.map(i => ({
    month:          MONTHS_SHORT[i],
    [String(year)]:     depts.reduce((s, d) => s + getCurr(i, d.key), 0),
    [String(prevYear)]: depts.reduce((s, d) => s + getPrev(i, d.key), 0),
  }));

  // Horizontal bar — dept variation % sorted descending
  const deptVarData = depts.map(d => {
    const curr = ytdIdxs.reduce((s, i) => s + getCurr(i, d.key), 0);
    const prev = ytdIdxs.reduce((s, i) => s + getPrev(i, d.key), 0);
    const pct  = prev !== 0 ? ((curr - prev) / prev) * 100 : 0;
    const shortLabel = d.label.length > 22 ? d.label.substring(0, 20) + '…' : d.label;
    return { label: shortLabel, fullLabel: d.label, curr, prev, pct, color: d.color };
  }).sort((a, b) => b.pct - a.pct);

  // Table rows
  const tableRows = depts.map(d => {
    const monthVals = ytdIdxs.map(i => getCurr(i, d.key));
    const ytdC  = monthVals.reduce((s, v) => s + v, 0);
    const ytdP  = ytdIdxs.reduce((s, i) => s + getPrev(i, d.key), 0);
    const varR  = ytdC - ytdP;
    const varPct = ytdP !== 0 ? (varR / ytdP) * 100 : 0;
    return { label: d.label, color: d.color, monthVals, ytdCurr: ytdC, ytdPrev: ytdP, varR, varPct };
  });

  const totalMonthVals = ytdIdxs.map(i => depts.reduce((s, d) => s + getCurr(i, d.key), 0));

  const periodLabel =
    month === 0
      ? `Jan–Dez/${year} vs Jan–Dez/${prevYear}`
      : `Jan–${MONTHS_SHORT[month - 1]}/${year} vs Jan–${MONTHS_SHORT[month - 1]}/${prevYear}`;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
        <span className="text-sm text-slate-500">Carregando receitas...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6">

      {/* ── Sub-brand selector ──────────────────────────────────────────── */}
      <div className="flex gap-2">
        {(['vw', 'audi', 'consolidado'] as SubBrand[]).map(b => {
          const bColor = b === 'vw' ? '#001e50' : b === 'audi' ? '#bb0a30' : '#7c3aed';
          const bLabel = b === 'vw' ? 'VW Norte' : b === 'audi' ? 'Audi' : 'Consolidado';
          return (
            <button
              key={b}
              onClick={() => setSubBrand(b)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                subBrand === b
                  ? 'text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              style={subBrand === b ? { backgroundColor: bColor } : {}}
            >
              {bLabel}
            </button>
          );
        })}
      </div>

      {/* ── Title ───────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Análise Evolutiva de Receita de Vendas</h2>
        <p className="text-sm text-slate-500 mt-0.5">{periodLabel}</p>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Receita YTD {year}</p>
          <p className="text-2xl font-bold" style={{ color: brandColor }}>R$ {fmtBRL(totalCurr)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Receita YTD {prevYear}</p>
          <p className="text-2xl font-bold text-slate-400">R$ {fmtBRL(totalPrev)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Variação R$</p>
          <p className={`text-2xl font-bold ${totalVar >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalVar >= 0 ? '+' : ''}R$ {fmtBRL(totalVar)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Variação %</p>
          <p className={`text-2xl font-bold ${totalPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalPct >= 0 ? '+' : ''}{totalPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </p>
        </div>
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Left — grouped bars per month */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Receita Mensal — {year} vs {prevYear}</h3>
          <p className="text-xs text-slate-400 mb-3">Total consolidado de departamentos (excl. ADM)</p>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={chartData} barCategoryGap="25%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={52} />
              <Tooltip
                formatter={(value: any, name: any) => [`R$ ${fmtBRL(Number(value))}`, name]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey={String(year)}     fill={brandColor} radius={[3, 3, 0, 0]} name={String(year)} />
              <Bar dataKey={String(prevYear)} fill="#cbd5e1"    radius={[3, 3, 0, 0]} name={String(prevYear)} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right — horizontal bar with dept variation % */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Variação por Departamento — YTD</h3>
          <p className="text-xs text-slate-400 mb-3">% de crescimento vs mesmo período de {prevYear}</p>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart layout="vertical" data={deptVarData} margin={{ top: 0, right: 64, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
                width={155}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-xs">
                      <p className="font-bold text-slate-700 mb-1.5">{d.fullLabel}</p>
                      <p className="text-slate-600">{year}: <span className="font-semibold">R$ {fmtBRL(d.curr)}</span></p>
                      <p className="text-slate-400">{prevYear}: R$ {fmtBRL(d.prev)}</p>
                      <p className={`font-bold mt-1 ${d.pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {d.pct >= 0 ? '+' : ''}{d.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {deptVarData.map((entry, index) => (
                  <Cell key={index} fill={entry.pct >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
                ))}
                <LabelList
                  dataKey="pct"
                  position="right"
                  formatter={(v: any) => `${Number(v) > 0 ? '+' : ''}${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                  style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Receita Operacional Líquida por Departamento</h3>
          <p className="text-xs text-slate-400 mt-0.5">R$ — acumulado Jan a {MONTHS_SHORT[upToMonth - 1]}/{year} · comparação com {prevYear}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide sticky left-0 bg-slate-50 min-w-[168px] whitespace-nowrap">Departamento</th>
                {ytdIdxs.map(i => (
                  <th key={i} className="px-3 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                    {MONTHS_SHORT[i]}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-semibold text-slate-700 uppercase tracking-wide whitespace-nowrap bg-slate-100">Total YTD</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">vs {prevYear}</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">Var R$</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">Var %</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-2.5 sticky left-0 bg-white font-medium text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                      {row.label}
                    </div>
                  </td>
                  {row.monthVals.map((v, mi) => (
                    <td key={mi} className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                      {v !== 0 ? fmtBRL(v) : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800 bg-slate-50 tabular-nums">
                    {row.ytdCurr !== 0 ? fmtBRL(row.ytdCurr) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">
                    {row.ytdPrev !== 0 ? fmtBRL(row.ytdPrev) : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${row.varR >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {row.ytdPrev !== 0 ? `${row.varR >= 0 ? '+' : ''}${fmtBRL(row.varR)}` : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${row.varPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {row.ytdPrev !== 0
                      ? `${row.varPct >= 0 ? '+' : ''}${row.varPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                      : '—'}
                  </td>
                </tr>
              ))}

              {/* Total row */}
              <tr>
                <td
                  className="px-4 py-3 sticky left-0 font-bold uppercase tracking-wide text-white whitespace-nowrap"
                  style={{ backgroundColor: brandColor }}
                >
                  TOTAL
                </td>
                {totalMonthVals.map((v, mi) => (
                  <td
                    key={mi}
                    className="px-3 py-3 text-right font-semibold text-white tabular-nums"
                    style={{ backgroundColor: brandColor }}
                  >
                    {v !== 0 ? fmtBRL(v) : '—'}
                  </td>
                ))}
                <td className="px-3 py-3 text-right font-bold text-white tabular-nums" style={{ backgroundColor: brandColorDark }}>
                  {fmtBRL(totalCurr)}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-white/75 tabular-nums" style={{ backgroundColor: brandColor }}>
                  {fmtBRL(totalPrev)}
                </td>
                <td className="px-3 py-3 text-right font-bold text-white tabular-nums" style={{ backgroundColor: brandColor }}>
                  {totalVar >= 0 ? '+' : ''}{fmtBRL(totalVar)}
                </td>
                <td className="px-3 py-3 text-right font-bold text-white tabular-nums" style={{ backgroundColor: brandColor }}>
                  {totalPrev !== 0
                    ? `${totalPct >= 0 ? '+' : ''}${totalPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                    : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
