/**
 * ProjecaoCaixaChart — Histórico + Projeção do Saldo de Caixa
 *
 * Carrega todos os balancetes importados, extrai o saldo de Disponibilidades
 * (conta 1.1.1) e projeta os próximos 3 meses com base na média das variações
 * mensais recentes. Exibe band de confiança (± 1 desvio-padrão).
 */

import { useState, useEffect } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { loadFluxoCaixaIndex, loadFluxoCaixaRaw } from './fluxoCaixaStorage';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const N_FORECAST = 3;
const N_DELTA_BASE = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDisponib(rawText: string): number {
  for (const line of rawText.split('\n')) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    if (parts[1]?.trim() === '1.1.1') {
      const raw = (parts[6] || '0').trim().replace(/\./g, '').replace(',', '.');
      return Math.abs(parseFloat(raw) || 0);
    }
  }
  return 0;
}

function periodLabel(year: number, month: number): string {
  return `${MONTH_SHORT[month - 1]}/${String(year).slice(2)}`;
}

function nextPeriod(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function fmtBRL(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `R$ ${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `R$ ${(abs / 1e3).toFixed(0)}k`;
  return 'R$ ' + abs.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function fmtYAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(v);
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ChartPoint = {
  label: string;
  saldo?: number;
  projecao?: number;
  bandaMin?: number;
  bandaMax?: number;
};

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const saldo = payload.find((p: any) => p.dataKey === 'saldo');
  const projecao = payload.find((p: any) => p.dataKey === 'projecao');
  const bandaMin = payload.find((p: any) => p.dataKey === 'bandaMin');
  const bandaMax = payload.find((p: any) => p.dataKey === 'bandaMax');
  const isForecast = !saldo && !!projecao;

  return (
    <div className="bg-white dark:bg-slate-800 border border-border rounded-lg shadow-xl p-3 text-xs min-w-[180px]">
      <p className="font-bold text-foreground mb-2 text-sm">{label}</p>

      {saldo && (
        <div className="flex justify-between gap-4 mb-1">
          <span className="text-muted-foreground">Saldo realizado</span>
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            {fmtBRL(saldo.value)}
          </span>
        </div>
      )}

      {isForecast && projecao && (
        <>
          <div className="flex justify-between gap-4 mb-1">
            <span className="text-muted-foreground">Projeção</span>
            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
              {fmtBRL(projecao.value)}
            </span>
          </div>
          {bandaMin && bandaMax && (
            <div className="flex justify-between gap-4 text-muted-foreground/70">
              <span>Intervalo</span>
              <span className="font-mono">
                {fmtBRL(bandaMin.value)} – {fmtBRL(bandaMax.value)}
              </span>
            </div>
          )}
          <p className="mt-2 text-muted-foreground/60 text-[10px] leading-tight">
            * Projeção baseada na média das variações recentes (± 1 DP)
          </p>
        </>
      )}

      {/* Ponto de conexão: tem ambos saldo e projecao */}
      {saldo && projecao && (
        <p className="mt-1.5 text-muted-foreground/60 text-[10px]">
          Início da projeção a partir deste período
        </p>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface ProjecaoCaixaChartProps {
  currentYear: number;
  currentMonth: number;
}

export function ProjecaoCaixaChart({ currentYear, currentMonth }: ProjecaoCaixaChartProps) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [historicalCount, setHistoricalCount] = useState(0);
  const [avgDelta, setAvgDelta] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const index = await loadFluxoCaixaIndex();
        const available = Object.keys(index)
          .map(k => {
            const [y, m] = k.split('_');
            return { year: parseInt(y), month: parseInt(m) };
          })
          .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

        if (available.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Carrega o saldo de disponibilidades de cada período
        const historical: { year: number; month: number; saldo: number }[] = [];
        for (const p of available) {
          const raw = await loadFluxoCaixaRaw(p.year, p.month);
          if (raw?.rawText) {
            historical.push({ year: p.year, month: p.month, saldo: extractDisponib(raw.rawText) });
          }
        }

        if (historical.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Constrói os pontos históricos
        const chartPoints: ChartPoint[] = historical.map(h => ({
          label: periodLabel(h.year, h.month),
          saldo: h.saldo,
        }));

        let computedAvgDelta: number | null = null;

        // Projeta apenas se houver pelo menos 2 períodos históricos
        if (historical.length >= 2) {
          const totalDeltas = historical.length - 1;
          const useCount = Math.min(N_DELTA_BASE, totalDeltas);
          const deltas: number[] = [];
          for (let i = historical.length - useCount; i < historical.length; i++) {
            deltas.push(historical[i].saldo - historical[i - 1].saldo);
          }

          const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
          const variance = deltas.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / deltas.length;
          const stdDev = Math.sqrt(variance);
          computedAvgDelta = avg;

          // Ponto de conexão: último histórico também inicia a projeção
          chartPoints[chartPoints.length - 1] = {
            ...chartPoints[chartPoints.length - 1],
            projecao: historical[historical.length - 1].saldo,
            bandaMin: historical[historical.length - 1].saldo,
            bandaMax: historical[historical.length - 1].saldo,
          };

          let prev = historical[historical.length - 1];
          for (let i = 1; i <= N_FORECAST; i++) {
            const p = nextPeriod(prev.year, prev.month);
            const projected = prev.saldo + avg;
            chartPoints.push({
              label: periodLabel(p.year, p.month),
              projecao: Math.max(0, projected),
              bandaMin: Math.max(0, projected - stdDev),
              bandaMax: projected + stdDev,
            });
            prev = { year: p.year, month: p.month, saldo: projected };
          }
        }

        if (!cancelled) {
          setPoints(chartPoints);
          setHistoricalCount(historical.length);
          setAvgDelta(computedAvgDelta);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [currentYear, currentMonth]);

  // ─── Renderings ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="mt-6 border-border/60">
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm gap-2">
          <span className="animate-spin text-base">⏳</span>
          Carregando histórico de caixa…
        </CardContent>
      </Card>
    );
  }

  if (points.length === 0) {
    return (
      <Card className="mt-6 border-border/60">
        <CardContent className="flex items-center justify-center h-32 text-muted-foreground text-sm text-center p-6">
          Nenhum período importado para exibir a projeção de caixa.
        </CardContent>
      </Card>
    );
  }

  const lastHistorical = points.filter(p => p.saldo !== undefined).at(-1);
  const lastForecast = points.filter(p => p.projecao !== undefined && p.saldo === undefined).at(-1);
  const hasForecast = historicalCount >= 2;

  const tendencia = avgDelta === null ? null : avgDelta > 0 ? 'alta' : avgDelta < 0 ? 'baixa' : 'estavel';

  // Índice do primeiro ponto de projeção (para linha divisória)
  const splitIndex = points.findIndex(p => p.projecao !== undefined && p.saldo === undefined);
  const splitLabel = splitIndex > 0 ? points[splitIndex].label : null;

  return (
    <Card className="mt-6 border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              Evolução e Projeção do Saldo de Caixa
              {tendencia === 'alta' && <TrendingUp className="h-4 w-4 text-emerald-500" />}
              {tendencia === 'baixa' && <TrendingDown className="h-4 w-4 text-red-500" />}
              {tendencia === 'estavel' && <Minus className="h-4 w-4 text-amber-500" />}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conta 1.1.1 — Disponibilidades (Caixa + Bancos + Aplicações)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              {historicalCount} {historicalCount === 1 ? 'mês realizado' : 'meses realizados'}
            </Badge>
            {hasForecast && (
              <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                <span className="w-2.5 h-[2px] rounded bg-blue-400 inline-block" />
                Projeção {N_FORECAST} meses
              </Badge>
            )}
          </div>
        </div>

        {/* KPI summary strip */}
        {lastHistorical && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Saldo atual</span>
              <p className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                {fmtBRL(lastHistorical.saldo!)}
              </p>
            </div>
            {hasForecast && avgDelta !== null && (
              <div>
                <span className="text-muted-foreground">Variação média mensal</span>
                <p className={`font-mono font-bold text-sm ${avgDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {avgDelta >= 0 ? '+' : ''}{fmtBRL(avgDelta)}
                </p>
              </div>
            )}
            {hasForecast && lastForecast?.projecao !== undefined && (
              <div>
                <span className="text-muted-foreground">Projeção {lastForecast.label}</span>
                <p className={`font-mono font-bold text-sm ${lastForecast.projecao >= lastHistorical.saldo! ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {fmtBRL(lastForecast.projecao)}
                </p>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pb-4">
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gradHistorico" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={fmtYAxis}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
                className="text-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Linha divisória histórico / projeção */}
              {splitLabel && (
                <ReferenceLine
                  x={splitLabel}
                  stroke="#94a3b8"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: 'Hoje', position: 'insideTopLeft', fontSize: 10, fill: '#94a3b8' }}
                />
              )}

              {/* Banda de confiança */}
              {hasForecast && (
                <Area
                  type="monotone"
                  dataKey="bandaMax"
                  stroke="none"
                  fill="#3b82f6"
                  fillOpacity={0.08}
                  legendType="none"
                  isAnimationActive={false}
                  connectNulls
                />
              )}
              {hasForecast && (
                <Area
                  type="monotone"
                  dataKey="bandaMin"
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={1}
                  legendType="none"
                  isAnimationActive={false}
                  connectNulls
                />
              )}

              {/* Linha histórica */}
              <Line
                type="monotone"
                dataKey="saldo"
                name="Realizado"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
                isAnimationActive={true}
              />

              {/* Linha de projeção */}
              {hasForecast && (
                <Line
                  type="monotone"
                  dataKey="projecao"
                  name="Projetado"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                  isAnimationActive={true}
                />
              )}

              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {hasForecast && (
          <p className="mt-3 text-[11px] text-muted-foreground/60 leading-relaxed flex gap-1.5 items-start">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            Projeção calculada com base na média das variações dos últimos {Math.min(N_DELTA_BASE, historicalCount - 1)} {historicalCount - 1 === 1 ? 'mês' : 'meses'}.
            A faixa sombreada representa ± 1 desvio-padrão das variações históricas.
            Não constitui previsão financeira formal.
          </p>
        )}
        {!hasForecast && historicalCount === 1 && (
          <p className="mt-3 text-[11px] text-muted-foreground/60 leading-relaxed flex gap-1.5 items-start">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            Importe pelo menos 2 períodos para habilitar a projeção de caixa.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
