/**
 * Gráficos de Evolução — Resultado (DRE)
 * 7 gráficos com comparativo mensal ano atual vs ano anterior:
 *  1. Receita Líquida
 *  2. Lucro (Prejuízo) Bruto
 *  3. Rendas Operacionais
 *  4. Rendas Não Operacionais
 *  5. Despesas Operacionais (soma de todas folhas 5.*)
 *  6. Resultado Antes do IR/CSLL
 *  7. Resultado Líquido do Exercício
 *
 * Carrega os balancetes brutos de cada mês via loadMultipleMonthsRaw
 * e calcula as métricas com a mesma lógica da ResultadoTab.
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

interface DREValues {
  receitaLiquida: number;
  lucroBruto: number;
  rendasOperacionais: number;
  rendasNaoOperacionais: number;
  despesasOperacionais: number;
  resultadoAntesIR: number;
  resultadoLiquido: number;
}

interface Props {
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Parser: extrai métricas DRE do balancete bruto ──────────────────────────

function parseDRE(rawText: string): DREValues {
  const accounts: Record<string, any> = {};
  const lines = rawText.split('\n');
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, saldoAnt, valDeb, valCred, saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id) continue;
    const p = (v: string) =>
      parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
    accounts[id] = {
      desc: desc?.trim(),
      saldoAnt: p(saldoAnt),
      valDeb: p(valDeb),
      valCred: p(valCred),
      saldoAtual: p(saldoAtual),
    };
  }

  const get = (id: string) =>
    accounts[id] || { saldoAnt: 0, saldoAtual: 0, valDeb: 0, valCred: 0 };

  // Movimento do mês (débito − crédito em valor absoluto)
  const absMov = (id: string) => {
    const a = get(id);
    return Math.abs((a.valCred || 0) - (a.valDeb || 0));
  };

  // Receita Líquida = Receita Bruta − Impostos − Devoluções
  const recBruta   = absMov('3.1');
  const impostos   = absMov('3.2');
  const devolucoes = absMov('3.3');
  const receitaLiquida = recBruta - impostos - devolucoes;

  // CMV
  const cmv = absMov('4');

  // Lucro Bruto
  const lucroBruto = receitaLiquida - cmv;

  // Rendas
  const rendasOperacionais    = absMov('3.4');
  const rendasFinanceiras     = absMov('3.5');
  const rendasNaoOperacionais = absMov('3.6');

  // Despesas Operacionais — soma de todas folhas de 5.*
  const allKeys5 = Object.keys(accounts).filter(k => k.startsWith('5.'));
  const leaves5  = allKeys5.filter(k => !allKeys5.some(o => o !== k && o.startsWith(k + '.')));
  const despesasOperacionais = leaves5.reduce(
    (s, k) => s + ((get(k).valDeb || 0) - (get(k).valCred || 0)), 0,
  );

  // Resultado Antes do IR/CSLL
  const resultadoAntesIR =
    lucroBruto - despesasOperacionais + rendasOperacionais + rendasFinanceiras + rendasNaoOperacionais;

  // Provisão IR + CSLL
  const provisaoIR = absMov('6');

  // Resultado Líquido
  const resultadoLiquido = resultadoAntesIR - provisaoIR;

  return {
    receitaLiquida,
    lucroBruto,
    rendasOperacionais,
    rendasNaoOperacionais,
    despesasOperacionais,
    resultadoAntesIR,
    resultadoLiquido,
  };
}

// ─── Definição dos 7 gráficos ────────────────────────────────────────────────

const CHART_DEFS: Array<{ key: keyof DREValues; label: string }> = [
  { key: 'receitaLiquida',        label: 'Receita Líquida' },
  { key: 'lucroBruto',            label: 'Lucro (Prejuízo) Bruto' },
  { key: 'rendasOperacionais',    label: 'Rendas Operacionais' },
  { key: 'rendasNaoOperacionais', label: 'Rendas Não Operacionais' },
  { key: 'despesasOperacionais',  label: 'Despesas Operacionais' },
  { key: 'resultadoAntesIR',      label: 'Resultado Antes do IR/CSLL' },
  { key: 'resultadoLiquido',      label: 'Resultado Líquido do Exercício' },
];

// ─── Formatação ───────────────────────────────────────────────────────────────

const fmtBRL = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `R$ ${v < 0 ? '-' : ''}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `R$ ${v < 0 ? '-' : ''}${(abs / 1e3).toFixed(0)}k`;
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

// ─── Componente principal ─────────────────────────────────────────────────────

export function ResultadoCharts({ selectedYear, selectedMonth, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [monthlyDRE, setMonthlyDRE] = useState<Record<number, DREValues>>({});

  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [compareMonthlyDRE, setCompareMonthlyDRE] = useState<Record<number, DREValues>>({});

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

  const loadYearDRE = useCallback(async (year: number, upToMonth: number): Promise<Record<number, DREValues>> => {
    const months = Array.from({ length: upToMonth }, (_, i) => i + 1);
    const rawMap = await loadMultipleMonthsRaw(year, months);
    const result: Record<number, DREValues> = {};
    for (const month of months) {
      const raw = rawMap[month];
      if (!raw) continue;
      result[month] = parseDRE(raw);
    }
    return result;
  }, []);

  // Carregar ano principal
  useEffect(() => {
    (async () => {
      setLoading(true);
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      setMonthlyDRE(await loadYearDRE(selectedYear, upTo));
      setLoading(false);
    })();
  }, [selectedYear, selectedMonth, loadYearDRE]);

  // Carregar ano de comparação
  useEffect(() => {
    if (!compareYear) {
      setCompareMonthlyDRE({});
      return;
    }
    (async () => {
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      setCompareMonthlyDRE(await loadYearDRE(compareYear, upTo));
    })();
  }, [compareYear, selectedMonth, loadYearDRE]);

  const upToMonth = selectedMonth === 0 ? 12 : selectedMonth;
  const months = Array.from({ length: upToMonth }, (_, i) => i + 1);

  const buildChartData = (dreKey: keyof DREValues) => {
    const curKey = String(selectedYear);
    const cmpKey = compareYear ? String(compareYear) : null;
    return months.map((m, idx) => {
      const curVal = monthlyDRE[m]?.[dreKey] || 0;
      const prevCurVal = idx > 0 ? (monthlyDRE[months[idx - 1]]?.[dreKey] || 0) : null;
      const varCur = prevCurVal !== null && prevCurVal !== 0
        ? ((curVal - prevCurVal) / Math.abs(prevCurVal)) * 100
        : null;

      const row: Record<string, any> = {
        name: MONTH_LABELS[m - 1],
        [curKey]: curVal,
        [`var_${curKey}`]: varCur,
      };

      if (cmpKey) {
        const cmpVal = compareMonthlyDRE[m]?.[dreKey] || 0;
        const prevCmpVal = idx > 0 ? (compareMonthlyDRE[months[idx - 1]]?.[dreKey] || 0) : null;
        const varCmp = prevCmpVal !== null && prevCmpVal !== 0
          ? ((cmpVal - prevCmpVal) / Math.abs(prevCmpVal)) * 100
          : null;
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
            Evolução Mensal — Resultado (DRE)
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

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CHART_DEFS.map((def) => {
          const chartData = buildChartData(def.key);
          const periodTotal = months.reduce((s, m) => s + (monthlyDRE[m]?.[def.key] || 0), 0);
          const comparePeriodTotal = compareYear
            ? months.reduce((s, m) => s + (compareMonthlyDRE[m]?.[def.key] || 0), 0)
            : null;

          // Ocultar gráficos com todos os valores zerados
          const allZeroCur = months.every(m => (monthlyDRE[m]?.[def.key] || 0) === 0);
          const allZeroCmp = !compareYear || months.every(m => (compareMonthlyDRE[m]?.[def.key] || 0) === 0);
          if (allZeroCur && allZeroCmp) return null;

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
