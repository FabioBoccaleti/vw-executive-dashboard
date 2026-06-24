/**
 * EndividamentoDRETab — Evolução do Endividamento Bancário (Resumo DRE)
 *
 * Dados carregados automaticamente do KV do FluxoCaixa (mesma fonte).
 * Lógica de contas idêntica à aba Endividamento do FluxoCaixa:
 *  - CP sub-contas de 2.1.1.02.03 (exceto .020)
 *  - Banco VW Capital de Giro: 2.1.1.02.03.020 (CP) + 2.2.1.07.01.003 (LP)
 *  - Banco Volks Floor Plan Novos VW: max(0, 2.1.1.02.01.001 − 1.1.2.01.01.001)
 *  - Banco Volks Floor Plan Novos Audi: max(0, 2.1.4.01.01.007 − 1.1.7.02.01.001)
 *  - LP sub-contas de 2.2.1.07 (exceto .01.003)
 */

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { loadFluxoCaixaRaw, loadMultipleMonthsRaw } from '@/components/FluxoCaixaDashboard/fluxoCaixaStorage';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_SHORT: Record<number, string> = {
  1:'Jan',2:'Fev',3:'Mar',4:'Abr',5:'Mai',6:'Jun',
  7:'Jul',8:'Ago',9:'Set',10:'Out',11:'Nov',12:'Dez',
};

const BANK_COLORS = [
  '#dc2626', // red      — Santander
  '#ea580c', // orange   — Itaú
  '#0284c7', // sky      — Volks FP Usados
  '#7c3aed', // violet   — VW Capital Giro
  '#059669', // emerald  — Volks FP Novos VW
  '#d97706', // amber    — Volks FP Novos Audi
  '#0891b2', // cyan     — extra
  '#db2777', // pink     — extra
];

function getBankColor(bank: BankDef): string {
  // Cor fixa para evitar colisão visual com outras séries quando há muitos bancos.
  if (bank.id === 'VW_GIRO') return '#d946ef'; // fuchsia — Banco VW - Capital de Giro
  return BANK_COLORS[bank.colorIdx % BANK_COLORS.length];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Acc {
  saldoAnt: number;
  saldoAtual: number;
  valDeb: number;
  valCred: number;
  desc: string;
}

type BankType = 'cp-sub' | 'vw-giro' | 'vw-fp' | 'audi-fp' | 'lp-sub';

interface BankDef {
  id: string;
  conta: string;
  label: string;
  type: BankType;
  colorIdx: number;
}

interface MonthData {
  month: number;
  banks: Record<string, number>;
  total: number;
}

interface PageData {
  banks: BankDef[];
  months: MonthData[];
  prevMonthData: MonthData | null;
  growthStreak: number;
  totalGrowthAmount: number;
}

interface Props {
  year: number;
  month: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(v: string): number {
  return parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
}

function fmtBRL(v: number, compact = false): string {
  const abs = Math.abs(v);
  if (compact) {
    if (abs >= 1_000_000) return `R$ ${(abs / 1_000_000).toFixed(2).replace('.', ',')}M`;
    if (abs >= 1_000)     return `R$ ${(abs / 1_000).toFixed(1).replace('.', ',')}K`;
  }
  return 'R$ ' + abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtYAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(0)}M`;
  if (abs >= 1_000)     return `${(abs / 1_000).toFixed(0)}K`;
  return String(abs);
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

function parseRaw(rawText: string): Record<string, Acc> {
  const accounts: Record<string, Acc> = {};
  for (const line of rawText.split('\n')) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, saldoAnt, valDeb, valCred, saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id) continue;
    accounts[id] = {
      saldoAnt:   parseNum(saldoAnt),
      valDeb:     parseNum(valDeb),
      valCred:    parseNum(valCred),
      saldoAtual: parseNum(saldoAtual),
      desc:       desc?.trim() ?? '',
    };
  }
  return accounts;
}

function leafSubs(accounts: Record<string, Acc>, prefix: string, exclude: string[]): string[] {
  const all = Object.keys(accounts).filter(k => k.startsWith(prefix + '.') && !exclude.includes(k));
  return all.filter(k => !all.some(o => o !== k && o.startsWith(k + '.'))).sort();
}

function getBankSaldo(bank: BankDef, accounts: Record<string, Acc>): number {
  switch (bank.type) {
    case 'vw-giro':
      return Math.abs(accounts['2.1.1.02.03.020']?.saldoAtual ?? 0)
           + Math.abs(accounts['2.2.1.07.01.003']?.saldoAtual ?? 0);
    case 'vw-fp':
      return Math.max(0,
        Math.abs(accounts['2.1.1.02.01.001']?.saldoAtual ?? 0) -
        Math.abs(accounts['1.1.2.01.01.001']?.saldoAtual ?? 0));
    case 'audi-fp':
      return Math.max(0,
        Math.abs(accounts['2.1.4.01.01.007']?.saldoAtual ?? 0) -
        Math.abs(accounts['1.1.7.02.01.001']?.saldoAtual ?? 0));
    default:
      return Math.abs(accounts[bank.id]?.saldoAtual ?? 0);
  }
}

function detectGrowthStreak(months: MonthData[]): { streak: number; totalGrowth: number } {
  if (months.length < 2) return { streak: 0, totalGrowth: 0 };
  let streak = 0;
  let startIdx = months.length - 1;
  for (let i = months.length - 1; i > 0; i--) {
    if (months[i].total > months[i - 1].total) {
      streak++;
      startIdx = i - 1;
    } else {
      break;
    }
  }
  if (streak < 2) return { streak: 0, totalGrowth: 0 };
  return {
    streak,
    totalGrowth: months[months.length - 1].total - months[startIdx].total,
  };
}

function heatmapBg(prev: number | null, curr: number): string {
  if (prev === null || prev === 0 || curr === 0) return '';
  const pct = ((curr - prev) / prev) * 100;
  const intensity = Math.min(Math.abs(pct) / 25, 1);
  if (pct >  1) return `rgba(220, 38, 38, ${0.07 + intensity * 0.22})`;
  if (pct < -1) return `rgba(5, 150, 105, ${0.07 + intensity * 0.22})`;
  return '';
}

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const totalEntry = payload.find((p: any) => p.dataKey === '__total');
  const bars = payload.filter((p: any) => p.dataKey !== '__total' && (p.value ?? 0) > 0);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm min-w-[230px]">
      <p className="font-bold text-slate-800 mb-2">{label}</p>
      {bars.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600 text-xs truncate">{entry.name}</span>
          </div>
          <span className="font-mono text-xs text-slate-800 font-semibold shrink-0">
            {fmtBRL(entry.value, true)}
          </span>
        </div>
      ))}
      {totalEntry && (
        <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between">
          <span className="font-bold text-slate-700 text-xs">TOTAL</span>
          <span className="font-mono text-xs font-bold text-slate-900">{fmtBRL(totalEntry.value, true)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EndividamentoDRETab({ year, month }: Props) {
  const [data,    setData]    = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const effectiveMonth = month === 0 ? 12 : month;
  const colAtual = month === 0
    ? String(year)
    : `${MONTH_SHORT[effectiveMonth]}/${String(year).slice(2)}`;
  const colAnterior = effectiveMonth === 1
    ? `Dez/${String(year - 1).slice(2)}`
    : `${MONTH_SHORT[effectiveMonth - 1]}/${String(year).slice(2)}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    async function load() {
      try {
        const em = month === 0 ? 12 : month;
        const monthNums = Array.from({ length: em }, (_, i) => i + 1);

        const [rawMap, prevYearRaw] = await Promise.all([
          loadMultipleMonthsRaw(year, monthNums),
          em === 1 ? loadFluxoCaixaRaw(year - 1, 12) : Promise.resolve(null),
        ]);

        const currentRaw = rawMap[em];
        if (!currentRaw) {
          if (!cancelled) { setData(null); setLoading(false); }
          return;
        }

        // Parse all available months
        const allParsed: Record<number, Record<string, Acc>> = {};
        for (const m of monthNums) {
          if (rawMap[m]) allParsed[m] = parseRaw(rawMap[m]);
        }

        const prevMonthAccs = em === 1
          ? (prevYearRaw?.rawText ? parseRaw(prevYearRaw.rawText) : null)
          : (allParsed[em - 1] ?? null);

        // Discover all banks across all months
        const cpSubsSeen = new Map<string, string>();
        const lpSubsSeen = new Map<string, string>();
        for (const accs of Object.values(allParsed)) {
          for (const k of leafSubs(accs, '2.1.1.02.03', ['2.1.1.02.03.020'])) {
            if (!cpSubsSeen.has(k)) cpSubsSeen.set(k, toTitleCase(accs[k]?.desc || k));
          }
          for (const k of leafSubs(accs, '2.2.1.07', ['2.2.1.07.01.003'])) {
            if (!lpSubsSeen.has(k)) lpSubsSeen.set(k, toTitleCase(accs[k]?.desc || k));
          }
        }

        // Build ordered bank list (same order as FluxoCaixa EndividamentoTab)
        let colorIdx = 0;
        const banks: BankDef[] = [
          ...Array.from(cpSubsSeen.entries()).sort(([a], [b]) => a.localeCompare(b)).map(
            ([id, label]) => ({ id, conta: id, label, type: 'cp-sub' as BankType, colorIdx: colorIdx++ })
          ),
          { id: 'VW_GIRO',    conta: '2.1.1.02.03.020+2.2.1.07.01.003', label: 'Banco VW - Capital de Giro',       type: 'vw-giro'   as BankType, colorIdx: colorIdx++ },
          { id: 'NET_VW_FP',  conta: '2.1.1.02.01.001',                  label: 'Banco Volks Floor Plan Novos VW',  type: 'vw-fp'     as BankType, colorIdx: colorIdx++ },
          { id: 'NET_AUDI_FP',conta: '2.1.4.01.01.007',                  label: 'Banco Volks Floor Plan Novos Audi',type: 'audi-fp'   as BankType, colorIdx: colorIdx++ },
          ...Array.from(lpSubsSeen.entries()).sort(([a], [b]) => a.localeCompare(b)).map(
            ([id, label]) => ({ id, conta: id, label, type: 'lp-sub' as BankType, colorIdx: colorIdx++ })
          ),
        ];

        // Build MonthData for each loaded month
        const monthData: MonthData[] = [];
        for (const m of monthNums) {
          const accs = allParsed[m];
          if (!accs) continue;
          const bankSaldos: Record<string, number> = {};
          let total = 0;
          for (const bank of banks) {
            const saldo = getBankSaldo(bank, accs);
            bankSaldos[bank.id] = saldo;
            total += saldo;
          }
          monthData.push({ month: m, banks: bankSaldos, total });
        }

        // Previous month data for comparison table
        let prevMonthDataObj: MonthData | null = null;
        if (prevMonthAccs) {
          const bankSaldos: Record<string, number> = {};
          let total = 0;
          for (const bank of banks) {
            const saldo = getBankSaldo(bank, prevMonthAccs);
            bankSaldos[bank.id] = saldo;
            total += saldo;
          }
          prevMonthDataObj = { month: em - 1, banks: bankSaldos, total };
        }

        const { streak, totalGrowth } = detectGrowthStreak(monthData);

        if (!cancelled) {
          setData({ banks, months: monthData, prevMonthData: prevMonthDataObj, growthStreak: streak, totalGrowthAmount: totalGrowth });
          setLoading(false);
        }
      } catch (err) {
        console.error('EndividamentoDRETab error:', err);
        if (!cancelled) { setError('Erro ao carregar dados.'); setLoading(false); }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [year, month]);

  // ── Loading / error / no-data ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-500 text-sm">Carregando dados...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
        <span className="text-sm text-red-500">{error}</span>
      </div>
    );
  }
  if (!data || data.months.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col items-center gap-4 max-w-sm text-center">
          <AlertCircle className="w-10 h-10 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-600">Sem dados para {colAtual}</h2>
          <p className="text-sm text-slate-400">
            Importe o balancete no Fluxo de Caixa para visualizar o endividamento.
          </p>
        </div>
      </div>
    );
  }

  const { banks, months, prevMonthData, growthStreak, totalGrowthAmount } = data;
  const currentData = months[months.length - 1];
  const totalAtual  = currentData.total;
  const totalAnt    = prevMonthData?.total ?? 0;
  const varMes      = totalAtual - totalAnt;
  const varYTD      = months.length > 1 ? totalAtual - months[0].total : varMes;

  // Banks that have any saldo in any month
  const activeBanks = banks.filter(b => months.some(m => (m.banks[b.id] ?? 0) > 0));

  // Chart data: one entry per month
  const chartData = months.map(m => {
    const obj: Record<string, any> = {
      month: MONTH_SHORT[m.month],
      __total: m.total,
    };
    for (const bank of activeBanks) {
      const val = m.banks[bank.id] ?? 0;
      if (val > 0) obj[bank.id] = val;
    }
    return obj;
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* ── Banner de alerta de crescimento consecutivo ─────────────── */}
        {growthStreak >= 2 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="text-sm">
              <span className="font-bold text-red-700">Atenção: </span>
              <span className="text-red-600">
                Endividamento bancário em crescimento há{' '}
                <strong>{growthStreak} meses consecutivos</strong>
                {totalGrowthAmount > 0 && <> (+{fmtBRL(totalGrowthAmount, true)} no período)</>}
              </span>
            </div>
          </div>
        )}

        {/* ── KPIs ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Total atual */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Total Bancário ({colAtual})
            </div>
            <div className="text-2xl font-bold text-slate-800">{fmtBRL(totalAtual, true)}</div>
            <div className="text-xs text-slate-400 mt-1">Endividamento total consolidado</div>
          </div>

          {/* Variação mês */}
          <div className={`bg-white rounded-xl border shadow-sm p-5 ${varMes > 0 ? 'border-red-200' : varMes < 0 ? 'border-emerald-200' : 'border-slate-200'}`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Variação no mês ({colAnterior} → {colAtual})
            </div>
            <div className={`text-2xl font-bold flex items-center gap-2 ${varMes > 0 ? 'text-red-600' : varMes < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {varMes > 0 ? <TrendingUp className="w-5 h-5" /> : varMes < 0 ? <TrendingDown className="w-5 h-5" /> : null}
              {varMes > 0 ? '+' : ''}{fmtBRL(varMes, true)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {totalAnt > 0 ? `${((varMes / totalAnt) * 100) >= 0 ? '+' : ''}${((varMes / totalAnt) * 100).toFixed(1)}% vs mês anterior` : '—'}
            </div>
          </div>

          {/* Variação YTD */}
          <div className={`bg-white rounded-xl border shadow-sm p-5 ${varYTD > 0 ? 'border-red-200' : varYTD < 0 ? 'border-emerald-200' : 'border-slate-200'}`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Variação no ano ({MONTH_SHORT[months[0]?.month ?? 1]} → {colAtual})
            </div>
            <div className={`text-2xl font-bold flex items-center gap-2 ${varYTD > 0 ? 'text-red-600' : varYTD < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {varYTD > 0 ? <TrendingUp className="w-5 h-5" /> : varYTD < 0 ? <TrendingDown className="w-5 h-5" /> : null}
              {varYTD > 0 ? '+' : ''}{fmtBRL(varYTD, true)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {months[0]?.total > 0
                ? `${((varYTD / months[0].total) * 100) >= 0 ? '+' : ''}${((varYTD / months[0].total) * 100).toFixed(1)}% vs Jan/${String(year).slice(2)}`
                : '—'}
            </div>
          </div>
        </div>

        {/* ── Gráfico: barras empilhadas + linha de total ──────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 mb-1">🏦 Evolução Mensal — {year}</h2>
          <p className="text-xs text-slate-400 mb-5">
            Barras empilhadas por banco · Linha preta = total consolidado
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tickFormatter={fmtYAxis} tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }} />
              {activeBanks.map(bank => (
                <Bar
                  key={bank.id}
                  dataKey={bank.id}
                  name={bank.label}
                  stackId="stack"
                  fill={getBankColor(bank)}
                  radius={bank === activeBanks[activeBanks.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
              <Line
                type="monotone"
                dataKey="__total"
                name="Total Bancário"
                legendType="none"
                stroke="#0f172a"
                strokeWidth={2.5}
                dot={{ fill: '#0f172a', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── Tabela de saldo por banco (mês atual vs anterior) ────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">Endividamento Bancário — {colAtual}</h2>
            <p className="text-xs text-slate-400 mt-0.5">▲ dívida cresceu (ruim) · ▼ dívida reduziu (bom)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4 text-left">Conta / Descrição</th>
                  <th className="py-2.5 px-4 text-right">{colAnterior}</th>
                  <th className="py-2.5 px-4 text-right">{colAtual}</th>
                  <th className="py-2.5 px-4 text-right">Variação R$</th>
                  <th className="py-2.5 px-4 text-right">Var %</th>
                </tr>
              </thead>
              <tbody>
                {activeBanks.map(bank => {
                  const atu  = currentData.banks[bank.id] ?? 0;
                  const ant  = prevMonthData?.banks[bank.id] ?? 0;
                  const varR = atu - ant;
                  const varP = ant !== 0 ? (varR / ant) * 100 : null;
                  return (
                    <tr key={bank.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: getBankColor(bank) }}
                          />
                          <span className="text-xs font-mono text-slate-400 mr-1">{bank.conta}</span>
                          <span className="text-slate-700">{bank.label}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-500">{fmtBRL(ant)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-800">{fmtBRL(atu)}</td>
                      <td className={`py-2.5 px-4 text-right font-mono font-semibold ${varR > 0 ? 'text-red-600' : varR < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {varR !== 0 && <span className="mr-1">{varR > 0 ? '▲' : '▼'}</span>}
                        {varR !== 0 ? fmtBRL(Math.abs(varR)) : '—'}
                      </td>
                      <td className={`py-2.5 px-4 text-right text-xs font-mono ${varR > 0 ? 'text-red-600' : varR < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {varP !== null ? `${Math.abs(varP).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="py-3 px-4 text-sm font-bold text-slate-800">TOTAL BANCÁRIO</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-500">{fmtBRL(totalAnt)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">{fmtBRL(totalAtual)}</td>
                  <td className={`py-3 px-4 text-right font-mono font-bold ${varMes > 0 ? 'text-red-600' : varMes < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {varMes !== 0 && <span className="mr-1">{varMes > 0 ? '▲' : '▼'}</span>}
                    {varMes !== 0 ? fmtBRL(Math.abs(varMes)) : '—'}
                  </td>
                  <td className={`py-3 px-4 text-right text-xs font-mono font-bold ${varMes > 0 ? 'text-red-600' : varMes < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {totalAnt > 0 ? `${Math.abs((varMes / totalAnt) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Tabela de evolução mensal — heatmap ─────────────────────── */}
        {months.length > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Evolução Mensal por Banco — {year}</h2>
              <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(5,150,105,0.25)' }} />
                  dívida reduziu
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(220,38,38,0.25)' }} />
                  dívida cresceu
                </span>
                <span className="text-slate-300">· passe o mouse para ver a variação</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4 text-left sticky left-0 bg-slate-50 z-10 min-w-[200px]">Banco</th>
                    {months.map(m => (
                      <th key={m.month} className="py-2.5 px-3 text-right min-w-[95px]">
                        {MONTH_SHORT[m.month]}/{String(year).slice(2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeBanks.map(bank => (
                    <tr key={bank.id} className="border-t border-slate-100">
                      <td className="py-2 px-4 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: getBankColor(bank) }}
                          />
                          <span className="text-slate-700 font-medium">{bank.label}</span>
                        </div>
                      </td>
                      {months.map((m, idx) => {
                        const saldo    = m.banks[bank.id] ?? 0;
                        const prevSaldo = idx > 0 ? (months[idx - 1].banks[bank.id] ?? 0) : null;
                        const bg       = heatmapBg(prevSaldo, saldo);
                        const varR     = prevSaldo !== null ? saldo - prevSaldo : null;
                        return (
                          <td
                            key={m.month}
                            className="py-2 px-3 text-right font-mono text-slate-700 transition-colors"
                            style={{ backgroundColor: bg || undefined }}
                            title={
                              varR !== null && varR !== 0
                                ? `${varR > 0 ? '▲ +' : '▼ '}${fmtBRL(Math.abs(varR), true)}`
                                : undefined
                            }
                          >
                            {saldo > 0 ? fmtBRL(saldo, true) : <span className="text-slate-200">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="py-3 px-4 text-sm font-bold text-slate-800 sticky left-0 bg-slate-50 z-10">
                      TOTAL BANCÁRIO
                    </td>
                    {months.map((m, idx) => {
                      const prev = idx > 0 ? months[idx - 1].total : null;
                      const bg   = heatmapBg(prev, m.total);
                      const varR = prev !== null ? m.total - prev : null;
                      return (
                        <td
                          key={m.month}
                          className="py-3 px-3 text-right font-mono font-bold text-slate-800"
                          style={{ backgroundColor: bg || undefined }}
                          title={
                            varR !== null && varR !== 0
                              ? `${varR > 0 ? '▲ +' : '▼ '}${fmtBRL(Math.abs(varR), true)}`
                              : undefined
                          }
                        >
                          {fmtBRL(m.total, true)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
