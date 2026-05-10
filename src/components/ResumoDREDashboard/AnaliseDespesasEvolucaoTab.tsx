import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid, LabelList,
} from 'recharts';
import {
  loadMultipleMonthsAnaliseDespesas,
  loadAnaliseDespesasTipos,
  type AnaliseBrand,
} from '@/components/AnaliseDespesasDashboard/analiseDespesasStorage';

// ─── Constantes ───────────────────────────────────────────────────────────────

const VW_COLOR   = '#001e50';
const AUDI_COLOR = '#bb0a30';
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseG5Leaves(text: string): Record<string, { desc: string; saldoAtual: number }> {
  const lines = text.split('\n').filter(l => l.trim());
  const all: Record<string, { desc: string; saldoAtual: number }> = {};
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, , , , saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id || !id.startsWith('5.')) continue;
    const parse = (v: string) => parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
    all[id] = { desc: desc?.trim() || id, saldoAtual: parse(saldoAtual) };
  }
  // Filtra apenas folhas (sem filhos)
  const keys = Object.keys(all);
  const result: Record<string, { desc: string; saldoAtual: number }> = {};
  for (const k of keys) {
    if (!keys.some(o => o !== k && o.startsWith(k + '.'))) result[k] = all[k];
  }
  return result;
}

function buildTipoSums(
  rawMap: Record<number, string>,
  tiposMap: Record<string, string>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const rawText of Object.values(rawMap)) {
    const leaves = parseG5Leaves(rawText);
    for (const [conta, acc] of Object.entries(leaves)) {
      const label = tiposMap[conta]?.trim() || acc.desc;
      if (!label) continue;
      result[label] = (result[label] ?? 0) + Math.abs(acc.saldoAtual);
    }
  }
  return result;
}

function fmtBRL(v: number): string {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function barColor(pct: number): string {
  if (pct > 15) return '#ef4444';
  if (pct > 5)  return '#f97316';
  if (pct >= 0) return '#94a3b8';
  return '#22c55e';
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Row {
  tipo: string;
  curr: number;
  prev: number;
  varPct: number;
  varAbs: number;
}

// ─── Conteúdo por marca ───────────────────────────────────────────────────────

function EvolucaoContent({ brand, year, month }: { brand: AnaliseBrand; year: number; month: number }) {
  const [loading, setLoading]   = useState(true);
  const [rows, setRows]         = useState<Row[]>([]);
  const [hasData, setHasData]   = useState(false);

  const brandColor  = brand === 'vw' ? VW_COLOR : AUDI_COLOR;
  const prevYear    = year - 1;
  const monthsList  = month === 0
    ? Array.from({ length: 12 }, (_, i) => i + 1)
    : Array.from({ length: month }, (_, i) => i + 1);

  const lastMonthIdx  = month === 0 ? 11 : month - 1;
  const accumLabel     = month === 0 ? `Jan–Dez/${year}`     : `Jan–${MONTHS_SHORT[lastMonthIdx]}/${year}`;
  const accumLabelPrev = month === 0 ? `Jan–Dez/${prevYear}` : `Jan–${MONTHS_SHORT[lastMonthIdx]}/${prevYear}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    Promise.all([
      loadAnaliseDespesasTipos(brand),
      loadMultipleMonthsAnaliseDespesas(brand, year, monthsList),
      loadMultipleMonthsAnaliseDespesas(brand, prevYear, monthsList),
    ]).then(([tipos, currRaw, prevRaw]) => {
      if (cancelled) return;
      setHasData(Object.keys(currRaw).length > 0 || Object.keys(prevRaw).length > 0);
      const curr = buildTipoSums(currRaw, tipos);
      const prev = buildTipoSums(prevRaw, tipos);
      const allLabels = new Set([...Object.keys(curr), ...Object.keys(prev)]);
      const result: Row[] = Array.from(allLabels).map(tipo => {
        const c = curr[tipo] ?? 0;
        const p = prev[tipo] ?? 0;
        const varPct = p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : 0);
        return { tipo, curr: c, prev: p, varPct, varAbs: c - p };
      })
      .filter(r => r.curr > 0 || r.prev > 0)
      .sort((a, b) => b.varPct - a.varPct);
      setRows(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, year, month]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-400">
        <p className="text-sm">Nenhum balancete importado para {brand === 'vw' ? 'VW Norte' : 'Audi'}.</p>
        <p className="text-xs">Importe os dados na página <span className="font-semibold text-slate-500">Análise Evolutiva de Despesas</span>.</p>
      </div>
    );
  }

  const totalCurr  = rows.reduce((s, r) => s + r.curr, 0);
  const totalPrev  = rows.reduce((s, r) => s + r.prev, 0);
  const totalVarPct = totalPrev > 0 ? ((totalCurr - totalPrev) / totalPrev) * 100 : 0;
  const totalVarAbs = totalCurr - totalPrev;

  const withPrev  = rows.filter(r => r.prev > 0);
  const newOnes   = rows.filter(r => r.prev === 0 && r.curr > 0);
  const grew      = withPrev.filter(r => r.varPct > 0);
  const reduced   = withPrev.filter(r => r.varPct <= 0);

  // Top 15 para o gráfico (apenas linhas com dado no ano anterior para % ser significativo)
  const chartData = withPrev
    .slice(0, 15)
    .map(r => ({
      ...r,
      label: r.tipo.length > 24 ? r.tipo.slice(0, 22) + '…' : r.tipo,
    }));

  return (
    <div className="flex flex-col gap-4">

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider leading-tight">{accumLabel}</p>
          <p className="text-xl font-extrabold text-slate-800 mt-1">{fmtBRL(totalCurr)}</p>
          <p className="text-[0.6rem] text-slate-400 mt-0.5">Total de Despesas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider leading-tight">{accumLabelPrev}</p>
          <p className="text-xl font-extrabold text-slate-500 mt-1">{fmtBRL(totalPrev)}</p>
          <p className="text-[0.6rem] text-slate-400 mt-0.5">Total de Despesas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider leading-tight">Variação Total</p>
          <p className={`text-xl font-extrabold mt-1 ${totalVarPct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtPct(totalVarPct)}</p>
          <p className={`text-[0.6rem] mt-0.5 ${totalVarPct > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {fmtBRL(Math.abs(totalVarAbs))} {totalVarAbs > 0 ? 'a mais' : 'a menos'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider leading-tight">Contas Analisadas</p>
          <p className="text-xl font-extrabold text-slate-800 mt-1">{rows.length}</p>
          <p className="text-[0.6rem] text-slate-400 mt-0.5">{grew.length} cresceram · {reduced.length} reduziram</p>
        </div>
      </div>

      {/* ── Gráfico + Tabela ─────────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row gap-4 items-start">

        {/* Gráfico Top 15 */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full xl:w-[480px] shrink-0">
            <div className="px-4 py-3 border-b border-slate-100" style={{ borderLeft: `4px solid ${brandColor}` }}>
              <p className="text-xs font-bold text-slate-700">Top Variações vs. Ano Anterior</p>
              <p className="text-[0.6rem] text-slate-400 mt-0.5">contas com maior variação % · {accumLabel} vs. {accumLabelPrev}</p>
            </div>
            <div className="p-3">
              <div className="flex gap-3 text-[0.6rem] text-slate-400 mb-3 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm bg-red-500 inline-block" />&gt;15%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm bg-orange-500 inline-block" />5–15%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm bg-slate-400 inline-block" />0–5%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm bg-emerald-500 inline-block" />Reduziu</span>
              </div>
              <ResponsiveContainer width="100%" height={chartData.length * 38 + 16}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 2, right: 64, left: 4, bottom: 2 }}
                  barSize={20}
                >
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    tickFormatter={v => v + '%'}
                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={140}
                    tick={{ fontSize: 10, fill: '#374151' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const r = payload[0].payload as typeof chartData[0];
                      return (
                        <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs max-w-[220px]">
                          <p className="font-bold text-slate-700 mb-1 leading-tight">{r.tipo}</p>
                          <p className="text-slate-500">{accumLabelPrev}: <span className="text-slate-700 font-semibold">{fmtBRL(r.prev)}</span></p>
                          <p className="text-slate-500">{accumLabel}: <span className="text-slate-800 font-semibold">{fmtBRL(r.curr)}</span></p>
                          <p className={`font-bold mt-1 ${r.varPct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {fmtPct(r.varPct)} · {fmtBRL(Math.abs(r.varAbs))} {r.varAbs > 0 ? 'a mais' : 'a menos'}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="varPct" radius={[0, 4, 4, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={barColor(d.varPct)} />)}
                    <LabelList
                      dataKey="varPct"
                      position="right"
                      formatter={(v: number) => fmtPct(v)}
                      style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tabela Completa */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-w-0">
          <div className="px-4 py-3 border-b border-slate-100" style={{ borderLeft: `4px solid ${brandColor}` }}>
            <p className="text-xs font-bold text-slate-700">Todos os Grupos de Despesa</p>
            <p className="text-[0.6rem] text-slate-400 mt-0.5">Ordenado pela maior variação % · {accumLabel} vs. {accumLabelPrev}</p>
          </div>
          <div className="overflow-auto" style={{ maxHeight: '640px' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[0.65rem] uppercase tracking-wide">Grupo / Conta</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500 text-[0.65rem] uppercase tracking-wide whitespace-nowrap">{accumLabelPrev}</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500 text-[0.65rem] uppercase tracking-wide whitespace-nowrap">{accumLabel}</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500 text-[0.65rem] uppercase tracking-wide">Var. R$</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500 text-[0.65rem] uppercase tracking-wide">Var. %</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500 text-[0.65rem] uppercase tracking-wide">% Total</th>
                </tr>
              </thead>
              <tbody>
                {withPrev.map((r, i) => {
                  const pctTotal = totalCurr > 0 ? (r.curr / totalCurr) * 100 : 0;
                  const isGone   = r.curr === 0;
                  return (
                    <tr key={i} className={`border-t border-slate-100 ${i % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                      <td className="px-3 py-1.5 text-slate-700 font-medium">{r.tipo}</td>
                      <td className="px-3 py-1.5 text-right text-slate-500 font-mono tabular-nums">{fmtBRL(r.prev)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-800 font-mono font-semibold tabular-nums">
                        {isGone ? <span className="text-slate-400">—</span> : fmtBRL(r.curr)}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono font-semibold tabular-nums ${r.varAbs > 0 ? 'text-red-600' : r.varAbs < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {isGone ? 'Zerado' : (r.varAbs >= 0 ? '+' : '') + fmtBRL(r.varAbs)}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${r.varPct > 10 ? 'text-red-600' : r.varPct > 0 ? 'text-orange-500' : r.varPct < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {isGone ? '−100%' : fmtPct(r.varPct)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-500">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(pctTotal, 100)}%`, backgroundColor: brandColor, opacity: 0.7 }} />
                          </div>
                          <span className="font-mono w-8 text-right text-[0.65rem]">{pctTotal.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-300">
                <tr className="bg-slate-100 font-bold">
                  <td className="px-3 py-2 text-slate-700 text-xs">TOTAL</td>
                  <td className="px-3 py-2 text-right text-slate-600 font-mono text-xs tabular-nums">{fmtBRL(totalPrev)}</td>
                  <td className="px-3 py-2 text-right text-slate-800 font-mono text-xs tabular-nums">{fmtBRL(totalCurr)}</td>
                  <td className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${totalVarAbs > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {totalVarAbs >= 0 ? '+' : ''}{fmtBRL(totalVarAbs)}
                  </td>
                  <td className={`px-3 py-2 text-right text-xs ${totalVarPct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmtPct(totalVarPct)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400 text-xs">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ── Despesas novas (sem histórico no ano anterior) ────────────────── */}
      {newOnes.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 bg-amber-50">
            <p className="text-xs font-bold text-amber-700">
              Despesas sem histórico em {accumLabelPrev} ({newOnes.length})
            </p>
            <p className="text-[0.6rem] text-amber-500 mt-0.5">
              Contas que não existiam ou estavam zeradas no período anterior
            </p>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-amber-50/60 border-b border-amber-100">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[0.65rem] uppercase">Grupo / Conta</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500 text-[0.65rem] uppercase">{accumLabel}</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500 text-[0.65rem] uppercase">% do Total</th>
                </tr>
              </thead>
              <tbody>
                {newOnes.sort((a, b) => b.curr - a.curr).map((r, i) => (
                  <tr key={i} className={`border-t border-amber-100 ${i % 2 !== 0 ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-3 py-1.5 text-slate-700 font-medium">{r.tipo}</td>
                    <td className="px-3 py-1.5 text-right text-slate-800 font-mono font-semibold tabular-nums">{fmtBRL(r.curr)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">
                      {totalCurr > 0 ? ((r.curr / totalCurr) * 100).toFixed(1) + '%' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────────

interface Props { year: number; month: number; }

export function AnaliseDespesasEvolucaoTab({ year, month }: Props) {
  const [brand, setBrand] = useState<AnaliseBrand>('vw');

  const periodoLabel = month === 0
    ? `Jan–Dez/${year} vs Jan–Dez/${year - 1}`
    : `Jan–${MONTHS_SHORT[month - 1]}/${year} vs Jan–${MONTHS_SHORT[month - 1]}/${year - 1}`;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-[1440px] mx-auto p-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Análise Evolutiva de Despesas</h2>
            <p className="text-sm text-slate-500">{periodoLabel}</p>
          </div>
        </div>

        {/* Sub-tabs VW / Audi */}
        <div className="flex gap-2">
          {([
            ['vw',   'VW Norte', VW_COLOR  ],
            ['audi', 'Audi',     AUDI_COLOR],
          ] as const).map(([b, label, color]) => (
            <button
              key={b}
              onClick={() => setBrand(b)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg border transition-all ${
                brand === b
                  ? 'text-white shadow-sm border-transparent'
                  : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-700'
              }`}
              style={brand === b ? { backgroundColor: color, borderColor: color } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <EvolucaoContent brand={brand} year={year} month={month} />

      </div>
    </div>
  );
}
