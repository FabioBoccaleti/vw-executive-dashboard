import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
} from 'recharts';
import { loadDREDataAsync } from '@/lib/dbStorage';
import type { Department } from '@/lib/dataStorage';

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const STRONG_RED = '#bb0a30';

type SubBrand = 'vw' | 'audi' | 'consolidado';
type DreLines = any[] | null;

type DeptConfig = { key: string; label: string; color: string };

type ExpenseGroup = {
  key: string;
  label: string;
  matchers: string[];
};

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

const VW_DEPT_TO_DEPT: Record<string, Department> = {
  novos: 'novos',
  direta: 'vendaDireta',
  usados: 'usados',
  pecas: 'pecas',
  oficina: 'oficina',
  funilaria: 'funilaria',
};

const AUDI_DEPT_TO_DEPT: Record<string, Department> = {
  novos: 'novos',
  usados: 'usados',
  pecas: 'pecas',
  oficina: 'oficina',
  funilaria: 'funilaria',
};

const EXPENSE_GROUPS: ExpenseGroup[] = [
  {
    key: 'outrasDespesasOperacionais',
    label: 'Outras Despesas Operacionais',
    matchers: ['OUTRAS DESPESAS OPERACIONAIS'],
  },
  {
    key: 'despPessoal',
    label: 'Despesas c/ Pessoal',
    matchers: ['DESPESAS C PESSOAL', 'DESPESAS COM PESSOAL'],
  },
  {
    key: 'despServTerceiros',
    label: 'Despesas c/ Serv. de Terceiros',
    matchers: ['DESPESAS C SERV DE TERCEIROS', 'DESPESAS COM SERV DE TERCEIROS'],
  },
  {
    key: 'despOcupacao',
    label: 'Despesas c/ Ocupação',
    matchers: ['DESPESAS C OCUPACAO', 'DESPESAS COM OCUPACAO'],
  },
  {
    key: 'despFuncionamento',
    label: 'Despesas c/ Funcionamento',
    matchers: ['DESPESAS C FUNCIONAMENTO', 'DESPESAS COM FUNCIONAMENTO'],
  },
  {
    key: 'despVendas',
    label: 'Despesas c/ Vendas',
    matchers: ['DESPESAS C VENDAS', 'DESPESAS COM VENDAS'],
  },
  {
    key: 'amortizacoesDepreciacoes',
    label: 'Amortizações e Depreciações',
    matchers: ['AMORTIZACOES E DEPRECIACOES'],
  },
];

function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtK(v: number): string {
  if (Math.abs(v) >= 1_000_000) {
    return (v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M';
  }
  if (Math.abs(v) >= 1_000) {
    return (v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + 'K';
  }
  return fmtBRL(v);
}

function extractExpenseGroupsByMonth(dreLines: DreLines, monthIdx: number): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(EXPENSE_GROUPS.map(g => [g.key, 0]));
  if (!dreLines) return result;

  for (const line of dreLines) {
    const rawDesc = ((line?.descricao as string) || (line?.label as string) || '').trim();
    if (!rawDesc) continue;
    const desc = normalizeText(rawDesc);

    const matchedGroup = EXPENSE_GROUPS.find(group =>
      group.matchers.some(m => desc.includes(normalizeText(m))),
    );
    if (!matchedGroup) continue;

    const meses: number[] = line?.meses || line?.values || [];
    const value = Math.abs(Number(meses[monthIdx] ?? 0));
    result[matchedGroup.key] += value;
  }

  return result;
}

interface Props {
  year: number;
  month: number; // 0 = ano completo
}

export function DespesasDepartamentoEvolucaoTab({ year, month }: Props) {
  const [subBrand, setSubBrand] = useState<SubBrand>('vw');
  const [loading, setLoading] = useState(true);
  const [vwAsync, setVwAsync] = useState<Record<string, { curr: DreLines; prev: DreLines }>>({});
  const [audiAsync, setAudiAsync] = useState<Record<string, { curr: DreLines; prev: DreLines }>>({});

  const prevYear = year - 1;
  const upToMonth = month === 0 ? 12 : month;
  const ytdIdxs = Array.from({ length: upToMonth }, (_, i) => i);

  useEffect(() => {
    setLoading(true);

    const yr = year as 2024 | 2025 | 2026 | 2027;
    const prevYr = prevYear as 2024 | 2025 | 2026 | 2027;
    const vwDeptKeys = Object.keys(VW_DEPT_TO_DEPT);
    const audiDeptKeys = Object.keys(AUDI_DEPT_TO_DEPT);

    Promise.all([
      Promise.all(vwDeptKeys.map(k => loadDREDataAsync(yr, VW_DEPT_TO_DEPT[k], 'vw').then(d => ({ key: k, d })))),
      Promise.all(vwDeptKeys.map(k => loadDREDataAsync(prevYr, VW_DEPT_TO_DEPT[k], 'vw').then(d => ({ key: k, d })))),
      Promise.all(audiDeptKeys.map(k => loadDREDataAsync(yr, AUDI_DEPT_TO_DEPT[k], 'audi').then(d => ({ key: k, d })))),
      Promise.all(audiDeptKeys.map(k => loadDREDataAsync(prevYr, AUDI_DEPT_TO_DEPT[k], 'audi').then(d => ({ key: k, d })))),
    ]).then(([vwCurrAsync, vwPrevAsync, audiCurrAsync, audiPrevAsync]) => {
      const vwMap: Record<string, { curr: DreLines; prev: DreLines }> = {};
      for (const { key, d } of vwCurrAsync) vwMap[key] = { curr: d, prev: null };
      for (const { key, d } of vwPrevAsync) vwMap[key] = { ...vwMap[key], prev: d };
      setVwAsync(vwMap);

      const audiMap: Record<string, { curr: DreLines; prev: DreLines }> = {};
      for (const { key, d } of audiCurrAsync) audiMap[key] = { curr: d, prev: null };
      for (const { key, d } of audiPrevAsync) audiMap[key] = { ...audiMap[key], prev: d };
      setAudiAsync(audiMap);

      setLoading(false);
    });
  }, [year, prevYear]);

  const depts = subBrand === 'audi' ? AUDI_DEPTS : subBrand === 'vw' ? VW_DEPTS : CON_DEPTS;
  const brandColor = subBrand === 'vw' ? '#001e50' : subBrand === 'audi' ? '#bb0a30' : '#7c3aed';
  const brandColorDark = subBrand === 'vw' ? '#001238' : subBrand === 'audi' ? '#9a0827' : '#5b21b6';

  function getGroupValue(
    mIdx: number,
    deptKey: string,
    usePrev: boolean,
    groupKey: string,
  ): number {
    if (subBrand === 'vw') {
      const lines = usePrev ? vwAsync[deptKey]?.prev : vwAsync[deptKey]?.curr;
      return extractExpenseGroupsByMonth(lines ?? null, mIdx)[groupKey] ?? 0;
    }

    if (subBrand === 'audi') {
      const lines = usePrev ? audiAsync[deptKey]?.prev : audiAsync[deptKey]?.curr;
      return extractExpenseGroupsByMonth(lines ?? null, mIdx)[groupKey] ?? 0;
    }

    const vwLines = usePrev ? vwAsync[deptKey]?.prev : vwAsync[deptKey]?.curr;
    const vwVal = extractExpenseGroupsByMonth(vwLines ?? null, mIdx)[groupKey] ?? 0;

    if (deptKey === 'direta') return vwVal;

    const audiLines = usePrev ? audiAsync[deptKey]?.prev : audiAsync[deptKey]?.curr;
    const audiVal = extractExpenseGroupsByMonth(audiLines ?? null, mIdx)[groupKey] ?? 0;
    return vwVal + audiVal;
  }

  function getDeptTotal(mIdx: number, deptKey: string, usePrev: boolean): number {
    return EXPENSE_GROUPS.reduce((sum, group) => sum + getGroupValue(mIdx, deptKey, usePrev, group.key), 0);
  }

  const totalCurr = depts.reduce((s, d) => s + ytdIdxs.reduce((ms, i) => ms + getDeptTotal(i, d.key, false), 0), 0);
  const totalPrev = depts.reduce((s, d) => s + ytdIdxs.reduce((ms, i) => ms + getDeptTotal(i, d.key, true), 0), 0);
  const totalVar = totalCurr - totalPrev;
  const totalPct = totalPrev !== 0 ? (totalVar / totalPrev) * 100 : 0;

  const chartData = ytdIdxs.map(i => ({
    month: MONTHS_SHORT[i],
    [String(year)]: depts.reduce((s, d) => s + getDeptTotal(i, d.key, false), 0),
    [String(prevYear)]: depts.reduce((s, d) => s + getDeptTotal(i, d.key, true), 0),
  }));

  const deptVarData = depts
    .map(d => {
      const curr = ytdIdxs.reduce((s, i) => s + getDeptTotal(i, d.key, false), 0);
      const prev = ytdIdxs.reduce((s, i) => s + getDeptTotal(i, d.key, true), 0);
      const pct = prev !== 0 ? ((curr - prev) / prev) * 100 : 0;
      const varR = curr - prev;
      const byGroup = EXPENSE_GROUPS.map(group => {
        const gCurr = ytdIdxs.reduce((s, i) => s + getGroupValue(i, d.key, false, group.key), 0);
        const gPrev = ytdIdxs.reduce((s, i) => s + getGroupValue(i, d.key, true, group.key), 0);
        const gVarR = gCurr - gPrev;
        const gVarPct = gPrev !== 0 ? (gVarR / gPrev) * 100 : 0;
        return { key: group.key, label: group.label, curr: gCurr, prev: gPrev, varR: gVarR, varPct: gVarPct };
      });

      const shortLabel = d.label.length > 22 ? d.label.substring(0, 20) + '…' : d.label;
      return { label: shortLabel, fullLabel: d.label, curr, prev, varR, pct, color: d.color, byGroup };
    })
    .sort((a, b) => b.pct - a.pct);

  const expenseTypeVarData = EXPENSE_GROUPS.map(group => {
    const curr = depts.reduce(
      (sum, dept) => sum + ytdIdxs.reduce((s, i) => s + getGroupValue(i, dept.key, false, group.key), 0),
      0,
    );
    const prev = depts.reduce(
      (sum, dept) => sum + ytdIdxs.reduce((s, i) => s + getGroupValue(i, dept.key, true, group.key), 0),
      0,
    );
    const varR = curr - prev;
    const pct = prev !== 0 ? (varR / prev) * 100 : 0;
    const shortLabel = group.label.length > 24 ? `${group.label.substring(0, 22)}…` : group.label;
    return {
      key: group.key,
      label: shortLabel,
      fullLabel: group.label,
      curr,
      prev,
      varR,
      pct,
    };
  });

  const tableRows = depts.map(d => {
    const monthVals = ytdIdxs.map(i => getDeptTotal(i, d.key, false));
    const ytdCurr = monthVals.reduce((s, v) => s + v, 0);
    const ytdPrev = ytdIdxs.reduce((s, i) => s + getDeptTotal(i, d.key, true), 0);
    const varR = ytdCurr - ytdPrev;
    const varPct = ytdPrev !== 0 ? (varR / ytdPrev) * 100 : 0;
    const byGroup = EXPENSE_GROUPS.map(group => {
      const gCurr = ytdIdxs.reduce((s, i) => s + getGroupValue(i, d.key, false, group.key), 0);
      const gPrev = ytdIdxs.reduce((s, i) => s + getGroupValue(i, d.key, true, group.key), 0);
      const gVarR = gCurr - gPrev;
      const gVarPct = gPrev !== 0 ? (gVarR / gPrev) * 100 : 0;
      return { key: group.key, label: group.label, curr: gCurr, prev: gPrev, varR: gVarR, varPct: gVarPct };
    });
    return { label: d.label, color: d.color, monthVals, ytdCurr, ytdPrev, varR, varPct, byGroup };
  });

  const totalMonthVals = ytdIdxs.map(i => depts.reduce((s, d) => s + getDeptTotal(i, d.key, false), 0));

  const periodLabel =
    month === 0
      ? `Jan–Dez/${year} vs Jan–Dez/${prevYear}`
      : `Jan–${MONTHS_SHORT[month - 1]}/${year} vs Jan–${MONTHS_SHORT[month - 1]}/${prevYear}`;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
        <span className="text-sm text-slate-500">Carregando despesas por departamento...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6">
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

      <div>
        <h2 className="text-xl font-bold text-slate-800">Evolução de Despesas por Departamento</h2>
        <p className="text-sm text-slate-500 mt-0.5">{periodLabel}</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Grupos analisados</p>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_GROUPS.map(group => (
            <span
              key={group.key}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600"
            >
              {group.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Despesas YTD {year}</p>
          <p className="text-2xl font-bold" style={{ color: brandColor }}>R$ {fmtBRL(totalCurr)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Despesas YTD {prevYear}</p>
          <p className="text-2xl font-bold text-slate-400">R$ {fmtBRL(totalPrev)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Variação R$</p>
          <p className={`text-2xl font-bold ${totalVar >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {totalVar >= 0 ? '+' : ''}R$ {fmtBRL(totalVar)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Variação %</p>
          <p className={`text-2xl font-bold ${totalPct >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {totalPct >= 0 ? '+' : ''}
            {totalPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Despesas Mensais — {year} vs {prevYear}</h3>
          <p className="text-xs text-slate-400 mb-3">Total dos 7 grupos de despesa por departamentos</p>
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
              <Bar dataKey={String(year)} fill={brandColor} radius={[3, 3, 0, 0]} name={String(year)} />
              <Bar dataKey={String(prevYear)} fill="#cbd5e1" radius={[3, 3, 0, 0]} name={String(prevYear)} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Variação por Departamento — YTD</h3>
          <p className="text-xs text-slate-400 mb-3">% de aumento/redução de despesas vs mesmo período de {prevYear}</p>
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
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-xs max-w-[300px]">
                      <p className="font-bold text-slate-700 mb-1.5">{d.fullLabel}</p>
                      <p className="text-slate-600">{year}: <span className="font-semibold">R$ {fmtBRL(d.curr)}</span></p>
                      <p className="text-slate-400">{prevYear}: R$ {fmtBRL(d.prev)}</p>
                      <p className={`font-bold mt-1 ${d.pct >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {d.pct >= 0 ? '+' : ''}
                        {d.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </p>
                      <div className="mt-2 border-t border-slate-100 pt-2 space-y-1.5">
                        {d.byGroup.map((g: any) => (
                          <div key={g.key} className="flex justify-between gap-2 text-[11px]">
                            <span className="text-slate-500">{g.label}</span>
                            <span className={g.varR >= 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                              {g.varR >= 0 ? '+' : ''}
                              {fmtBRL(g.varR)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {deptVarData.map((entry, index) => (
                  <Cell key={index} fill={entry.pct >= 0 ? STRONG_RED : '#10b981'} fillOpacity={0.85} />
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

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">Variação por Tipo de Despesa — YTD</h3>
        <p className="text-xs text-slate-400 mb-3">Ordem fixa dos 7 grupos · variação % e variação R$ vs mesmo período de {prevYear}</p>
        <ResponsiveContainer width="100%" height={330}>
          <BarChart layout="vertical" data={expenseTypeVarData} margin={{ top: 0, right: 110, left: 8, bottom: 0 }}>
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
              width={180}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-xs max-w-[280px]">
                    <p className="font-bold text-slate-700 mb-1.5">{d.fullLabel}</p>
                    <p className="text-slate-600">{year}: <span className="font-semibold">R$ {fmtBRL(d.curr)}</span></p>
                    <p className="text-slate-400">{prevYear}: R$ {fmtBRL(d.prev)}</p>
                    <p className="font-semibold mt-1 text-slate-700">
                      Var R$: <span className={d.varR >= 0 ? 'text-red-600' : 'text-emerald-600'}>{d.varR >= 0 ? '+' : ''}R$ {fmtBRL(d.varR)}</span>
                    </p>
                    <p className={`font-bold mt-1 ${d.pct >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {d.pct >= 0 ? '+' : ''}
                      {d.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]} fillOpacity={0.85}>
              {expenseTypeVarData.map((entry, index) => (
                <Cell key={index} fill={entry.pct >= 0 ? STRONG_RED : '#10b981'} />
              ))}
              <LabelList
                dataKey="pct"
                position="right"
                formatter={(v: any) => `${Number(v) > 0 ? '+' : ''}${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                style={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {expenseTypeVarData.map(item => (
            <div key={item.key} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-500 truncate">{item.fullLabel}</p>
              <p className={`text-sm font-bold ${item.varR >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {item.varR >= 0 ? '+' : ''}R$ {fmtBRL(item.varR)}
              </p>
              <p className={`text-xs font-semibold ${item.pct >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {item.pct >= 0 ? '+' : ''}{item.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Despesas por Departamento</h3>
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
                  <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${row.varR >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {row.ytdPrev !== 0 ? `${row.varR >= 0 ? '+' : ''}${fmtBRL(row.varR)}` : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${row.varPct >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {row.ytdPrev !== 0
                      ? `${row.varPct >= 0 ? '+' : ''}${row.varPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                      : '—'}
                  </td>
                </tr>
              ))}

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

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Detalhe por Grupo de Despesa (YTD)</h3>
          <p className="text-xs text-slate-400 mt-0.5">Quanto cada grupo variou em cada departamento no período</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide sticky left-0 bg-slate-50 min-w-[180px] whitespace-nowrap">Departamento</th>
                {EXPENSE_GROUPS.map(group => (
                  <th key={group.key} className="px-3 py-3 text-center font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                    {group.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-2.5 sticky left-0 bg-white font-medium text-slate-700 whitespace-nowrap">{row.label}</td>
                  {row.byGroup.map(group => (
                    <td key={group.key} className={`px-3 py-2.5 text-center font-semibold tabular-nums ${group.varR >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      <div className="leading-tight flex flex-col items-center">
                        <div>
                          {group.prev !== 0
                            ? `${group.varR >= 0 ? '+' : ''}${fmtBRL(group.varR)} (${group.varPct >= 0 ? '+' : ''}${group.varPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`
                            : `${group.varR >= 0 ? '+' : ''}${fmtBRL(group.varR)} (0,0%)`}
                        </div>
                        <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                          vs {prevYear}: {group.prev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}