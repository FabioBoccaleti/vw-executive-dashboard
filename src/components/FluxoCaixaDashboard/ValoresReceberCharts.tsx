/**
 * Gráficos de Evolução — Valores a Receber
 * Exibe um gráfico de barras por conta (+ total) com evolução mês a mês.
 * Opção de comparar com outro ano (barras agrupadas).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { loadMultipleMonthsRaw, loadFluxoCaixaIndex } from './fluxoCaixaStorage';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ContaDados {
  conta: string;
  desc: string;
  values: Record<number, number>; // month -> saldoAtual
}

interface Props {
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
}

// ─── Contas de Valores a Receber ──────────────────────────────────────────────
const CONTAS_IDS = [
  '1.1.3.01.01',
  '1.1.3.01.03',
  '1.1.3.01.04',
  '1.1.3.01.06',
  '1.1.3.01.10',
];

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

// ─── Parser simplificado (só extrai contas necessárias) ───────────────────────
function extractAccountValues(rawText: string): Record<string, number> {
  const result: Record<string, number> = {};
  const lines = rawText.split('\n');
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, , , , saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id) continue;
    // Só extrair contas que nos interessam (1.1.3.01.*)
    if (id.startsWith('1.1.3.01.') || id === '1.1.3') {
      const val = parseFloat((saldoAtual || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
      result[id] = Math.abs(val);
      if (desc?.trim() && !result[`desc_${id}`]) {
        (result as any)[`desc_${id}`] = desc.trim();
      }
    }
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
const COLOR_CURRENT = '#3b82f6'; // blue-500
const COLOR_COMPARE = '#94a3b8'; // slate-400

// ─── Tooltip customizado ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-semibold text-foreground">{fmtBRLFull(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ValoresReceberCharts({ selectedYear, selectedMonth, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [contasData, setContasData] = useState<ContaDados[]>([]);
  const [totalData, setTotalData] = useState<Record<number, number>>({});
  const [contaDescs, setContaDescs] = useState<Record<string, string>>({});

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

  // Carrega dados do ano principal
  const loadYearData = useCallback(async (year: number, upToMonth: number) => {
    const months = Array.from({ length: upToMonth }, (_, i) => i + 1);
    const rawMap = await loadMultipleMonthsRaw(year, months);

    const contasResult: ContaDados[] = CONTAS_IDS.map(id => ({ conta: id, desc: '', values: {} }));
    const totals: Record<number, number> = {};
    const descs: Record<string, string> = {};

    for (const month of months) {
      const raw = rawMap[month];
      if (!raw) continue;
      const accs = extractAccountValues(raw);

      let monthTotal = 0;
      for (let ci = 0; ci < CONTAS_IDS.length; ci++) {
        const id = CONTAS_IDS[ci];
        const val = accs[id] || 0;
        contasResult[ci].values[month] = val;
        monthTotal += val;

        // Pegar descrição
        const descKey = `desc_${id}`;
        if ((accs as any)[descKey] && !descs[id]) {
          descs[id] = (accs as any)[descKey];
          contasResult[ci].desc = (accs as any)[descKey];
        }
      }
      totals[month] = monthTotal;
    }

    // Preencher descrições
    for (const c of contasResult) {
      if (!c.desc && descs[c.conta]) c.desc = descs[c.conta];
    }

    return { contas: contasResult, totals, descs };
  }, []);

  // Carrega ano principal
  useEffect(() => {
    (async () => {
      setLoading(true);
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const { contas, totals, descs } = await loadYearData(selectedYear, upTo);
      setContasData(contas);
      setTotalData(totals);
      setContaDescs(descs);
      setLoading(false);
    })();
  }, [selectedYear, selectedMonth, loadYearData]);

  // Carrega ano comparativo
  useEffect(() => {
    if (!compareYear) {
      setCompareContasData([]);
      setCompareTotalData({});
      return;
    }
    (async () => {
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const { contas, totals } = await loadYearData(compareYear, upTo);
      setCompareContasData(contas);
      setCompareTotalData(totals);
    })();
  }, [compareYear, selectedMonth, loadYearData]);

  const upToMonth = selectedMonth === 0 ? 12 : selectedMonth;
  const months = Array.from({ length: upToMonth }, (_, i) => i + 1);

  // Monta dados para um gráfico
  const buildChartData = (currentValues: Record<number, number>, compareValues?: Record<number, number>) => {
    return months.map(m => ({
      name: MONTH_LABELS[m - 1],
      [String(selectedYear)]: currentValues[m] || 0,
      ...(compareYear ? { [String(compareYear)]: compareValues?.[m] || 0 } : {}),
    }));
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
            Evolução Mensal — Valores a Receber
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedYear} • Jan{upToMonth > 1 ? ` – ${MONTH_LABELS[upToMonth - 1]}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Seletor de comparação */}
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

      {/* Gráficos por conta */}
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
            <h4 className="text-base font-bold text-foreground">Total — Valores a Receber</h4>
            <p className="text-xs text-muted-foreground">Soma de todas as contas</p>
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
