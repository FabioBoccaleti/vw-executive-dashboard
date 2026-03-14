/**
 * Gráficos de Evolução — Receitas
 * Gráficos individuais por conta (mesmas da tabela detalhada),
 * separados por seção: Receita de Vendas, Bonificações, Comissões,
 * Recuperação de Impostos, Outras Receitas + Total Geral.
 * Contas pareadas (bruto − dedução) exibem o valor líquido.
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
  group: string;
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

// ─── Definição das contas ─────────────────────────────────────────────────────

const SUFFIX_MAP: Record<string, string> = {
  '3.1.1.01.01.001': ' - VW',
  '3.1.1.03.01.001': ' - VW',
  '3.1.3.01.01.001': ' - VW',
};

// Contas pareadas: bruto - dedução
const PAIRED_DEFS = [
  { gross: '3.1.1.01.01.001', ded: '3.3.1.01.01.001' },
  { gross: '3.1.1.01.01.002', ded: '3.3.1.01.01.005' },
  { gross: '3.1.1.03.01.001', ded: '3.3.1.01.01.002' },
  { gross: '3.1.1.03.01.002', ded: '3.3.1.01.01.006' },
  { gross: '3.1.2.01.01.001', ded: '3.3.1.01.01.003' },
  { gross: '3.1.2.01.01.002', ded: '3.3.1.01.01.007' },
];

// Contas simples de Receita de Vendas
const SIMPLES_VENDAS = [
  '3.1.3.01.01.001', '3.1.3.01.01.002', '3.1.3.01.01.003',
  '3.1.3.01.01.004', '3.1.3.01.01.005', '3.1.3.01.01.006',
  '3.6.1.01.02.001',
];

const GROUPS_DEF: Array<{ label: string; ids: string[] }> = [
  {
    label: '1 — Receita de Vendas',
    ids: [...PAIRED_DEFS.map(p => p.gross), ...SIMPLES_VENDAS],
  },
  {
    label: '2 — Bonificações',
    ids: ['3.4.1.02.02.002', '3.4.1.08.01.001', '3.4.1.09.01.001', '3.4.1.02.02.003', '3.4.1.02.02.007', '3.4.1.02.02.005'],
  },
  {
    label: '3 — Comissões',
    ids: ['3.4.1.05.01.001', '3.4.1.02.02.006', '3.4.1.04.01.001', '3.4.1.04.03.001', '3.4.2.01.01.001', '3.4.2.03.01.001', '3.4.2.04.01.001', '3.4.2.05.01.001', '3.4.2.06.01.001', '3.4.2.99.01.001'],
  },
  {
    label: '4 — Recuperação de Impostos',
    ids: ['3.4.3.01.02.002', '3.4.3.01.02.003', '3.4.3.01.02.025'],
  },
  {
    label: '5 — Outras Receitas',
    ids: ['3.4.3.02.01.001', '3.4.3.04.01.001', '3.5.1.01.01.001', '3.5.2.01.01.001', '3.5.3.01.01.001', '3.6.1.02.01.001', '3.6.1.02.01.002'],
  },
];

// All account IDs we need to extract (gross + deduction + simples)
const DEDUCTION_IDS = PAIRED_DEFS.map(p => p.ded);
const ALL_IDS = new Set([
  ...GROUPS_DEF.flatMap(g => g.ids),
  ...DEDUCTION_IDS,
]);

// Map gross → ded for paired lookup
const PAIRED_MAP = new Map(PAIRED_DEFS.map(p => [p.gross, p.ded]));

// ─── Parser ───────────────────────────────────────────────────────────────────

interface AccData {
  desc: string;
  valDeb: number;
  valCred: number;
}

function extractAccounts(rawText: string): Record<string, AccData> {
  const result: Record<string, AccData> = {};
  const lines = rawText.split('\n');
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, , valDeb, valCred] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id || !ALL_IDS.has(id)) continue;
    result[id] = {
      desc: desc?.trim() || '',
      valDeb: parseFloat((valDeb || '0').trim().replace(/\./g, '').replace(',', '.')) || 0,
      valCred: parseFloat((valCred || '0').trim().replace(/\./g, '').replace(',', '.')) || 0,
    };
  }
  return result;
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
export function ReceitasCharts({ selectedYear, selectedMonth, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [totalData, setTotalData] = useState<Record<number, number>>({});

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

  const loadYearData = useCallback(async (year: number, upToMonth: number) => {
    const months = Array.from({ length: upToMonth }, (_, i) => i + 1);
    const rawMap = await loadMultipleMonthsRaw(year, months);

    // Parse each month
    const monthAccs: Record<number, Record<string, AccData>> = {};
    // Collect all descs
    const descMap: Record<string, string> = {};
    for (const month of months) {
      const raw = rawMap[month];
      if (!raw) continue;
      const accs = extractAccounts(raw);
      monthAccs[month] = accs;
      for (const [k, v] of Object.entries(accs)) {
        if (v.desc && !descMap[k]) descMap[k] = v.desc;
      }
    }

    // Build chart items per group
    const chartItems: ChartItem[] = [];
    const totals: Record<number, number> = {};

    for (const group of GROUPS_DEF) {
      for (const id of group.ids) {
        const dedId = PAIRED_MAP.get(id);
        const desc = descMap[id] || id;
        const label = toTitleCase(desc) + (SUFFIX_MAP[id] ?? '');

        const item: ChartItem = {
          key: dedId ? `${id}_net` : id,
          label,
          group: group.label,
          values: {},
        };

        for (const month of months) {
          const accs = monthAccs[month];
          if (!accs) continue;

          let val: number;
          if (dedId) {
            // Paired: (grossCred - grossDeb) - (dedDeb - dedCred)
            const g = accs[id] || { valDeb: 0, valCred: 0 };
            const d = accs[dedId] || { valDeb: 0, valCred: 0 };
            val = (g.valCred - g.valDeb) - (d.valDeb - d.valCred);
          } else {
            // Simple: cred - deb
            const a = accs[id] || { valDeb: 0, valCred: 0 };
            val = a.valCred - a.valDeb;
          }
          item.values[month] = val;

          // Accumulate total
          totals[month] = (totals[month] || 0) + val;
        }

        chartItems.push(item);
      }
    }

    return { charts: chartItems, totals };
  }, []);

  // Load main year
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

  // Load compare year
  useEffect(() => {
    if (!compareYear) {
      setCompareCharts([]);
      setCompareTotalData({});
      return;
    }
    (async () => {
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const { charts: ch, totals } = await loadYearData(compareYear, upTo);
      setCompareCharts(ch);
      setCompareTotalData(totals);
    })();
  }, [compareYear, selectedMonth, loadYearData]);

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

  // Filter out charts with all-zero values
  const activeCharts = charts.filter(c => Object.values(c.values).some(v => v > 0));

  // Group active charts by section
  const groupedCharts = GROUPS_DEF.map(g => ({
    label: g.label,
    items: activeCharts.filter(c => c.group === g.label),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Evolução Mensal — Receitas
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

      {/* Charts by section */}
      {groupedCharts.map((section) => (
        <div key={section.label}>
          <h4 className="text-sm font-bold text-foreground mb-3 border-b border-border pb-1">
            {section.label}
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {section.items.map((chart) => {
              const idx = charts.indexOf(chart);
              const compareVals = compareCharts[idx]?.values || {};
              const chartData = buildChartData(chart.values, compareVals);
              const periodTotal = Object.values(chart.values).reduce((s, v) => s + v, 0);
              const comparePeriodTotal = compareYear ? Object.values(compareVals).reduce((s, v) => s + v, 0) : null;

              return (
                <Card key={chart.key}>
                  <CardContent className="pt-5 pb-4">
                    <div className="mb-3">
                      <span className="text-xs font-mono text-muted-foreground">{chart.key.replace('_net', '')}</span>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground">{chart.label}</h4>
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
        </div>
      ))}

      {/* Total Geral */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-foreground">Total Geral — Receitas</h4>
                <p className="text-xs text-muted-foreground">Soma de todas as contas</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold px-3 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Total: {fmtBRLFull(Object.values(totalData).reduce((s, v) => s + v, 0))}
                </span>
                {compareYear && (
                  <span className="text-sm font-bold px-3 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {compareYear}: {fmtBRLFull(Object.values(compareTotalData).reduce((s, v) => s + v, 0))}
                  </span>
                )}
              </div>
            </div>
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
