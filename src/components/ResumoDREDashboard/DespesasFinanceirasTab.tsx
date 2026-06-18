import { useEffect, useMemo, useState } from 'react';
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
import {
  loadMultipleMonthsAnaliseDespesas,
  type AnaliseBrand,
} from '@/components/AnaliseDespesasDashboard/analiseDespesasStorage';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const STRONG_RED = '#bb0a30';

const TARGET_ACCOUNTS = [
  '5.5.7.01.01.001',
  '5.5.7.01.01.005',
  '5.5.7.01.01.008',
  '5.5.7.01.01.009',
  '5.5.7.01.01.015',
  '5.5.7.01.05.001',
  '5.5.7.01.25.001',
  '5.5.7.01.25.025',
  '5.5.2.20.99.089',
];

type SubBrand = 'vw' | 'audi' | 'consolidado';

interface Props {
  year: number;
  month: number;
}

interface ParsedExpenseLine {
  conta: string;
  tipo: string;
  valor: number;
}

type MonthTypeMap = Record<number, Record<string, number>>;

function parseNum(v: string): number {
  return parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
}

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max = 26): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
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

function parseMonthlyTargetAccounts(rawText: string): ParsedExpenseLine[] {
  const out: ParsedExpenseLine[] = [];
  const lines = rawText.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;

    const [nivel, conta, desc, , valDeb, valCred] = parts;
    if (nivel?.trim() === 'T') continue;

    const contaId = (conta || '').trim();
    if (!TARGET_ACCOUNTS.includes(contaId)) continue;

    const tipo = normalizeSpace((desc || '').trim()) || contaId;
    const valor = Math.abs(parseNum(valDeb) - parseNum(valCred));

    out.push({ conta: contaId, tipo, valor });
  }

  return out;
}

function buildMonthTypeSums(rawByMonth: Record<number, string>): MonthTypeMap {
  const out: MonthTypeMap = {};

  for (const [monthStr, rawText] of Object.entries(rawByMonth)) {
    const monthNum = Number(monthStr);
    const monthTypes: Record<string, number> = {};
    const parsed = parseMonthlyTargetAccounts(rawText);

    for (const row of parsed) {
      monthTypes[row.tipo] = (monthTypes[row.tipo] ?? 0) + row.valor;
    }

    out[monthNum] = monthTypes;
  }

  return out;
}

function getTypeValue(monthMap: MonthTypeMap, monthNum: number, typeLabel: string): number {
  return monthMap[monthNum]?.[typeLabel] ?? 0;
}

export function DespesasFinanceirasTab({ year, month }: Props) {
  const [subBrand, setSubBrand] = useState<SubBrand>('vw');
  const [loading, setLoading] = useState(true);

  const [vwCurr, setVwCurr] = useState<MonthTypeMap>({});
  const [vwPrev, setVwPrev] = useState<MonthTypeMap>({});
  const [audiCurr, setAudiCurr] = useState<MonthTypeMap>({});
  const [audiPrev, setAudiPrev] = useState<MonthTypeMap>({});

  const prevYear = year - 1;
  const upToMonth = month === 0 ? 12 : month;
  const monthNums = useMemo(() => Array.from({ length: upToMonth }, (_, i) => i + 1), [upToMonth]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const brands: AnaliseBrand[] = ['vw', 'audi'];

    Promise.all([
      loadMultipleMonthsAnaliseDespesas(brands[0], year, monthNums),
      loadMultipleMonthsAnaliseDespesas(brands[0], prevYear, monthNums),
      loadMultipleMonthsAnaliseDespesas(brands[1], year, monthNums),
      loadMultipleMonthsAnaliseDespesas(brands[1], prevYear, monthNums),
    ]).then(([vwCurrRaw, vwPrevRaw, audiCurrRaw, audiPrevRaw]) => {
      if (cancelled) return;
      setVwCurr(buildMonthTypeSums(vwCurrRaw));
      setVwPrev(buildMonthTypeSums(vwPrevRaw));
      setAudiCurr(buildMonthTypeSums(audiCurrRaw));
      setAudiPrev(buildMonthTypeSums(audiPrevRaw));
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setVwCurr({});
      setVwPrev({});
      setAudiCurr({});
      setAudiPrev({});
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [year, prevYear, monthNums]);

  const brandColor = subBrand === 'vw' ? '#001e50' : subBrand === 'audi' ? '#bb0a30' : '#7c3aed';
  const brandColorDark = subBrand === 'vw' ? '#001238' : subBrand === 'audi' ? '#9a0827' : '#5b21b6';

  const allTypes = useMemo(() => {
    const labels = new Set<string>();

    const addMap = (monthMap: MonthTypeMap) => {
      Object.values(monthMap).forEach((types) => {
        Object.keys(types).forEach((label) => labels.add(label));
      });
    };

    if (subBrand === 'vw') {
      addMap(vwCurr);
      addMap(vwPrev);
    } else if (subBrand === 'audi') {
      addMap(audiCurr);
      addMap(audiPrev);
    } else {
      addMap(vwCurr);
      addMap(vwPrev);
      addMap(audiCurr);
      addMap(audiPrev);
    }

    return Array.from(labels).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [subBrand, vwCurr, vwPrev, audiCurr, audiPrev]);

  function getCurr(monthNum: number, typeLabel: string): number {
    if (subBrand === 'vw') return getTypeValue(vwCurr, monthNum, typeLabel);
    if (subBrand === 'audi') return getTypeValue(audiCurr, monthNum, typeLabel);
    return getTypeValue(vwCurr, monthNum, typeLabel) + getTypeValue(audiCurr, monthNum, typeLabel);
  }

  function getPrev(monthNum: number, typeLabel: string): number {
    if (subBrand === 'vw') return getTypeValue(vwPrev, monthNum, typeLabel);
    if (subBrand === 'audi') return getTypeValue(audiPrev, monthNum, typeLabel);
    return getTypeValue(vwPrev, monthNum, typeLabel) + getTypeValue(audiPrev, monthNum, typeLabel);
  }

  const typeRows = allTypes
    .map((typeLabel) => {
      const monthVals = monthNums.map((m) => getCurr(m, typeLabel));
      const ytdCurr = monthVals.reduce((sum, v) => sum + v, 0);
      const ytdPrev = monthNums.reduce((sum, m) => sum + getPrev(m, typeLabel), 0);
      const varR = ytdCurr - ytdPrev;
      const varPct = ytdPrev !== 0 ? (varR / ytdPrev) * 100 : 0;

      return {
        typeLabel,
        shortLabel: truncate(typeLabel, 24),
        monthVals,
        ytdCurr,
        ytdPrev,
        varR,
        varPct,
      };
    })
    .filter((row) => row.ytdCurr > 0 || row.ytdPrev > 0)
    .sort((a, b) => b.varPct - a.varPct);

  const totalCurr = typeRows.reduce((sum, row) => sum + row.ytdCurr, 0);
  const totalPrev = typeRows.reduce((sum, row) => sum + row.ytdPrev, 0);
  const totalVar = totalCurr - totalPrev;
  const totalPct = totalPrev !== 0 ? (totalVar / totalPrev) * 100 : 0;

  const totalMonthVals = monthNums.map((m) => typeRows.reduce((sum, row) => sum + getCurr(m, row.typeLabel), 0));

  const monthlyChartData = monthNums.map((m, idx) => ({
    month: MONTHS_SHORT[m - 1],
    index: idx,
    [String(year)]: typeRows.reduce((sum, row) => sum + getCurr(m, row.typeLabel), 0),
    [String(prevYear)]: typeRows.reduce((sum, row) => sum + getPrev(m, row.typeLabel), 0),
  }));

  const variationByTypeData = typeRows.map((row) => ({
    label: row.shortLabel,
    fullLabel: row.typeLabel,
    curr: row.ytdCurr,
    prev: row.ytdPrev,
    varR: row.varR,
    pct: row.varPct,
  }));

  const periodLabel =
    month === 0
      ? `Jan–Dez/${year} vs Jan–Dez/${prevYear}`
      : `Jan–${MONTHS_SHORT[month - 1]}/${year} vs Jan–${MONTHS_SHORT[month - 1]}/${prevYear}`;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
        <span className="text-sm text-slate-500">Carregando despesas financeiras...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6">
      <div className="flex gap-2">
        {(['vw', 'audi', 'consolidado'] as SubBrand[]).map((b) => {
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
        <h2 className="text-xl font-bold text-slate-800">Despesas Financeiras</h2>
        <p className="text-sm text-slate-500 mt-0.5">{periodLabel}</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Contas consideradas</p>
        <div className="flex flex-wrap gap-2">
          {TARGET_ACCOUNTS.map((account) => (
            <span
              key={account}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600"
            >
              {account}
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
          <p className="text-xs text-slate-400 mb-3">Somatório das despesas financeiras filtradas por conta</p>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={monthlyChartData} barCategoryGap="25%" barGap={3}>
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
          <h3 className="text-sm font-bold text-slate-700">Variação por Tipo de Despesa — YTD</h3>
          <p className="text-xs text-slate-400 mb-3">% de aumento/redução por tipo vs mesmo período de {prevYear}</p>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart layout="vertical" data={variationByTypeData} margin={{ top: 0, right: 64, left: 8, bottom: 0 }}>
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
                width={160}
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
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {variationByTypeData.map((entry, index) => (
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Despesas Financeiras por Tipo</h3>
          <p className="text-xs text-slate-400 mt-0.5">R$ — acumulado Jan a {MONTHS_SHORT[upToMonth - 1]}/{year} · comparação com {prevYear}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide sticky left-0 bg-slate-50 min-w-[220px] whitespace-nowrap">Tipo de despesa</th>
                {monthNums.map((m) => (
                  <th key={m} className="px-3 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                    {MONTHS_SHORT[m - 1]}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-semibold text-slate-700 uppercase tracking-wide whitespace-nowrap bg-slate-100">Total YTD</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">vs {prevYear}</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">Var R$</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">Var %</th>
              </tr>
            </thead>
            <tbody>
              {typeRows.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-2.5 sticky left-0 bg-white font-medium text-slate-700 whitespace-nowrap">
                    {row.typeLabel}
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
    </div>
  );
}