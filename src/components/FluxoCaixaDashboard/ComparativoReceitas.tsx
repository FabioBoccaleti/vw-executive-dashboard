/**
 * Card de Comparativo de Receitas — permite comparar dois grupos de receitas
 * em dois períodos livremente selecionados (anual, mensal, bimestral,
 * trimestral ou semestral).
 *
 * Os grupos são fixos e definidos por código contábil:
 *  1 — Receita de Vendas
 *  2 — Bonificações
 *  3 — Comissões
 *  4 — Recuperação de Impostos
 *  5 — Outras Receitas
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { loadFluxoCaixaRaw } from './fluxoCaixaStorage';
import { GraficosReceitas } from './GraficosReceitas';
import type { PeriodoTipo, PeriodoSel } from './GraficosReceitas';
import { PERIODO_OPTIONS, AVAILABLE_YEARS } from './GraficosReceitas';


// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface GrupoReceitaContaRef {
  /** Código da conta principal (para PAIRED: código da conta bruta) */
  conta: string;
  /** Código da conta de dedução (somente contas PAIRED) */
  deducao?: string;
  /** Descrição da conta (preenchida no carregamento) */
  desc: string;
}

export interface GrupoReceitaConfig {
  id: string;
  label: string;
  icon: string;
  borderClass: string;
  headerBg: string;
  headerText: string;
  badgeBg: string;
  totalColor: string;
  rowHover: string;
  contas: GrupoReceitaContaRef[];
}

export interface GrupoReceitaRow {
  conta: string;
  desc: string;
  valorA: number;
  valorB: number;
}

export interface GrupoReceitaResult {
  grupoId: string;
  rows: GrupoReceitaRow[];
}

// ─── Definição dos grupos fixos de receita ────────────────────────────────────

export const GRUPOS_RECEITA_CONFIG: GrupoReceitaConfig[] = [
  {
    id: 'vendas',
    label: 'Receita de Vendas',
    icon: '🏷️',
    borderClass: 'border-t-4 border-t-blue-500',
    headerBg: 'bg-blue-50 dark:bg-blue-950/20',
    headerText: 'text-blue-700 dark:text-blue-300',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    totalColor: 'text-blue-700 dark:text-blue-300',
    rowHover: 'hover:bg-blue-50/50 dark:hover:bg-blue-950/10',
    contas: [
      { conta: '3.1.1.01.01.001', deducao: '3.3.1.01.01.001', desc: 'Veículos Nacionais / Importados' },
      { conta: '3.1.1.01.01.002', deducao: '3.3.1.01.01.005', desc: 'Veículos Nacionais / Importados - Audi' },
      { conta: '3.1.1.03.01.001', deducao: '3.3.1.01.01.002', desc: 'Veículos Usados' },
      { conta: '3.1.1.03.01.002', deducao: '3.3.1.01.01.006', desc: 'Veículos Usados - Audi' },
      { conta: '3.1.2.01.01.001', deducao: '3.3.1.01.01.003', desc: 'Peças Balcão VW' },
      { conta: '3.1.2.01.01.002', deducao: '3.3.1.01.01.007', desc: 'Peças Balcão - Audi' },
      { conta: '3.1.3.01.01.001', desc: 'Peças e Serviços' },
      { conta: '3.1.3.01.01.002', desc: 'Peças e Serviços - Audi' },
      { conta: '3.1.3.01.01.003', desc: 'Vendas Internas VW' },
      { conta: '3.1.3.01.01.004', desc: 'Vendas Internas Audi' },
      { conta: '3.1.3.01.01.005', desc: 'Venda Garantia - VW' },
      { conta: '3.1.3.01.01.006', desc: 'Venda Garantia - Audi' },
      { conta: '3.6.1.01.02.001', desc: 'Venda de Veículos de Uso Firma' },
    ],
  },
  {
    id: 'bonificacoes',
    label: 'Bonificações',
    icon: '🎯',
    borderClass: 'border-t-4 border-t-emerald-500',
    headerBg: 'bg-emerald-50 dark:bg-emerald-950/20',
    headerText: 'text-emerald-700 dark:text-emerald-300',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    totalColor: 'text-emerald-700 dark:text-emerald-300',
    rowHover: 'hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10',
    contas: [
      { conta: '3.4.1.02.02.002', desc: 'Plano de Vendas Veículos' },
      { conta: '3.4.1.08.01.001', desc: 'PIV Plano de Incentivo de Vendas' },
      { conta: '3.4.1.09.01.001', desc: 'PIP Programa de Incentivo de Pós Vendas' },
      { conta: '3.4.1.02.02.003', desc: 'Bônus Mais' },
      { conta: '3.4.1.02.02.007', desc: 'Bônus Incentivo Vendas Varejo' },
      { conta: '3.4.1.02.02.005', desc: 'Bônus Trade In' },
    ],
  },
  {
    id: 'comissoes',
    label: 'Comissões',
    icon: '🤝',
    borderClass: 'border-t-4 border-t-violet-500',
    headerBg: 'bg-violet-50 dark:bg-violet-950/20',
    headerText: 'text-violet-700 dark:text-violet-300',
    badgeBg: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    totalColor: 'text-violet-700 dark:text-violet-300',
    rowHover: 'hover:bg-violet-50/50 dark:hover:bg-violet-950/10',
    contas: [
      { conta: '3.4.1.05.01.001', desc: 'Comissões s/ Vendas a Frotistas' },
      { conta: '3.4.1.02.02.006', desc: 'Bônus Incentivo Vendas Diretas' },
      { conta: '3.4.1.04.01.001', desc: 'Comissões s/ Consignação' },
      { conta: '3.4.1.04.03.001', desc: 'Comissões e Intermediações Diversas' },
      { conta: '3.4.2.01.01.001', desc: 'Comissões s/ Vendas de Consórcios' },
      { conta: '3.4.2.03.01.001', desc: 'Comissões s/ Financiamentos' },
      { conta: '3.4.2.04.01.001', desc: 'Comissões s/ Seguros' },
      { conta: '3.4.2.05.01.001', desc: 'Comissões s/ Serviços de Despachantes' },
      { conta: '3.4.2.06.01.001', desc: 'Comissões s/ Interm. Venda Blindagem' },
      { conta: '3.4.2.99.01.001', desc: 'Comissões s/ Venda de Vistoria' },
    ],
  },
  {
    id: 'recuperacaoImpostos',
    label: 'Recuperação de Impostos',
    icon: '🔄',
    borderClass: 'border-t-4 border-t-amber-500',
    headerBg: 'bg-amber-50 dark:bg-amber-950/20',
    headerText: 'text-amber-700 dark:text-amber-300',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    totalColor: 'text-amber-700 dark:text-amber-300',
    rowHover: 'hover:bg-amber-50/50 dark:hover:bg-amber-950/10',
    contas: [
      { conta: '3.4.3.01.02.002', desc: 'Recuperação de ICMS Próprio e ST Mensal' },
      { conta: '3.4.3.01.02.003', desc: 'Recuperação de ICMS S.T. Processos' },
      { conta: '3.4.3.01.02.025', desc: 'Crédito de PIS e COFINS s/ Despesas' },
    ],
  },
  {
    id: 'outrasReceitas',
    label: 'Outras Receitas',
    icon: '💡',
    borderClass: 'border-t-4 border-t-slate-400',
    headerBg: 'bg-slate-50 dark:bg-slate-800/20',
    headerText: 'text-slate-700 dark:text-slate-300',
    badgeBg: 'bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400',
    totalColor: 'text-slate-700 dark:text-slate-300',
    rowHover: 'hover:bg-slate-50/50 dark:hover:bg-slate-800/10',
    contas: [
      { conta: '3.4.3.02.01.001', desc: 'Valores Recuperados' },
      { conta: '3.4.3.04.01.001', desc: 'Outras Rendas' },
      { conta: '3.5.1.01.01.001', desc: 'Rendimento Aplic. Financ. Curto Prazo' },
      { conta: '3.5.2.01.01.001', desc: 'Juros Recebidos' },
      { conta: '3.5.3.01.01.001', desc: 'Descontos Obtidos' },
      { conta: '3.6.1.02.01.001', desc: 'Resultado Positivo Equiv. Patrimonial' },
      { conta: '3.6.1.02.01.002', desc: 'Ganho em Participação a Preço de Custo' },
    ],
  },
];

// ─── Helper de parse do balancete para receitas (grupo 3) ─────────────────────

function parseReceitas(rawText: string): Record<string, { valDeb: number; valCred: number }> {
  const result: Record<string, { valDeb: number; valCred: number }> = {};
  const parse = (v: string) =>
    parseFloat((v ?? '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
  for (const line of rawText.split('\n')) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const nivel = parts[0]?.trim();
    const conta = parts[1]?.trim();
    if (nivel === 'T' || !conta) continue;
    // Inclui contas 3.x e também contas de dedução 3.3.x
    if (!conta.startsWith('3.')) continue;
    result[conta] = {
      valDeb: parse(parts[4]),
      valCred: parse(parts[5]),
    };
  }
  return result;
}

function getMonths(tipo: PeriodoTipo, index: number): number[] {
  switch (tipo) {
    case 'anual': return [0];
    case 'mensal': return [index];
    case 'bimestral': { const s = (index - 1) * 2 + 1; return [s, s + 1]; }
    case 'trimestral': { const s = (index - 1) * 3 + 1; return [s, s + 1, s + 2]; }
    case 'semestral': { const s = (index - 1) * 6 + 1; return [s, s + 1, s + 2, s + 3, s + 4, s + 5]; }
  }
}

function getPeriodLabel(tipo: PeriodoTipo, year: number, index: number): string {
  if (tipo === 'anual') return `Anual ${year}`;
  const opt = PERIODO_OPTIONS[tipo].indices.find((o) => o.idx === index);
  return opt ? `${opt.label} ${year}` : `${year}`;
}

/**
 * Carrega e agrega dados de receitas para um período.
 * Retorna um mapa conta → valor (absoluto para contas brutas, subtraindo deduções via PAIRED).
 * O valor retornado por conta já é o valor líquido (bruta − dedução quando aplicável).
 */
export async function loadReceitaPeriodData(
  tipo: PeriodoTipo,
  sel: PeriodoSel
): Promise<Record<string, number> | null> {
  const months = getMonths(tipo, sel.index);
  // Agrega valDeb e valCred de cada mês (movimentação mensal, não saldo acumulado)
  const aggregated: Record<string, { valDeb: number; valCred: number }> = {};
  let hasAny = false;

  for (const month of months) {
    const raw = await loadFluxoCaixaRaw(sel.year, month);
    if (!raw?.rawText) continue;
    hasAny = true;
    const accounts = parseReceitas(raw.rawText);
    for (const [conta, vals] of Object.entries(accounts)) {
      if (!aggregated[conta]) aggregated[conta] = { valDeb: 0, valCred: 0 };
      aggregated[conta].valDeb += vals.valDeb;
      aggregated[conta].valCred += vals.valCred;
    }
  }

  if (!hasAny) return null;

  // Monta o resultado por conta de receita aplicando a fórmula de movimentação:
  // receita líquida = (bruta.valCred − bruta.valDeb) − (deducao.valDeb − deducao.valCred)
  const result: Record<string, number> = {};
  for (const grupo of GRUPOS_RECEITA_CONFIG) {
    for (const contaRef of grupo.contas) {
      const g = aggregated[contaRef.conta] ?? { valDeb: 0, valCred: 0 };
      const grossMov = g.valCred - g.valDeb;
      let valor = grossMov;
      if (contaRef.deducao) {
        const d = aggregated[contaRef.deducao] ?? { valDeb: 0, valCred: 0 };
        const dedMov = d.valDeb - d.valCred;
        valor = grossMov - dedMov;
      }
      if (valor !== 0) result[contaRef.conta] = valor;
    }
  }
  return result;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const SELECT_CLASS =
  'appearance-none bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer';

interface ComparativoReceitasProps {
  fmtBRL: (v: number, compact?: boolean) => string;
}

export function ComparativoReceitas({ fmtBRL }: ComparativoReceitasProps) {
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>('mensal');
  const [grupo1Id, setGrupo1Id] = useState<string>(GRUPOS_RECEITA_CONFIG[0].id);
  const [grupo2Id, setGrupo2Id] = useState<string>('');
  const [periodoA, setPeriodoA] = useState<PeriodoSel>({ year: 2026, index: 1 });
  const [periodoB, setPeriodoB] = useState<PeriodoSel>({ year: 2025, index: 1 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataA, setDataA] = useState<Record<string, number> | null>(null);
  const [dataB, setDataB] = useState<Record<string, number> | null>(null);
  const [hasResult, setHasResult] = useState(false);
  const [labelA, setLabelA] = useState('');
  const [labelB, setLabelB] = useState('');
  const [showGraficos, setShowGraficos] = useState(false);

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
      const [rawA, rawB] = await Promise.all([
        loadReceitaPeriodData(periodoTipo, periodoA),
        loadReceitaPeriodData(periodoTipo, periodoB),
      ]);
      setDataA(rawA);
      setDataB(rawB);
      setLabelA(getPeriodLabel(periodoTipo, periodoA.year, periodoA.index));
      setLabelB(getPeriodLabel(periodoTipo, periodoB.year, periodoB.index));
      setShowGraficos(false);
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

  function buildGrupoTable(grupoId: string) {
    const grupo = GRUPOS_RECEITA_CONFIG.find((g) => g.id === grupoId);
    if (!grupo) return null;

    const rows = grupo.contas.map((c) => ({
      conta: c.conta,
      desc: c.desc,
      valorA: dataA?.[c.conta] ?? 0,
      valorB: dataB?.[c.conta] ?? 0,
    })).filter((r) => r.valorA !== 0 || r.valorB !== 0);

    const totalA = rows.reduce((s, r) => s + r.valorA, 0);
    const totalB = rows.reduce((s, r) => s + r.valorB, 0);
    return { grupo, rows, totalA, totalB };
  }

  function fmtDiff(a: number, b: number) {
    const diff = a - b;
    const pct = b !== 0 ? (diff / Math.abs(b)) * 100 : null;
    return { diff, pct };
  }

  const gruposParaExibir = [grupo1Id, grupo2Id].filter(Boolean);

  function buildAllGrupos(): GrupoReceitaResult[] {
    return gruposParaExibir
      .map((grupoId) => {
        const result = buildGrupoTable(grupoId);
        if (!result) return null;
        return {
          grupoId,
          rows: result.rows,
        };
      })
      .filter(Boolean) as GrupoReceitaResult[];
  }

  if (showGraficos) {
    return (
      <GraficosReceitas
        initialGrupos={buildAllGrupos()}
        initialLabelA={labelA}
        initialLabelB={labelB}
        initialPeriodoTipo={periodoTipo}
        initialPeriodoA={periodoA}
        initialPeriodoB={periodoB}
        fmtBRL={fmtBRL}
        onVoltar={() => setShowGraficos(false)}
      />
    );
  }

  return (
    <Card className="shadow-sm border border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-base flex items-center gap-2">
          <span>📊</span>
          Comparativo de Receitas
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
                    ? 'bg-emerald-600 text-white border-emerald-600'
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
                {AVAILABLE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
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
                {AVAILABLE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
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

        {/* ── Grupos de Receita ── */}
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Grupo 1
            </label>
            <select
              value={grupo1Id}
              onChange={(e) => setGrupo1Id(e.target.value)}
              className={cn(SELECT_CLASS, 'w-full')}
            >
              {GRUPOS_RECEITA_CONFIG.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.icon} {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Grupo 2 <span className="font-normal normal-case text-muted-foreground">(opcional)</span>
            </label>
            <select
              value={grupo2Id}
              onChange={(e) => setGrupo2Id(e.target.value)}
              className={cn(SELECT_CLASS, 'w-full')}
            >
              <option value="">— Nenhum —</option>
              {GRUPOS_RECEITA_CONFIG.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.icon} {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Botão Comparar ── */}
        <button
          onClick={handleComparar}
          disabled={loading}
          className={cn(
            'w-full py-2.5 rounded-lg text-sm font-semibold transition-colors',
            loading
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
              Carregando...
            </span>
          ) : '🔍 Comparar'}
        </button>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* ── Tabelas de resultado ── */}
        {hasResult && (
          <div className="space-y-6">
            {/* Botão Gráficos */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowGraficos(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
              >
                📈 Ver Gráficos
              </button>
            </div>

            {gruposParaExibir.map((grupoId) => {
              const result = buildGrupoTable(grupoId);
              if (!result) return null;
              const { grupo, rows, totalA, totalB } = result;
              const { diff: totalDiff, pct: totalPct } = fmtDiff(totalA, totalB);

              return (
                <div key={grupoId} className={cn('rounded-lg border overflow-hidden', grupo.borderClass)}>
                  {/* Cabeçalho do grupo */}
                  <div className={cn('px-4 py-3 flex items-center justify-between', grupo.headerBg)}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{grupo.icon}</span>
                      <span className={cn('font-bold text-sm', grupo.headerText)}>{grupo.label}</span>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', grupo.badgeBg)}>
                      {rows.length} conta{rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Tabela */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="py-2 px-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Conta / Descrição</th>
                          <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400">{labelA}</th>
                          <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400">{labelB}</th>
                          <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Variação R$</th>
                          <th className="py-2 px-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Var %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                              Nenhuma conta com valor nos períodos selecionados.
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => {
                            const { diff, pct } = fmtDiff(row.valorA, row.valorB);
                            return (
                              <tr key={row.conta} className={cn('border-b border-border/50 transition-colors', grupo.rowHover)}>
                                <td className="py-2 px-3">
                                  <span className="text-xs font-mono text-muted-foreground mr-2">{row.conta}</span>
                                  <span className="text-sm text-foreground">{row.desc}</span>
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                                  {fmtBRL(row.valorA)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-amber-700 dark:text-amber-300 font-semibold">
                                  {fmtBRL(row.valorB)}
                                </td>
                                <td className={cn(
                                  'py-2 px-3 text-right font-mono text-sm',
                                  diff > 0 ? 'text-emerald-600 dark:text-emerald-400'
                                  : diff < 0 ? 'text-red-600 dark:text-red-400'
                                  : 'text-muted-foreground'
                                )}>
                                  {diff >= 0 ? '+' : ''}{fmtBRL(diff)}
                                </td>
                                <td className={cn(
                                  'py-2 px-3 text-right text-xs font-mono',
                                  diff > 0 ? 'text-emerald-600 dark:text-emerald-400'
                                  : diff < 0 ? 'text-red-600 dark:text-red-400'
                                  : 'text-muted-foreground'
                                )}>
                                  {pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {/* Total do grupo */}
                        <tr className={cn('font-bold', grupo.headerBg)}>
                          <td className={cn('py-2.5 px-3 text-sm font-bold', grupo.headerText)}>Total — {grupo.label}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-blue-700 dark:text-blue-300 font-bold">{fmtBRL(totalA)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-700 dark:text-amber-300 font-bold">{fmtBRL(totalB)}</td>
                          <td className={cn(
                            'py-2.5 px-3 text-right font-mono font-bold text-sm',
                            totalDiff > 0 ? 'text-emerald-600 dark:text-emerald-400'
                            : totalDiff < 0 ? 'text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                          )}>
                            {totalDiff >= 0 ? '+' : ''}{fmtBRL(totalDiff)}
                          </td>
                          <td className={cn(
                            'py-2.5 px-3 text-right text-xs font-mono font-bold',
                            totalDiff > 0 ? 'text-emerald-600 dark:text-emerald-400'
                            : totalDiff < 0 ? 'text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                          )}>
                            {totalPct !== null ? `${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      </tbody>
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
