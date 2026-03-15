/**
 * Gráficos de Evolução — Passivo + PL
 * Exibe 4 gráficos de barras mês a mês:
 *   1. Passivo Circulante       (conta 2.1)
 *   2. Passivo Não Circulante   (conta 2.2)
 *   3. Patrimônio Líquido       (conta 2.3)
 *   4. Total Passivo + PL       (2.1 + 2.2 + 2.3)
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

interface Props {
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
}

const CONTA_PASS_CIRC     = '2.1';
const CONTA_PASS_NAO_CIRC = '2.2';
const CONTA_PL            = '2.3';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Parser ───────────────────────────────────────────────────────────────────
function extractPassivoValues(rawText: string): { passCirc: number; passNaoCirc: number; pl: number } {
  let passCirc = 0;
  let passNaoCirc = 0;
  let pl = 0;
  const lines = rawText.split('\n');
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [, conta, , , , , saldoAtual] = parts;
    const id = conta?.trim();
    if (!id) continue;
    if (id === CONTA_PASS_CIRC || id === CONTA_PASS_NAO_CIRC || id === CONTA_PL) {
      const val = Math.abs(parseFloat((saldoAtual || '0').trim().replace(/\./g, '').replace(',', '.')) || 0);
      if (id === CONTA_PASS_CIRC)     passCirc    = val;
      else if (id === CONTA_PASS_NAO_CIRC) passNaoCirc = val;
      else                                 pl          = val;
    }
  }
  return { passCirc, passNaoCirc, pl };
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
export function PassivoCharts({ selectedYear, selectedMonth, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [passCircData,    setPassCircData]    = useState<Record<number, number>>({});
  const [passNaoCircData, setPassNaoCircData] = useState<Record<number, number>>({});
  const [plData,          setPlData]          = useState<Record<number, number>>({});

  // Comparativo
  const [compareYear,         setCompareYear]         = useState<number | null>(null);
  const [availableYears,      setAvailableYears]      = useState<number[]>([]);
  const [cmpPassCircData,     setCmpPassCircData]     = useState<Record<number, number>>({});
  const [cmpPassNaoCircData,  setCmpPassNaoCircData]  = useState<Record<number, number>>({});
  const [cmpPlData,           setCmpPlData]           = useState<Record<number, number>>({});

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

    const passCirc:    Record<number, number> = {};
    const passNaoCirc: Record<number, number> = {};
    const pl:          Record<number, number> = {};

    for (const month of months) {
      const raw = rawMap[month];
      if (!raw) continue;
      const vals = extractPassivoValues(raw);
      passCirc[month]    = vals.passCirc;
      passNaoCirc[month] = vals.passNaoCirc;
      pl[month]          = vals.pl;
    }
    return { passCirc, passNaoCirc, pl };
  }, []);

  // Carrega ano principal
  useEffect(() => {
    (async () => {
      setLoading(true);
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const { passCirc, passNaoCirc, pl } = await loadYearData(selectedYear, upTo);
      setPassCircData(passCirc);
      setPassNaoCircData(passNaoCirc);
      setPlData(pl);
      setLoading(false);
    })();
  }, [selectedYear, selectedMonth, loadYearData]);

  // Carrega ano comparativo
  useEffect(() => {
    if (!compareYear) {
      setCmpPassCircData({});
      setCmpPassNaoCircData({});
      setCmpPlData({});
      return;
    }
    (async () => {
      const upTo = selectedMonth === 0 ? 12 : selectedMonth;
      const { passCirc, passNaoCirc, pl } = await loadYearData(compareYear, upTo);
      setCmpPassCircData(passCirc);
      setCmpPassNaoCircData(passNaoCirc);
      setCmpPlData(pl);
    })();
  }, [compareYear, selectedMonth, loadYearData]);

  const upToMonth = selectedMonth === 0 ? 12 : selectedMonth;
  const months = Array.from({ length: upToMonth }, (_, i) => i + 1);

  const buildChartData = (
    currentData: Record<number, number>,
    compareData: Record<number, number>,
  ) => {
    const curKey = String(selectedYear);
    const cmpKey = compareYear ? String(compareYear) : null;
    return months.map((m, idx) => {
      const curVal = currentData[m] || 0;
      const prevCurVal = idx > 0 ? (currentData[months[idx - 1]] || 0) : null;
      const varCur = prevCurVal !== null && prevCurVal !== 0 ? ((curVal - prevCurVal) / prevCurVal) * 100 : null;

      const row: Record<string, any> = {
        name: MONTH_LABELS[m - 1],
        [curKey]: curVal,
        [`var_${curKey}`]: varCur,
      };

      if (cmpKey) {
        const cmpVal = compareData[m] || 0;
        const prevCmpVal = idx > 0 ? (compareData[months[idx - 1]] || 0) : null;
        const varCmp = prevCmpVal !== null && prevCmpVal !== 0 ? ((cmpVal - prevCmpVal) / prevCmpVal) * 100 : null;
        row[cmpKey] = cmpVal;
        row[`var_${cmpKey}`] = varCmp;
      }

      return row;
    });
  };

  // Total = PC + PNC + PL
  const buildTotalData = (
    aPassCirc: Record<number, number>,
    aPassNaoCirc: Record<number, number>,
    aPl: Record<number, number>,
  ) => {
    const result: Record<number, number> = {};
    for (const m of months) result[m] = (aPassCirc[m] || 0) + (aPassNaoCirc[m] || 0) + (aPl[m] || 0);
    return result;
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

  const totalData    = buildTotalData(passCircData,    passNaoCircData,    plData);
  const cmpTotalData = buildTotalData(cmpPassCircData, cmpPassNaoCircData, cmpPlData);

  const charts = [
    { title: 'Passivo Circulante',     subtitle: 'Conta 2.1 — Total', cur: passCircData,    cmp: cmpPassCircData    },
    { title: 'Passivo Não Circulante', subtitle: 'Conta 2.2 — Total', cur: passNaoCircData, cmp: cmpPassNaoCircData },
    { title: 'Patrimônio Líquido',     subtitle: 'Conta 2.3 — Total', cur: plData,          cmp: cmpPlData          },
    { title: 'Total Passivo + PL',     subtitle: '2.1 + 2.2 + 2.3',  cur: totalData,       cmp: cmpTotalData       },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Evolução Mensal — Passivo + PL
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedYear} • Jan{upToMonth > 1 ? ` – ${MONTH_LABELS[upToMonth - 1]}` : ''} • Circulante, Não Circulante, PL e Total
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

      {/* Gráficos */}
      {charts.map(({ title, subtitle, cur, cmp }) => (
        <Card key={title}>
          <CardContent className="pt-5 pb-4">
            <div className="mb-3">
              <h4 className="text-base font-bold text-foreground">{title}</h4>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={buildChartData(cur, cmp)} barGap={compareYear ? 2 : 0}>
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
      ))}
    </div>
  );
}
