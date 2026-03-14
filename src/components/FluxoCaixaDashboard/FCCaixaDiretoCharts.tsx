/**
 * Gráficos de Evolução — FC de Caixa Direto
 * 4 gráficos:
 *  1. Caixa Líquido das Atividades Operacionais
 *  2. Caixa Líquido das Atividades de Investimento
 *  3. Caixa Líquido das Atividades de Financiamento
 *  4. Variação Total de Caixa no Período
 *
 * Replica o cálculo DFC (método indireto) de parseBalancete para cada mês.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { loadMultipleMonthsRaw, loadFluxoCaixaIndex } from './fluxoCaixaStorage';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DFCValues {
  fluxoOper: number;
  fluxoInvest: number;
  fluxoFinanc: number;
  fluxoTotal: number;
}

interface Props {
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Parser: extrai contas necessárias para DFC ──────────────────────────────

function parseDFC(rawText: string): DFCValues {
  const accounts: Record<string, any> = {};
  const lines = rawText.split('\n');
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, saldoAnt, valDeb, valCred, saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id) continue;
    const p = (v: string) => parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
    accounts[id] = {
      desc: desc?.trim(),
      saldoAnt: p(saldoAnt),
      valDeb: p(valDeb),
      valCred: p(valCred),
      saldoAtual: p(saldoAtual),
    };
  }

  const get = (id: string) => accounts[id] || { saldoAnt: 0, saldoAtual: 0, valDeb: 0, valCred: 0 };
  const absAnt = (id: string) => Math.abs(get(id).saldoAnt);
  const absAtu = (id: string) => Math.abs(get(id).saldoAtual);
  const absMov = (id: string) => { const a = get(id); return Math.abs((a.valCred || 0) - (a.valDeb || 0)); };

  // ── Variações patrimoniais ──────────────────────────────────────
  const dEstoque   = (absAtu('1.1.2') + absAtu('1.1.7.02')) - (absAnt('1.1.2') + absAnt('1.1.7.02'));
  const dCred      = absAtu('1.1.3') - absAnt('1.1.3');
  const dContasCorr = absAtu('1.1.4') - absAnt('1.1.4');
  const dValDiv    = absAtu('1.1.5') - absAnt('1.1.5');
  const dDespAntec = absAtu('1.1.6') - absAnt('1.1.6');
  const dFornec    = (absAtu('2.1.3') + absAtu('2.1.4')) - (absAnt('2.1.3') + absAnt('2.1.4'));
  const dObrigTrib = absAtu('2.1.2.02') - absAnt('2.1.2.02');
  const dObrigTrab = absAtu('2.1.2.01') - absAnt('2.1.2.01');
  const dContasPag = absAtu('2.1.2.03') - absAnt('2.1.2.03');
  const dRealizLPCred = absAtu('1.5.1.01.52') - absAnt('1.5.1.01.52');
  const dEmprestCP_01 = absAtu('2.1.1.01') - absAnt('2.1.1.01');

  // Resíduo 2.2.1
  const g221_ant = absAnt('2.2.1');
  const g221_atu = absAtu('2.2.1');
  const empLP_ant = absAnt('2.2.1.07'); const empLP_atu = absAtu('2.2.1.07');
  const pesLig_ant = absAnt('2.2.1.01'); const pesLig_atu = absAtu('2.2.1.01');
  const debLig_ant = absAnt('2.2.1.02'); const debLig_atu = absAtu('2.2.1.02');
  const arr_ant = absAnt('2.2.1.15'); const arr_atu = absAtu('2.2.1.15');
  const out221_ant = g221_ant - empLP_ant - pesLig_ant - debLig_ant - arr_ant;
  const out221_atu = g221_atu - empLP_atu - pesLig_atu - debLig_atu - arr_atu;
  const dOutros2_2_1 = out221_atu - out221_ant;

  // Depreciação
  const deprec = get('5.5.2.07.20').valDeb;

  // despOper5Net — soma folhas de 5.*
  const allKeys5 = Object.keys(accounts).filter(k => k.startsWith('5.'));
  const leaves5 = allKeys5.filter(k => !allKeys5.some(o => o !== k && o.startsWith(k + '.')));
  const despOper5Net = leaves5.reduce((s, k) => s + ((get(k).valDeb || 0) - (get(k).valCred || 0)), 0);

  // Resultado líquido
  const resLiq = absMov('3.1') - absMov('3.2') - absMov('3.3')
    - absMov('4') - despOper5Net
    + absMov('3.4') + absMov('3.5') + absMov('3.6') - absMov('6');

  // ── Fluxo Operacional (método indireto) ─────────────────
  const fluxoOper =
    resLiq + deprec
    + (-dEstoque) + (-dCred) + (-dContasCorr) + (-dValDiv) + (-dDespAntec)
    + dFornec + dObrigTrib + dObrigTrab + dContasPag
    - dRealizLPCred + dEmprestCP_01 + dOutros2_2_1;

  // ── Fluxo Investimento ─────────────────────────────────
  const fluxoInvest =
    -(absAtu('1.5.5') - absAnt('1.5.5'))
    - (absAtu('1.5.7') - absAnt('1.5.7'))
    - (absAtu('1.5.3') - absAnt('1.5.3'));

  // ── Fluxo Financiamento ────────────────────────────────
  const dEmprestCP_02 = absAtu('2.1.1.02') - absAnt('2.1.1.02');
  const dEmprestLP = empLP_atu - empLP_ant;
  const dPessoasLig = pesLig_atu - pesLig_ant;
  const dDebitosLig = debLig_atu - debLig_ant;
  const dArrendLP = arr_atu - arr_ant;
  const dOutrosPassLP = absAtu('2.2.3') - absAnt('2.2.3');

  const fluxoFinanc = dEmprestCP_02 + dEmprestLP + dPessoasLig + dDebitosLig + dArrendLP + dOutrosPassLP;

  const fluxoTotal = fluxoOper + fluxoInvest + fluxoFinanc;

  return { fluxoOper, fluxoInvest, fluxoFinanc, fluxoTotal };
}

// ─── Formatação ───────────────────────────────────────────────────────────────
const fmtBRL = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `R$ ${(v < 0 ? '-' : '')}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `R$ ${(v < 0 ? '-' : '')}${(abs / 1e3).toFixed(0)}k`;
  return `R$ ${v < 0 ? '-' : ''}` + abs.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtBRLFull = (v: number) =>
  `R$ ${v < 0 ? '-' : ''}` + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Cores ────────────────────────────────────────────────────────────────────
const COLOR_CURRENT = '#3b82f6';
const COLOR_COMPARE = '#94a3b8';

// ─── Tooltip customizado ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => {
        const varKey = `var_${entry.dataKey}`;
        const varPct = entry.payload?.[varKey];
        return (
          <div key={i} className="mb-1 last:mb-0">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-mono font-semibold text-foreground">{fmtBRLFull(entry.value)}</span>
            </div>
            <div className="ml-5 text-xs">
              {varPct === null || varPct === undefined
                ? <span className="text-muted-foreground/60">Var: —</span>
                : <span className={varPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    Var: {varPct >= 0 ? '+' : ''}{varPct.toFixed(1)}%
                  </span>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Definição dos 4 gráficos ────────────────────────────────────────────────
const CHART_DEFS: Array<{ key: keyof DFCValues; label: string }> = [
  { key: 'fluxoOper', label: 'Caixa Líquido das Atividades Operacionais' },
  { key: 'fluxoInvest', label: 'Caixa Líquido das Atividades de Investimento' },
  { key: 'fluxoFinanc', label: 'Caixa Líquido das Atividades de Financiamento' },
  { key: 'fluxoTotal', label: 'Variação Total de Caixa no Período' },
];

// ─── Componente principal ─────────────────────────────────────────────────────
export function FCCaixaDiretoCharts({ selectedYear, selectedMonth, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [monthlyDFC, setMonthlyDFC] = useState<Record<number, DFCValues>>({});

  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [compareMonthlyDFC, setCompareMonthlyDFC] = useState<Record<number, DFCValues>>({});

  useEffect(() => {
    (async () => {
      const idx = await loadFluxoCaixaIndex();
      const years = new Set<number>();
      for (const key of Object.keys(idx)) {
        const y = parseInt(key.split('_')[0]);
        if (!isNaN(y) && y !== selectedYear) years.add(y);
      }
      setAvailableYears(Array.from(years).sort((a, b) => b - a));
    })();
  }, [selectedYear]);

  const loadYearDFC = useCallback(async (year: number, upToMonth: number): Promise<Record<number, DFCValues>> => {
    const months = Array.from({ length: upToMonth }, (_, i) => i + 1);
    const rawMap = await loadMultipleMonthsRaw(year, months);
    const result: Record<number, DFCValues> = {};
    for (const month of months) {
      const raw = rawMap[month];
      if (!raw) continue;
      result[month] = parseDFC(raw);
    }
    return result;
  }, []);

  // Load main year
  useEffect(() => {
    (async () => {
      setLoading(true);
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      setMonthlyDFC(await loadYearDFC(selectedYear, upTo));
      setLoading(false);
    })();
  }, [selectedYear, selectedMonth, loadYearDFC]);

  // Load compare year
  useEffect(() => {
    if (!compareYear) {
      setCompareMonthlyDFC({});
      return;
    }
    (async () => {
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      setCompareMonthlyDFC(await loadYearDFC(compareYear, upTo));
    })();
  }, [compareYear, selectedMonth, loadYearDFC]);

  const upToMonth = selectedMonth === 0 ? 12 : selectedMonth;
  const months = Array.from({ length: upToMonth }, (_, i) => i + 1);

  const buildChartData = (dfcKey: keyof DFCValues) => {
    const curKey = String(selectedYear);
    const cmpKey = compareYear ? String(compareYear) : null;
    return months.map((m, idx) => {
      const curVal = monthlyDFC[m]?.[dfcKey] || 0;
      const prevCurVal = idx > 0 ? (monthlyDFC[months[idx - 1]]?.[dfcKey] || 0) : null;
      const varCur = prevCurVal !== null && prevCurVal !== 0 ? ((curVal - prevCurVal) / Math.abs(prevCurVal)) * 100 : null;

      const row: Record<string, any> = {
        name: MONTH_LABELS[m - 1],
        [curKey]: curVal,
        [`var_${curKey}`]: varCur,
      };

      if (cmpKey) {
        const cmpVal = compareMonthlyDFC[m]?.[dfcKey] || 0;
        const prevCmpVal = idx > 0 ? (compareMonthlyDFC[months[idx - 1]]?.[dfcKey] || 0) : null;
        const varCmp = prevCmpVal !== null && prevCmpVal !== 0 ? ((cmpVal - prevCmpVal) / Math.abs(prevCmpVal)) * 100 : null;
        row[cmpKey] = cmpVal;
        row[`var_${cmpKey}`] = varCmp;
      }

      return row;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Carregando dados...</h3>
          <Button variant="outline" size="sm" onClick={onClose}>Voltar</Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Evolução Mensal — FC de Caixa Direto
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedYear} • Jan{upToMonth > 1 ? ` – ${MONTH_LABELS[upToMonth - 1]}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Comparar com:</span>
              <select
                className="h-8 px-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={compareYear ?? ''}
                onChange={(e) => setCompareYear(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Nenhum</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Voltar</Button>
        </div>
      </div>

      {/* 4 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CHART_DEFS.map((def) => {
          const chartData = buildChartData(def.key);
          const periodTotal = months.reduce((s, m) => s + (monthlyDFC[m]?.[def.key] || 0), 0);
          const comparePeriodTotal = compareYear
            ? months.reduce((s, m) => s + (compareMonthlyDFC[m]?.[def.key] || 0), 0)
            : null;

          return (
            <Card key={def.key}>
              <CardContent className="pt-5 pb-4">
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">{def.label}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        Total: {fmtBRLFull(periodTotal)}
                      </span>
                      {comparePeriodTotal !== null && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {compareYear}: {fmtBRLFull(comparePeriodTotal)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} barGap={compareYear ? 2 : 0}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtBRL(v)} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    {compareYear && <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />}
                    <Bar
                      dataKey={String(selectedYear)}
                      fill={COLOR_CURRENT}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={40}
                    />
                    {compareYear && (
                      <Bar
                        dataKey={String(compareYear)}
                        fill={COLOR_COMPARE}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={40}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
