/**
 * Gráficos de Evolução — Posição de Estoques
 * Exibe gráficos de barras por conta (VW + Audi) com evolução mês a mês.
 * Seções: VW (3 contas + total), Audi (3 contas + total), Consolidado (total geral).
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
  values: Record<number, number>; // month -> saldoAtual
}

interface Props {
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
}

// ─── Contas de Estoques ───────────────────────────────────────────────────────
const CONTAS_VW = [
  '1.1.2.01.01.001',
  '1.1.2.02.01.001',
  '1.1.2.03.01.001',
];

const CONTAS_AUDI = [
  '1.1.7.02.01.001',
  '1.1.7.02.02.001',
  '1.1.7.02.03.001',
];

const ALL_CONTAS = [...CONTAS_VW, ...CONTAS_AUDI];

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

// ─── Parser simplificado (extrai contas de estoque VW e Audi) ─────────────────
function extractStockValues(rawText: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = rawText.split('\n');
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, , , , saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id) continue;
    // Extrair contas VW (1.1.2.*) e Audi (1.1.7.02.*)
    if (id.startsWith('1.1.2') || id.startsWith('1.1.7.02')) {
      const val = parseFloat((saldoAtual || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
      result[id] = Math.abs(val);
      if (desc?.trim()) {
        result[`desc_${id}`] = desc.trim();
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
export function PosicaoEstoquesCharts({ selectedYear, selectedMonth, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [contasData, setContasData] = useState<ContaDados[]>([]);
  const [totalVW, setTotalVW] = useState<Record<number, number>>({});
  const [totalAudi, setTotalAudi] = useState<Record<number, number>>({});
  const [totalGeral, setTotalGeral] = useState<Record<number, number>>({});

  // Comparativo
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [compareContasData, setCompareContasData] = useState<ContaDados[]>([]);
  const [compareTotalVW, setCompareTotalVW] = useState<Record<number, number>>({});
  const [compareTotalAudi, setCompareTotalAudi] = useState<Record<number, number>>({});
  const [compareTotalGeral, setCompareTotalGeral] = useState<Record<number, number>>({});

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
  const loadYearData = useCallback(async (year: number, upToMonth: number) => {
    const months = Array.from({ length: upToMonth }, (_, i) => i + 1);
    const rawMap = await loadMultipleMonthsRaw(year, months);

    const contasResult: ContaDados[] = ALL_CONTAS.map(id => ({ conta: id, desc: '', values: {} }));
    const totVW: Record<number, number> = {};
    const totAudi: Record<number, number> = {};
    const totGeral: Record<number, number> = {};
    const descs: Record<string, string> = {};

    for (const month of months) {
      const raw = rawMap[month];
      if (!raw) continue;
      const accs = extractStockValues(raw);

      let monthVW = 0;
      let monthAudi = 0;

      for (let ci = 0; ci < ALL_CONTAS.length; ci++) {
        const id = ALL_CONTAS[ci];
        const val = accs[id] || 0;
        contasResult[ci].values[month] = val;

        if (CONTAS_VW.includes(id)) monthVW += val;
        else monthAudi += val;

        const descKey = `desc_${id}`;
        if (accs[descKey] && !descs[id]) {
          descs[id] = accs[descKey];
          contasResult[ci].desc = accs[descKey];
        }
      }

      totVW[month] = monthVW;
      totAudi[month] = monthAudi;
      totGeral[month] = monthVW + monthAudi;
    }

    for (const c of contasResult) {
      if (!c.desc && descs[c.conta]) c.desc = descs[c.conta];
    }

    return { contas: contasResult, totVW, totAudi, totGeral, descs };
  }, []);

  // Carrega ano principal
  useEffect(() => {
    (async () => {
      setLoading(true);
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const { contas, totVW, totAudi, totGeral } = await loadYearData(selectedYear, upTo);
      setContasData(contas);
      setTotalVW(totVW);
      setTotalAudi(totAudi);
      setTotalGeral(totGeral);
      setLoading(false);
    })();
  }, [selectedYear, selectedMonth, loadYearData]);

  // Carrega ano comparativo
  useEffect(() => {
    if (!compareYear) {
      setCompareContasData([]);
      setCompareTotalVW({});
      setCompareTotalAudi({});
      setCompareTotalGeral({});
      return;
    }
    (async () => {
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const { contas, totVW, totAudi, totGeral } = await loadYearData(compareYear, upTo);
      setCompareContasData(contas);
      setCompareTotalVW(totVW);
      setCompareTotalAudi(totAudi);
      setCompareTotalGeral(totGeral);
    })();
  }, [compareYear, selectedMonth, loadYearData]);

  const upToMonth = selectedMonth === 0 ? 12 : selectedMonth;
  const months = Array.from({ length: upToMonth }, (_, i) => i + 1);

  // Monta dados para um gráfico (inclui variação % mês anterior)
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

  // Renderiza um gráfico individual (reutilizado para cada conta e totais)
  const renderChart = (
    key: string,
    title: string,
    subtitle: string,
    currentValues: Record<number, number>,
    compareValues?: Record<number, number>,
    height = 220,
    isBig = false,
  ) => {
    const chartData = buildChartData(currentValues, compareValues);
    return (
      <Card key={key}>
        <CardContent className="pt-5 pb-4">
          <div className="mb-3">
            {!isBig && <span className="text-xs font-mono text-muted-foreground">{subtitle}</span>}
            <h4 className={`${isBig ? 'text-base font-bold' : 'text-sm font-semibold'} text-foreground`}>{title}</h4>
            {isBig && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData} barGap={compareYear ? 2 : 0}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: isBig ? 12 : 11 }} />
              <YAxis tick={{ fontSize: isBig ? 11 : 10 }} tickFormatter={(v) => fmtBRL(v)} width={isBig ? 80 : 72} />
              <Tooltip content={<CustomTooltip />} />
              {compareYear && <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />}
              <Bar
                dataKey={String(selectedYear)}
                fill={COLOR_CURRENT}
                radius={[isBig ? 4 : 3, isBig ? 4 : 3, 0, 0]}
                maxBarSize={isBig ? 48 : 40}
              />
              {compareYear && (
                <Bar
                  dataKey={String(compareYear)}
                  fill={COLOR_COMPARE}
                  radius={[isBig ? 4 : 3, isBig ? 4 : 3, 0, 0]}
                  maxBarSize={isBig ? 48 : 40}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
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

  // Separa contas VW e Audi
  const vwData = contasData.filter(c => CONTAS_VW.includes(c.conta));
  const audiData = contasData.filter(c => CONTAS_AUDI.includes(c.conta));
  const cmpVwData = compareContasData.filter(c => CONTAS_VW.includes(c.conta));
  const cmpAudiData = compareContasData.filter(c => CONTAS_AUDI.includes(c.conta));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Evolução Mensal — Posição de Estoques
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

      {/* ── Seção VW ─────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <span className="text-xl">🚗</span>
          <h3 className="text-base font-bold text-foreground">Estoque Sorana VW</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {vwData.map((conta, idx) => {
            const cmpVals = cmpVwData[idx]?.values || {};
            const descLabel = conta.desc ? toTitleCase(conta.desc) : conta.conta;
            return renderChart(conta.conta, descLabel, conta.conta, conta.values, cmpVals);
          })}
          {renderChart('total-vw', 'Total — Estoque VW', 'Soma das 3 contas VW', totalVW, compareTotalVW)}
        </div>
      </div>

      {/* ── Seção Audi ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <span className="text-xl">🏎️</span>
          <h3 className="text-base font-bold text-foreground">Estoque Sorana Audi</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {audiData.map((conta, idx) => {
            const cmpVals = cmpAudiData[idx]?.values || {};
            const descLabel = conta.desc ? toTitleCase(conta.desc) : conta.conta;
            return renderChart(conta.conta, descLabel, conta.conta, conta.values, cmpVals);
          })}
          {renderChart('total-audi', 'Total — Estoque Audi', 'Soma das 3 contas Audi', totalAudi, compareTotalAudi)}
        </div>
      </div>

      {/* ── Consolidado ──────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <span className="text-xl">📦</span>
          <h3 className="text-base font-bold text-foreground">Consolidado</h3>
        </div>
        {renderChart('total-geral', 'Total Geral — Estoques VW + Audi', 'Soma de todas as contas de estoque', totalGeral, compareTotalGeral, 300, true)}
      </div>
    </div>
  );
}
