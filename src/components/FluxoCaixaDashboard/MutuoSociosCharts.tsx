/**
 * Gráficos de Evolução — Mútuo Sócios
 * Exibe um gráfico de barras por sub-conta de 2.2.1.01.01 (+ total) com evolução mês a mês.
 * Opção de comparar com outro ano (barras agrupadas).
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

interface ContaDados {
  conta: string;
  desc: string;
  values: Record<number, number>;
}

interface Props {
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
}

const GROUP_PREFIX = '2.2.1.01.01';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

// ─── Parser simplificado (extrai contas do grupo 2.2.1.01.01) ────────────────
function extractMutuoValues(rawText: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = rawText.split('\n');
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, , , , saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id) continue;
    if (id.startsWith(GROUP_PREFIX)) {
      const val = parseFloat((saldoAtual || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
      result[id] = Math.abs(val);
      if (desc?.trim()) {
        result[`desc_${id}`] = desc.trim();
      }
    }
  }
  return result;
}

// Descobre sub-contas folha a partir dos dados extraídos
function discoverLeafAccounts(accsMap: Record<string, any>): string[] {
  const allIds = Object.keys(accsMap).filter(k => !k.startsWith('desc_') && k.startsWith(GROUP_PREFIX + '.'));
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
export function MutuoSociosCharts({ selectedYear, selectedMonth, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [contasData, setContasData] = useState<ContaDados[]>([]);
  const [totalData, setTotalData] = useState<Record<number, number>>({});

  // Comparativo
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [compareContasData, setCompareContasData] = useState<ContaDados[]>([]);
  const [compareTotalData, setCompareTotalData] = useState<Record<number, number>>({});

  // Carrega índice de anos disponíveis
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

  // Carrega dados de um ano
  const loadYearData = useCallback(async (year: number, upToMonth: number, knownIds?: string[]) => {
    const months = Array.from({ length: upToMonth }, (_, i) => i + 1);
    const rawMap = await loadMultipleMonthsRaw(year, months);

    // Primeiro passo: descobrir todas as sub-contas folha
    const allAccsMerged: Record<string, any> = {};
    const monthAccs: Record<number, Record<string, any>> = {};
    for (const month of months) {
      const raw = rawMap[month];
      if (!raw) continue;
      const accs = extractMutuoValues(raw);
      monthAccs[month] = accs;
      Object.assign(allAccsMerged, accs);
    }

    const leafIds = knownIds ?? discoverLeafAccounts(allAccsMerged);

    const contasResult: ContaDados[] = leafIds.map(id => ({
      conta: id,
      desc: allAccsMerged[`desc_${id}`] || '',
      values: {},
    }));
    const totals: Record<number, number> = {};

    for (const month of months) {
      const accs = monthAccs[month];
      if (!accs) continue;
      let monthTotal = 0;
      for (let ci = 0; ci < leafIds.length; ci++) {
        const val = accs[leafIds[ci]] || 0;
        contasResult[ci].values[month] = val;
        monthTotal += val;
      }
      totals[month] = monthTotal;
    }

    return { contas: contasResult, totals, leafIds };
  }, []);

  // Carrega ano principal
  useEffect(() => {
    (async () => {
      setLoading(true);
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const { contas, totals } = await loadYearData(selectedYear, upTo);
      setContasData(contas);
      setTotalData(totals);
      setLoading(false);
    })();
  }, [selectedYear, selectedMonth, loadYearData]);

  // Carrega ano comparativo (usa as mesmas contas do ano principal)
  useEffect(() => {
    if (!compareYear) {
      setCompareContasData([]);
      setCompareTotalData({});
      return;
    }
    (async () => {
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const ids = contasData.map(c => c.conta);
      const { contas, totals } = await loadYearData(compareYear, upTo, ids);
      setCompareContasData(contas);
      setCompareTotalData(totals);
    })();
  }, [compareYear, selectedMonth, loadYearData, contasData]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Evolução Mensal — Mútuo Sócios
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

      {/* Gráficos por sub-conta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {contasData.map((conta, idx) => {
          const compareVals = compareContasData[idx]?.values || {};
          const chartData = buildChartData(conta.values, compareVals);
          const descLabel = conta.desc ? toTitleCase(conta.desc) : conta.conta;

          return (
            <Card key={conta.conta}>
              <CardContent className="pt-5 pb-4">
                <div className="mb-3">
                  <span className="text-xs font-mono text-muted-foreground">{conta.conta}</span>
                  <h4 className="text-sm font-semibold text-foreground">{descLabel}</h4>
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

      {/* Gráfico TOTAL */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="mb-3">
            <h4 className="text-base font-bold text-foreground">Total — Mútuo Sócios</h4>
            <p className="text-xs text-muted-foreground">Soma de todas as sub-contas (2.2.1.01.01)</p>
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
