/**
 * Gráficos de Evolução — Endividamento Bancário
 * Gráficos individuais por sub-conta CP, LP, Floor Plan VW/Audi,
 * Capital de Giro (2.1.1.02.03.020 + 2.2.1.07.01.003) e Total Geral.
 * Tudo em grid único, sem separação por seção.
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

interface ChartItem {
  key: string;
  label: string;
  values: Record<number, number>;
}

interface Props {
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

// ─── Parser: extrai todas as contas relevantes ───────────────────────────────
function extractEndValues(rawText: string): Record<string, { val: number; desc: string }> {
  const result: Record<string, { val: number; desc: string }> = {};
  const lines = rawText.split('\n');
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, , , , saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id) continue;
    // CP sub-accounts (2.1.1.02.03.*), Floor Plan VW/Audi, LP (2.2.1.07.*), Ativo offsets
    if (
      id.startsWith('2.1.1.02.03') ||
      id.startsWith('2.2.1.07') ||
      id === '2.1.1.02.01.001' ||
      id === '2.1.4.01.01.007' ||
      id === '1.1.2.01.01.001' ||
      id === '1.1.7.02.01.001'
    ) {
      const val = Math.abs(parseFloat((saldoAtual || '0').trim().replace(/\./g, '').replace(',', '.')) || 0);
      result[id] = { val, desc: desc?.trim() || '' };
    }
  }
  return result;
}

// Descobre sub-contas folha
function discoverLeaves(accsMap: Record<string, { val: number; desc: string }>, prefix: string): string[] {
  const allIds = Object.keys(accsMap).filter(k => k.startsWith(prefix + '.'));
  return allIds.filter(k => !allIds.some(other => other !== k && other.startsWith(k + '.'))).sort();
}

// ─── Formatação ───────────────────────────────────────────────────────────────
const fmtBRL = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `R$ ${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `R$ ${(abs / 1e3).toFixed(0)}k`;
  return 'R$ ' + abs.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtBRLFull = (v: number) =>
  'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

// ─── Componente principal ─────────────────────────────────────────────────────
export function EndividamentoCharts({ selectedYear, selectedMonth, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [totalData, setTotalData] = useState<Record<number, number>>({});

  // Comparativo
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [compareCharts, setCompareCharts] = useState<ChartItem[]>([]);
  const [compareTotalData, setCompareTotalData] = useState<Record<number, number>>({});

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

  // Carrega dados de um ano, retorna chart items + total
  const loadYearData = useCallback(async (year: number, upToMonth: number, knownKeys?: string[]) => {
    const months = Array.from({ length: upToMonth }, (_, i) => i + 1);
    const rawMap = await loadMultipleMonthsRaw(year, months);

    // Merge all months to discover sub-account leaves
    const allMerged: Record<string, { val: number; desc: string }> = {};
    const monthAccs: Record<number, Record<string, { val: number; desc: string }>> = {};
    for (const month of months) {
      const raw = rawMap[month];
      if (!raw) continue;
      const accs = extractEndValues(raw);
      monthAccs[month] = accs;
      for (const [k, v] of Object.entries(accs)) {
        if (!allMerged[k]) allMerged[k] = v;
      }
    }

    const cpLeaves = discoverLeaves(allMerged, '2.1.1.02.03');
    const lpLeaves = discoverLeaves(allMerged, '2.2.1.07');

    // Build chart items list (deterministic order)
    const chartItems: ChartItem[] = [];

    // 1) CP sub-accounts
    for (const id of cpLeaves) {
      chartItems.push({
        key: id,
        label: allMerged[id]?.desc ? toTitleCase(allMerged[id].desc) : id,
        values: {},
      });
    }

    // 2) Floor Plan VW
    chartItems.push({ key: 'fp_vw', label: 'Floor Plan Novos VW (líquido)', values: {} });

    // 3) Floor Plan Audi
    chartItems.push({ key: 'fp_audi', label: 'Floor Plan Novos Audi (líquido)', values: {} });

    // 4) LP sub-accounts
    for (const id of lpLeaves) {
      chartItems.push({
        key: id,
        label: allMerged[id]?.desc ? toTitleCase(allMerged[id].desc) : id,
        values: {},
      });
    }

    // 5) Capital de Giro VW (soma 2.1.1.02.03.020 + 2.2.1.07.01.003)
    chartItems.push({ key: 'cap_giro', label: 'Capital de Giro VW', values: {} });

    // If we have known keys from main year, reorder to match
    const orderedItems = knownKeys
      ? knownKeys.map(k => chartItems.find(c => c.key === k) || { key: k, label: k, values: {} })
      : chartItems;

    const totals: Record<number, number> = {};

    for (const month of months) {
      const accs = monthAccs[month];
      if (!accs) continue;

      const getVal = (id: string) => accs[id]?.val || 0;

      // CP base total
      let cpTotal = 0;
      for (const id of cpLeaves) {
        const val = getVal(id);
        const item = orderedItems.find(c => c.key === id);
        if (item) item.values[month] = val;
        cpTotal += val;
      }

      // Floor Plan VW: max(0, passivo - ativo)
      const fpVwVal = Math.max(0, getVal('2.1.1.02.01.001') - getVal('1.1.2.01.01.001'));
      const fpVwItem = orderedItems.find(c => c.key === 'fp_vw');
      if (fpVwItem) fpVwItem.values[month] = fpVwVal;

      // Floor Plan Audi: max(0, passivo - ativo)
      const fpAudiVal = Math.max(0, getVal('2.1.4.01.01.007') - getVal('1.1.7.02.01.001'));
      const fpAudiItem = orderedItems.find(c => c.key === 'fp_audi');
      if (fpAudiItem) fpAudiItem.values[month] = fpAudiVal;

      // LP total
      let lpTotal = 0;
      for (const id of lpLeaves) {
        const val = getVal(id);
        const item = orderedItems.find(c => c.key === id);
        if (item) item.values[month] = val;
        lpTotal += val;
      }

      // Capital de Giro
      const capGiroVal = getVal('2.1.1.02.03.020') + getVal('2.2.1.07.01.003');
      const capGiroItem = orderedItems.find(c => c.key === 'cap_giro');
      if (capGiroItem) capGiroItem.values[month] = capGiroVal;

      // Total Geral = CP base + FP VW + FP Audi + LP
      totals[month] = cpTotal + fpVwVal + fpAudiVal + lpTotal;
    }

    return { charts: orderedItems, totals };
  }, []);

  // Carrega ano principal
  useEffect(() => {
    (async () => {
      setLoading(true);
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const { charts: ch, totals } = await loadYearData(selectedYear, upTo);
      setCharts(ch);
      setTotalData(totals);
      setLoading(false);
    })();
  }, [selectedYear, selectedMonth, loadYearData]);

  // Carrega ano comparativo
  useEffect(() => {
    if (!compareYear) {
      setCompareCharts([]);
      setCompareTotalData({});
      return;
    }
    (async () => {
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const keys = charts.map(c => c.key);
      const { charts: ch, totals } = await loadYearData(compareYear, upTo, keys);
      setCompareCharts(ch);
      setCompareTotalData(totals);
    })();
  }, [compareYear, selectedMonth, loadYearData, charts]);

  const upToMonth = selectedMonth === 0 ? 12 : selectedMonth;
  const months = Array.from({ length: upToMonth }, (_, i) => i + 1);

  const buildChartData = (currentValues: Record<number, number>, compareValues?: Record<number, number>) => {
    const curKey = String(selectedYear);
    const cmpKey = compareYear ? String(compareYear) : null;
    return months.map((m, idx) => {
      const curVal = currentValues[m] || 0;
      const prevCurVal = idx > 0 ? (currentValues[months[idx - 1]] || 0) : null;
      const varCur = prevCurVal !== null && prevCurVal !== 0 ? ((curVal - prevCurVal) / prevCurVal) * 100 : null;

      const row: Record<string, any> = {
        name: MONTH_LABELS[m - 1],
        [curKey]: curVal,
        [`var_${curKey}`]: varCur,
      };

      if (cmpKey) {
        const cmpVal = compareValues?.[m] || 0;
        const prevCmpVal = idx > 0 ? (compareValues?.[months[idx - 1]] || 0) : null;
        const varCmp = prevCmpVal !== null && prevCmpVal !== 0 ? ((cmpVal - prevCmpVal) / prevCmpVal) * 100 : null;
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

  // Filtra contas sem valores e exclui individuais já representadas em Capital de Giro
  const HIDDEN_INDIVIDUAL = new Set(['2.1.1.02.03.020', '2.2.1.07.01.003']);
  const activeCharts = charts.filter(c =>
    !HIDDEN_INDIVIDUAL.has(c.key) && Object.values(c.values).some(v => v > 0)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Evolução Mensal — Endividamento Bancário
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

      {/* Gráficos individuais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {activeCharts.map((chart) => {
          const idx = charts.indexOf(chart);
          const compareVals = compareCharts[idx]?.values || {};
          const chartData = buildChartData(chart.values, compareVals);
          const isSpecial = ['fp_vw', 'fp_audi', 'cap_giro'].includes(chart.key);
          const subtitle = isSpecial ? chart.key : chart.key;
          const displayKey = isSpecial
            ? (chart.key === 'fp_vw' ? '2.1.1.02.01.001 − 1.1.2.01.01.001'
              : chart.key === 'fp_audi' ? '2.1.4.01.01.007 − 1.1.7.02.01.001'
              : '2.1.1.02.03.020 + 2.2.1.07.01.003')
            : chart.key;

          return (
            <Card key={chart.key}>
              <CardContent className="pt-5 pb-4">
                <div className="mb-3">
                  <span className="text-xs font-mono text-muted-foreground">{displayKey}</span>
                  <h4 className="text-sm font-semibold text-foreground">{chart.label}</h4>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barGap={compareYear ? 2 : 0}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtBRL(v)} width={72} />
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

      {/* Gráfico TOTAL GERAL */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="mb-3">
            <h4 className="text-base font-bold text-foreground">Total Geral — Endividamento Bancário</h4>
            <p className="text-xs text-muted-foreground">CP + Floor Plan VW/Audi + LP</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={buildChartData(totalData, compareTotalData)} barGap={compareYear ? 2 : 0}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} width={80} />
              <Tooltip content={<CustomTooltip />} />
              {compareYear && <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />}
              <Bar
                dataKey={String(selectedYear)}
                fill={COLOR_CURRENT}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
              {compareYear && (
                <Bar
                  dataKey={String(compareYear)}
                  fill={COLOR_COMPARE}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
