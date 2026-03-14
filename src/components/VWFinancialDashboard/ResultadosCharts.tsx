/**
 * Gráficos de Evolução — Resultados (DRE)
 * 7 gráficos com comparativo mensal ano atual vs ano anterior:
 * - Receita Líquida
 * - Lucro (Prejuízo) Bruto
 * - Rendas Operacionais
 * - Rendas Não Operacionais
 * - Despesas Operacionais (soma: índices 4 + 7..11)
 * - Resultado Antes do IR/CSLL
 * - Resultado Líquido do Exercício
 */

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { loadDREData, type Brand, type Department } from '@/lib/dataStorage';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  fiscalYear: 2024 | 2025 | 2026 | 2027;
  department: Department;
  brand: Brand;
  dreData: any[];          // dados DRE do ano selecionado (já carregados no pai)
  onClose: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const COLOR_CURRENT = '#3b82f6';
const COLOR_COMPARE = '#94a3b8';

/** Cada métrica e quais índices do array DRE deve usar */
const METRIC_DEFS = [
  { key: 'receitaLiquida',     label: 'Receita Líquida',                  indices: [1] },
  { key: 'lucroBruto',         label: 'Lucro (Prejuízo) Bruto',           indices: [3] },
  { key: 'rendasOper',         label: 'Rendas Operacionais',              indices: [5] },
  { key: 'rendasNaoOper',      label: 'Rendas Não Operacionais',          indices: [17] },
  { key: 'despesasOper',       label: 'Despesas Operacionais',            indices: [4, 7, 8, 9, 10, 11] },
  { key: 'resultadoAntesIR',   label: 'Resultado Antes do IR/CSLL',      indices: [18] },
  { key: 'resultadoLiquido',   label: 'Resultado Líquido do Exercício',   indices: [21] },
];

const VALID_YEARS: number[] = [2024, 2025, 2026, 2027];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
};

const fmtBRLFull = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Soma valores dos meses para os índices indicados */
const monthValue = (data: any[], indices: number[], monthIdx: number): number =>
  indices.reduce((sum, i) => sum + (data[i]?.meses?.[monthIdx] ?? 0), 0);

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => {
        const varKey = `var_${p.dataKey}`;
        const variation = p.payload[varKey];
        return (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-semibold">{fmtBRLFull(p.value)}</span>
            {variation !== null && variation !== undefined && (
              <span className={`text-xs font-medium ${variation >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                ({variation >= 0 ? '+' : ''}{variation.toFixed(1)}%)
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ResultadosCharts({ fiscalYear, department, brand, dreData, onClose }: Props) {
  // Determinar anos disponíveis para comparação
  const availableYears = useMemo(
    () => VALID_YEARS.filter(y => y !== fiscalYear),
    [fiscalYear],
  );

  const [compareYear, setCompareYear] = useState<number | null>(() => {
    const prev = fiscalYear - 1;
    return VALID_YEARS.includes(prev) ? prev : null;
  });

  // Dados do ano de comparação (se selecionado)
  const compareDreData = useMemo(() => {
    if (!compareYear) return null;
    const yr = compareYear as 2024 | 2025 | 2026 | 2027;
    return loadDREData(yr, department, brand);
  }, [compareYear, department, brand]);

  // Detectar até que mês temos dados (primeiro mês com meses[i] === 0 na receita)
  const upToMonth = useMemo(() => {
    const recMeses = dreData[1]?.meses ?? [];
    for (let i = 0; i < 12; i++) {
      if (recMeses[i] === 0 && i > 0) return i;   // mês 1-indexed
    }
    return 12;
  }, [dreData]);

  // Meses a exibir (0-indexed)
  const monthIndices = useMemo(
    () => Array.from({ length: upToMonth }, (_, i) => i),
    [upToMonth],
  );

  // Builder de chartData para uma métrica
  const buildChartData = (indices: number[]) => {
    const curKey = String(fiscalYear);
    const cmpKey = compareYear ? String(compareYear) : null;

    return monthIndices.map((mi, idx) => {
      const curVal = monthValue(dreData, indices, mi);
      const prevCurVal = idx > 0 ? monthValue(dreData, indices, monthIndices[idx - 1]) : null;
      const varCur = prevCurVal !== null && prevCurVal !== 0
        ? ((curVal - prevCurVal) / Math.abs(prevCurVal)) * 100
        : null;

      const row: Record<string, any> = {
        name: MONTH_LABELS[mi],
        [curKey]: curVal,
        [`var_${curKey}`]: varCur,
      };

      if (cmpKey && compareDreData) {
        const cmpVal = monthValue(compareDreData, indices, mi);
        const prevCmpVal = idx > 0 ? monthValue(compareDreData, indices, monthIndices[idx - 1]) : null;
        const varCmp = prevCmpVal !== null && prevCmpVal !== 0
          ? ((cmpVal - prevCmpVal) / Math.abs(prevCmpVal)) * 100
          : null;
        row[cmpKey] = cmpVal;
        row[`var_${cmpKey}`] = varCmp;
      }

      return row;
    });
  };

  // Verificar se há dados
  if (!dreData || dreData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Sem dados DRE disponíveis</h3>
          <Button variant="outline" size="sm" onClick={onClose}>Voltar</Button>
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
            Evolução Mensal — Resultados (DRE)
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fiscalYear} • Jan{upToMonth > 1 ? ` – ${MONTH_LABELS[upToMonth - 1]}` : ''}
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
        {METRIC_DEFS.map((def) => {
          const chartData = buildChartData(def.indices);
          const periodTotal = monthIndices.reduce(
            (s, mi) => s + monthValue(dreData, def.indices, mi), 0,
          );
          const comparePeriodTotal = compareYear && compareDreData
            ? monthIndices.reduce(
                (s, mi) => s + monthValue(compareDreData, def.indices, mi), 0,
              )
            : null;

          // Ocultar gráficos com todos os valores zerados
          const allZero = chartData.every(row => row[String(fiscalYear)] === 0);
          if (allZero && (!compareYear || !compareDreData || chartData.every(row => row[String(compareYear)] === 0))) {
            return null;
          }

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
                      dataKey={String(fiscalYear)}
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
