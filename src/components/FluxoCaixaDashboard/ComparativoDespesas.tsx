/**
 * Card de Comparativo de Despesas — permite comparar dois grupos de despesas
 * em dois períodos livremente selecionados (anual, mensal, bimestral,
 * trimestral ou semestral).
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { loadFluxoCaixaRaw } from './fluxoCaixaStorage';
import { loadDespesasTipos } from './despesasStorage';
import { GRUPOS_CONFIG, classificarTipo } from './DespesasTab';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PeriodoTipo = 'anual' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral';

interface PeriodoSel {
  year: number;
  index: number; // irrelevante para 'anual'
}

interface ComparativoDespesasProps {
  fmtBRL: (v: number, compact?: boolean) => string;
}

// ─── Opções de período ────────────────────────────────────────────────────────

const PERIODO_OPTIONS: Record<PeriodoTipo, { label: string; indices: Array<{ idx: number; label: string }> }> = {
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

const AVAILABLE_YEARS = [2024, 2025, 2026];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getMonths(tipo: PeriodoTipo, index: number): number[] {
  switch (tipo) {
    case 'anual': return [0];
    case 'mensal': return [index];
    case 'bimestral': {
      const s = (index - 1) * 2 + 1;
      return [s, s + 1];
    }
    case 'trimestral': {
      const s = (index - 1) * 3 + 1;
      return [s, s + 1, s + 2];
    }
    case 'semestral': {
      const s = (index - 1) * 6 + 1;
      return [s, s + 1, s + 2, s + 3, s + 4, s + 5];
    }
  }
}

function getPeriodLabel(tipo: PeriodoTipo, year: number, index: number): string {
  if (tipo === 'anual') return `Anual ${year}`;
  const opt = PERIODO_OPTIONS[tipo].indices.find((o) => o.idx === index);
  return opt ? `${opt.label} ${year}` : `${year}`;
}

/** Faz parse do texto bruto do balancete e retorna apenas contas do grupo 5 */
function parseGrupo5(rawText: string): Record<string, { valDeb: number; valCred: number }> {
  const result: Record<string, { valDeb: number; valCred: number }> = {};
  const parse = (v: string) =>
    parseFloat((v ?? '0').trim().replace(/\./g, '').replace(',', '.')) || 0;

  for (const line of rawText.split('\n')) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const nivel = parts[0]?.trim();
    const conta = parts[1]?.trim();
    if (nivel === 'T' || !conta || !conta.startsWith('5.')) continue;
    result[conta] = {
      valDeb: parse(parts[4]),
      valCred: parse(parts[5]),
    };
  }
  return result;
}

/** Retorna apenas as contas folha (sem filhos) de um dicionário de grupo 5 */
function grupo5Leaves(
  accounts: Record<string, { valDeb: number; valCred: number }>
): Array<{ conta: string; valor: number }> {
  const allKeys = Object.keys(accounts);
  return allKeys
    .filter((k) => !allKeys.some((other) => other !== k && other.startsWith(k + '.')))
    .sort()
    .map((k) => ({
      conta: k,
      valor: accounts[k].valDeb - accounts[k].valCred,
    }));
}

/** Carrega e agrega dados do grupo 5 para um período, retornando conta→valor */
async function loadPeriodData(
  tipo: PeriodoTipo,
  sel: PeriodoSel
): Promise<Record<string, number> | null> {
  const months = getMonths(tipo, sel.index);
  const aggregated: Record<string, { valDeb: number; valCred: number }> = {};
  let hasAny = false;

  for (const month of months) {
    const raw = await loadFluxoCaixaRaw(sel.year, month);
    if (!raw?.rawText) continue;
    hasAny = true;
    const accounts = parseGrupo5(raw.rawText);
    for (const [conta, vals] of Object.entries(accounts)) {
      if (!aggregated[conta]) aggregated[conta] = { valDeb: 0, valCred: 0 };
      aggregated[conta].valDeb += vals.valDeb;
      aggregated[conta].valCred += vals.valCred;
    }
  }

  if (!hasAny) return null;

  const result: Record<string, number> = {};
  for (const { conta, valor } of grupo5Leaves(aggregated)) {
    if (valor !== 0) result[conta] = valor;
  }
  return result;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const SELECT_CLASS =
  'appearance-none bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer';

export function ComparativoDespesas({ fmtBRL }: ComparativoDespesasProps) {
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>('mensal');
  const [grupo1Id, setGrupo1Id] = useState<string>(GRUPOS_CONFIG[0].id);
  const [grupo2Id, setGrupo2Id] = useState<string>('');
  const [periodoA, setPeriodoA] = useState<PeriodoSel>({ year: 2026, index: 1 });
  const [periodoB, setPeriodoB] = useState<PeriodoSel>({ year: 2025, index: 1 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataA, setDataA] = useState<Record<string, number> | null>(null);
  const [dataB, setDataB] = useState<Record<string, number> | null>(null);
  const [tipos, setTipos] = useState<Record<string, string>>({});
  const [hasResult, setHasResult] = useState(false);
  const [labelA, setLabelA] = useState('');
  const [labelB, setLabelB] = useState('');

  function changePeriodoTipo(tipo: PeriodoTipo) {
    setPeriodoTipo(tipo);
    setPeriodoA((p) => ({ ...p, index: 1 }));
    setPeriodoB((p) => ({ ...p, index: 1 }));
  }

  async function handleComparar() {
    setLoading(true);
    setError(null);
    setHasResult(false);
    try {
      const [tiposMap, rawA, rawB] = await Promise.all([
        loadDespesasTipos(),
        loadPeriodData(periodoTipo, periodoA),
        loadPeriodData(periodoTipo, periodoB),
      ]);

      setTipos(tiposMap);
      setDataA(rawA);
      setDataB(rawB);
      setLabelA(getPeriodLabel(periodoTipo, periodoA.year, periodoA.index));
      setLabelB(getPeriodLabel(periodoTipo, periodoB.year, periodoB.index));

      if (!rawA && !rawB) {
        setError('Nenhum balancete encontrado para os períodos selecionados. Verifique se os arquivos foram importados.');
      } else {
        setHasResult(true);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  /** Monta os dados de uma tabela de grupo para exibição */
  function buildGrupoTable(grupoId: string) {
    const grupoIdx = GRUPOS_CONFIG.findIndex((g) => g.id === grupoId);
    if (grupoIdx < 0) return null;
    const grupo = GRUPOS_CONFIG[grupoIdx];

    // Coletamos todos os tipos que pertencem a este grupo nos dois períodos
    const tiposSet = new Set<string>();
    const allContas = new Set([...Object.keys(dataA ?? {}), ...Object.keys(dataB ?? {})]);

    for (const conta of allContas) {
      const tipoLabel = tipos[conta]?.trim();
      if (!tipoLabel) continue;
      if (classificarTipo(tipoLabel) === grupoIdx) tiposSet.add(tipoLabel);
    }

    // Agrega valor por tipo para cada período
    const rows = Array.from(tiposSet).map((tipoLabel) => {
      let valorA = 0;
      let valorB = 0;
      for (const [conta, valor] of Object.entries(dataA ?? {})) {
        if (tipos[conta]?.trim() === tipoLabel) valorA += valor;
      }
      for (const [conta, valor] of Object.entries(dataB ?? {})) {
        if (tipos[conta]?.trim() === tipoLabel) valorB += valor;
      }
      return { tipo: tipoLabel, valorA, valorB };
    });

    rows.sort((a, b) => b.valorA - a.valorA);
    const totalA = rows.reduce((s, r) => s + r.valorA, 0);
    const totalB = rows.reduce((s, r) => s + r.valorB, 0);

    return { grupo, rows, totalA, totalB };
  }

  function fmtDiff(a: number, b: number) {
    const diff = a - b;
    const pct = b !== 0 ? ((diff) / Math.abs(b)) * 100 : null;
    return { diff, pct };
  }

  const gruposParaExibir = [grupo1Id, grupo2Id].filter(Boolean);

  return (
    <Card className="shadow-sm border border-indigo-200 dark:border-indigo-800">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-base flex items-center gap-2">
          <span>📊</span>
          Comparativo de Despesas
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Selecione até 2 grupos, o tipo de período e os dois períodos a comparar.
        </p>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        {/* ── Tipo de Período ── */}
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
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-background text-foreground border-border hover:bg-muted/60'
                )}
              >
                {PERIODO_OPTIONS[tipo].label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Períodos A e B ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Período A */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Período A
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={periodoA.year}
                onChange={(e) => setPeriodoA((p) => ({ ...p, year: Number(e.target.value) }))}
                className={SELECT_CLASS}
              >
                {AVAILABLE_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {periodoTipo !== 'anual' && (
                <select
                  value={periodoA.index}
                  onChange={(e) => setPeriodoA((p) => ({ ...p, index: Number(e.target.value) }))}
                  className={SELECT_CLASS}
                >
                  {PERIODO_OPTIONS[periodoTipo].indices.map((opt) => (
                    <option key={opt.idx} value={opt.idx}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Período B */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Período B
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={periodoB.year}
                onChange={(e) => setPeriodoB((p) => ({ ...p, year: Number(e.target.value) }))}
                className={SELECT_CLASS}
              >
                {AVAILABLE_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {periodoTipo !== 'anual' && (
                <select
                  value={periodoB.index}
                  onChange={(e) => setPeriodoB((p) => ({ ...p, index: Number(e.target.value) }))}
                  className={SELECT_CLASS}
                >
                  {PERIODO_OPTIONS[periodoTipo].indices.map((opt) => (
                    <option key={opt.idx} value={opt.idx}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ── Grupos de Despesas ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Grupo 1 (obrigatório) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Grupo 1
            </label>
            <select
              value={grupo1Id}
              onChange={(e) => setGrupo1Id(e.target.value)}
              className={cn(SELECT_CLASS, 'w-full')}
            >
              {GRUPOS_CONFIG.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.icon} {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Grupo 2 (opcional) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Grupo 2 <span className="font-normal normal-case">(opcional)</span>
            </label>
            <select
              value={grupo2Id}
              onChange={(e) => setGrupo2Id(e.target.value)}
              className={cn(SELECT_CLASS, 'w-full')}
            >
              <option value="">— Nenhum —</option>
              {GRUPOS_CONFIG.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.icon} {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Botão Comparar ── */}
        <div>
          <button
            onClick={handleComparar}
            disabled={loading}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
              loading
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                Carregando...
              </span>
            ) : (
              '🔍 Comparar'
            )}
          </button>
        </div>

        {/* ── Erro ── */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* ── Resultados ── */}
        {hasResult && !loading && (
          <div className="space-y-6 pt-1">
            {gruposParaExibir.map((grupoId) => {
              const result = buildGrupoTable(grupoId);
              if (!result) return null;
              const { grupo, rows, totalA, totalB } = result;
              const { diff: totalDiff, pct: totalPct } = fmtDiff(totalA, totalB);
              const noDataA = dataA === null;
              const noDataB = dataB === null;

              return (
                <div key={grupoId} className="rounded-lg overflow-hidden border border-border shadow-sm">
                  {/* Cabeçalho do grupo */}
                  <div className={cn('px-4 py-3 flex items-center justify-between', grupo.headerBg)}>
                    <div className={cn('flex items-center gap-2 font-bold text-sm', grupo.headerText)}>
                      <span className="text-base">{grupo.icon}</span>
                      {grupo.label}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      {noDataA && (
                        <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                          ⚠️ Sem dados para {labelA}
                        </span>
                      )}
                      {noDataB && (
                        <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                          ⚠️ Sem dados para {labelB}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tabela comparativa */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Subcategoria
                          </th>
                          <th className="py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {labelA}
                          </th>
                          <th className="py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            {labelB}
                          </th>
                          <th className="py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Variação (R$)
                          </th>
                          <th className="py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            Var. (%)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-6 px-4 text-center text-sm text-muted-foreground italic"
                            >
                              Nenhuma despesa classificada neste grupo para os períodos selecionados
                            </td>
                          </tr>
                        ) : (
                          rows.map((row, i) => {
                            const { diff, pct } = fmtDiff(row.valorA, row.valorB);
                            const diffColor =
                              diff > 0
                                ? 'text-red-600 dark:text-red-400'
                                : diff < 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-muted-foreground';
                            return (
                              <tr
                                key={row.tipo}
                                className={cn(
                                  grupo.rowHover,
                                  'transition-colors',
                                  i < rows.length - 1 ? 'border-b border-border/40' : ''
                                )}
                              >
                                <td className="py-2 px-4 text-sm text-foreground">{row.tipo}</td>
                                <td className="py-2 px-3 text-right text-sm font-mono text-blue-700 dark:text-blue-300 whitespace-nowrap">
                                  {row.valorA !== 0 ? fmtBRL(row.valorA) : '—'}
                                </td>
                                <td className="py-2 px-3 text-right text-sm font-mono text-amber-700 dark:text-amber-300 whitespace-nowrap">
                                  {row.valorB !== 0 ? fmtBRL(row.valorB) : '—'}
                                </td>
                                <td className={cn('py-2 px-3 text-right text-sm font-mono font-semibold whitespace-nowrap', diffColor)}>
                                  {diff >= 0 ? '+' : ''}{fmtBRL(diff)}
                                </td>
                                <td className={cn('py-2 px-3 text-right text-xs font-mono font-semibold whitespace-nowrap', diffColor)}>
                                  {pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {rows.length > 0 && (
                        <tfoot>
                          <tr className={cn('border-t-2 border-border', grupo.headerBg)}>
                            <td className={cn('py-2.5 px-4 text-xs font-bold uppercase tracking-wide', grupo.headerText)}>
                              Total
                            </td>
                            <td className={cn('py-2.5 px-3 text-right text-sm font-mono font-bold', grupo.totalColor)}>
                              {fmtBRL(totalA)}
                            </td>
                            <td className={cn('py-2.5 px-3 text-right text-sm font-mono font-bold', grupo.totalColor)}>
                              {fmtBRL(totalB)}
                            </td>
                            <td
                              className={cn(
                                'py-2.5 px-3 text-right text-sm font-mono font-bold whitespace-nowrap',
                                totalDiff > 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : totalDiff < 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {totalDiff >= 0 ? '+' : ''}{fmtBRL(totalDiff)}
                            </td>
                            <td
                              className={cn(
                                'py-2.5 px-3 text-right text-xs font-mono font-bold whitespace-nowrap',
                                totalDiff > 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : totalDiff < 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {totalPct !== null ? `${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
