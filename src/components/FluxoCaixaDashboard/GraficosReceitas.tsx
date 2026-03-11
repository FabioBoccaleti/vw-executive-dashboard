/**
 * Página de Gráficos de Receitas — exibe um gráfico de barras lado a lado
 * por conta contábil, para cada grupo selecionado no Comparativo de Receitas.
 */

import { useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { loadFluxoCaixaRaw } from './fluxoCaixaStorage';
import { GRUPOS_RECEITA_CONFIG, loadReceitaPeriodData, type GrupoReceitaResult } from './ComparativoReceitas';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PeriodoTipo = 'anual' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral';

export interface PeriodoSel {
  year: number;
  index: number;
}

// ─── Helpers de período ───────────────────────────────────────────────────────

export const PERIODO_OPTIONS: Record<PeriodoTipo, { label: string; indices: Array<{ idx: number; label: string }> }> = {
  anual: { label: 'Anual', indices: [] },
  mensal: {
    label: 'Mensal',
    indices: [
      { idx: 1, label: 'Janeiro' }, { idx: 2, label: 'Fevereiro' },
      { idx: 3, label: 'Março' }, { idx: 4, label: 'Abril' },
      { idx: 5, label: 'Maio' }, { idx: 6, label: 'Junho' },
      { idx: 7, label: 'Julho' }, { idx: 8, label: 'Agosto' },
      { idx: 9, label: 'Setembro' }, { idx: 10, label: 'Outubro' },
      { idx: 11, label: 'Novembro' }, { idx: 12, label: 'Dezembro' },
    ],
  },
  bimestral: {
    label: 'Bimestral',
    indices: [
      { idx: 1, label: '1º Bim (Jan-Fev)' }, { idx: 2, label: '2º Bim (Mar-Abr)' },
      { idx: 3, label: '3º Bim (Mai-Jun)' }, { idx: 4, label: '4º Bim (Jul-Ago)' },
      { idx: 5, label: '5º Bim (Set-Out)' }, { idx: 6, label: '6º Bim (Nov-Dez)' },
    ],
  },
  trimestral: {
    label: 'Trimestral',
    indices: [
      { idx: 1, label: '1º Tri (Jan-Mar)' }, { idx: 2, label: '2º Tri (Abr-Jun)' },
      { idx: 3, label: '3º Tri (Jul-Set)' }, { idx: 4, label: '4º Tri (Out-Dez)' },
    ],
  },
  semestral: {
    label: 'Semestral',
    indices: [
      { idx: 1, label: '1º Sem (Jan-Jun)' }, { idx: 2, label: '2º Sem (Jul-Dez)' },
    ],
  },
};

export const AVAILABLE_YEARS = [2024, 2025, 2026];

function getPeriodLabel(tipo: PeriodoTipo, year: number, index: number): string {
  if (tipo === 'anual') return `Anual ${year}`;
  const opt = PERIODO_OPTIONS[tipo].indices.find((o) => o.idx === index);
  return opt ? `${opt.label} ${year}` : `${year}`;
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, fmtBRL }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-semibold text-foreground">{fmtBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const SELECT_CLASS =
  'appearance-none bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer';

interface GraficosReceitasProps {
  initialGrupos: GrupoReceitaResult[];
  initialLabelA: string;
  initialLabelB: string;
  initialPeriodoTipo: PeriodoTipo;
  initialPeriodoA: PeriodoSel;
  initialPeriodoB: PeriodoSel;
  fmtBRL: (v: number, compact?: boolean) => string;
  onVoltar: () => void;
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function GraficosReceitas({
  initialGrupos,
  initialLabelA,
  initialLabelB,
  initialPeriodoTipo,
  initialPeriodoA,
  initialPeriodoB,
  fmtBRL,
  onVoltar,
}: GraficosReceitasProps) {
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>(initialPeriodoTipo);
  const [periodoA, setPeriodoA] = useState<PeriodoSel>(initialPeriodoA);
  const [periodoB, setPeriodoB] = useState<PeriodoSel>(initialPeriodoB);
  const [labelA, setLabelA] = useState(initialLabelA);
  const [labelB, setLabelB] = useState(initialLabelB);
  const [grupos, setGrupos] = useState<GrupoReceitaResult[]>(initialGrupos);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGrupo1Id, setSelectedGrupo1Id] = useState<string>(initialGrupos[0]?.grupoId ?? GRUPOS_RECEITA_CONFIG[0].id);
  const [selectedGrupo2Id, setSelectedGrupo2Id] = useState<string>(initialGrupos[1]?.grupoId ?? '');

  const handleAtualizar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawA, rawB] = await Promise.all([
        loadReceitaPeriodData(periodoTipo, periodoA),
        loadReceitaPeriodData(periodoTipo, periodoB),
      ]);
      if (!rawA && !rawB) {
        setError('Nenhum balancete encontrado para os períodos selecionados.');
        return;
      }
      setLabelA(getPeriodLabel(periodoTipo, periodoA.year, periodoA.index));
      setLabelB(getPeriodLabel(periodoTipo, periodoB.year, periodoB.index));

      const activeIds = [selectedGrupo1Id, selectedGrupo2Id].filter(Boolean);
      setGrupos(
        activeIds.map((id) => {
          const g = GRUPOS_RECEITA_CONFIG.find((g) => g.id === id)!;
          const rows = g.contas.map((c) => ({
            conta: c.conta,
            desc: c.desc || c.conta,
            valorA: rawA?.[c.conta] ?? 0,
            valorB: rawB?.[c.conta] ?? 0,
          })).filter((r) => r.valorA !== 0 || r.valorB !== 0);
          return { grupoId: id, rows };
        })
      );
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [periodoTipo, periodoA, periodoB, selectedGrupo1Id, selectedGrupo2Id]);

  function changePeriodoTipo(tipo: PeriodoTipo) {
    setPeriodoTipo(tipo);
    setPeriodoA((p) => ({ ...p, index: 1 }));
    setPeriodoB((p) => ({ ...p, index: 1 }));
  }

  const fmtYAxis = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return String(v);
  };

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onVoltar}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border bg-muted/40 hover:bg-muted/70 transition-colors text-foreground shadow-sm"
          >
            ← Voltar ao Comparativo
          </button>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span>📈</span> Gráficos de Receitas
          </h2>
        </div>
      </div>

      {/* ── Controles ── */}
      <Card className="border border-emerald-200 dark:border-emerald-800 shadow-sm">
        <CardContent className="pt-5 space-y-4">
          {/* Tipo de período */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Tipo de Período
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PERIODO_OPTIONS) as PeriodoTipo[]).map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => changePeriodoTipo(tipo)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md font-medium transition-colors border',
                    periodoTipo === tipo
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-background text-foreground border-border hover:bg-muted/60'
                  )}
                >
                  {PERIODO_OPTIONS[tipo].label}
                </button>
              ))}
            </div>
          </div>

          {/* Seletores de Grupo */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Grupo 1
              </label>
              <select
                value={selectedGrupo1Id}
                onChange={(e) => setSelectedGrupo1Id(e.target.value)}
                className={cn(SELECT_CLASS, 'w-full max-w-sm')}
              >
                {GRUPOS_RECEITA_CONFIG.map((g) => (
                  <option key={g.id} value={g.id}>{g.icon} {g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Grupo 2 <span className="text-muted-foreground font-normal normal-case">(opcional)</span>
              </label>
              <select
                value={selectedGrupo2Id}
                onChange={(e) => setSelectedGrupo2Id(e.target.value)}
                className={cn(SELECT_CLASS, 'w-full max-w-sm')}
              >
                <option value="">— Nenhum —</option>
                {GRUPOS_RECEITA_CONFIG.map((g) => (
                  <option key={g.id} value={g.id}>{g.icon} {g.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Períodos A e B */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Período A
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <select value={periodoA.year} onChange={(e) => setPeriodoA((p) => ({ ...p, year: Number(e.target.value) }))} className={SELECT_CLASS}>
                  {AVAILABLE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                {periodoTipo !== 'anual' && (
                  <select value={periodoA.index} onChange={(e) => setPeriodoA((p) => ({ ...p, index: Number(e.target.value) }))} className={SELECT_CLASS}>
                    {PERIODO_OPTIONS[periodoTipo].indices.map((opt) => <option key={opt.idx} value={opt.idx}>{opt.label}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Período B
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <select value={periodoB.year} onChange={(e) => setPeriodoB((p) => ({ ...p, year: Number(e.target.value) }))} className={SELECT_CLASS}>
                  {AVAILABLE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                {periodoTipo !== 'anual' && (
                  <select value={periodoB.index} onChange={(e) => setPeriodoB((p) => ({ ...p, index: Number(e.target.value) }))} className={SELECT_CLASS}>
                    {PERIODO_OPTIONS[periodoTipo].indices.map((opt) => <option key={opt.idx} value={opt.idx}>{opt.label}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAtualizar}
              disabled={loading}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
                loading ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                  Atualizando...
                </span>
              ) : '🔄 Atualizar Gráficos'}
            </button>
            {(labelA || labelB) && (
              <p className="text-xs text-muted-foreground">
                Exibindo: <span className="font-semibold text-blue-600">{labelA}</span> vs <span className="font-semibold text-amber-600">{labelB}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              ⚠️ {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Gráficos por Grupo ── */}
      {grupos.map(({ grupoId, rows }) => {
        const grupoConfig = GRUPOS_RECEITA_CONFIG.find((g) => g.id === grupoId);
        if (!grupoConfig || rows.length === 0) return null;

        return (
          <div key={grupoId} className="space-y-4">
            <div className={cn('px-4 py-3 rounded-t-lg flex items-center gap-2 font-bold text-sm', grupoConfig.headerBg, grupoConfig.headerText)}>
              <span className="text-base">{grupoConfig.icon}</span>
              {grupoConfig.label}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map(({ conta, desc, valorA, valorB }) => {
                const chartData = [
                  { periodo: labelA, valor: valorA, fill: '#3b82f6' },
                  { periodo: labelB, valor: valorB, fill: '#f59e0b' },
                ];
                return (
                  <Card key={conta} className="shadow-sm overflow-hidden">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm font-semibold text-foreground leading-tight">
                        {toTitleCase(desc)}
                        <span className="block text-xs font-mono font-normal text-muted-foreground mt-0.5">{conta}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-4">
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart
                          data={chartData}
                          margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                          barCategoryGap="30%"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="periodo"
                            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={fmtYAxis}
                            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                            width={52}
                          />
                          <Tooltip
                            content={<CustomTooltip fmtBRL={fmtBRL} />}
                            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                          />
                          <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={60}>
                            {chartData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>

                      <div className="flex justify-between mt-2 px-2 text-xs">
                        <div className="text-center">
                          <div className="text-blue-600 font-mono font-semibold">{fmtBRL(valorA)}</div>
                          <div className="text-muted-foreground">{labelA}</div>
                        </div>
                        <div className="text-center">
                          {(() => {
                            const diff = valorA - valorB;
                            const pct = valorB !== 0 ? (diff / Math.abs(valorB)) * 100 : null;
                            const color = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-muted-foreground';
                            return (
                              <>
                                <div className={cn('font-mono font-semibold', color)}>
                                  {diff >= 0 ? '+' : ''}{fmtBRL(diff)}
                                </div>
                                <div className={cn('font-semibold', color)}>
                                  {pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        <div className="text-center">
                          <div className="text-amber-600 font-mono font-semibold">{fmtBRL(valorB)}</div>
                          <div className="text-muted-foreground">{labelB}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
