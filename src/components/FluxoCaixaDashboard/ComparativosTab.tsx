// ─────────────────────────────────────────────────────────────────────────────
// ComparativosTab — Painel Comparativo Executivo
// Compara até 4 períodos lado a lado. Dados extraídos dos balancetes já
// importados nas outras abas do Fluxo de Caixa (fluxoCaixaStorage).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import {
  Loader2, AlertCircle, TrendingUp, TrendingDown,
  Minus, BarChart3, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { loadFluxoCaixaRaw, loadFluxoCaixaIndex } from "./fluxoCaixaStorage";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028];
const MONTH_LIST = [
  { n: 0,  short: 'Anual', long: 'Anual'     },
  { n: 1,  short: 'Jan',   long: 'Janeiro'   },
  { n: 2,  short: 'Fev',   long: 'Fevereiro' },
  { n: 3,  short: 'Mar',   long: 'Março'     },
  { n: 4,  short: 'Abr',   long: 'Abril'     },
  { n: 5,  short: 'Mai',   long: 'Maio'      },
  { n: 6,  short: 'Jun',   long: 'Junho'     },
  { n: 7,  short: 'Jul',   long: 'Julho'     },
  { n: 8,  short: 'Ago',   long: 'Agosto'    },
  { n: 9,  short: 'Set',   long: 'Setembro'  },
  { n: 10, short: 'Out',   long: 'Outubro'   },
  { n: 11, short: 'Nov',   long: 'Novembro'  },
  { n: 12, short: 'Dez',   long: 'Dezembro'  },
];
const MAX_PERIODS = 4;

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Period = { year: number; month: number };
type Direction = 'asc' | 'desc' | 'neutral';

interface DespesaCategoria {
  label: string;
  conta: string;
  valor: number;
}

interface ComparativoMetrics {
  // Balanço Patrimonial
  ativoCirculante:      number;
  ativoNaoCirculante:   number;
  ativoTotal:           number;
  passivoCirculante:    number;
  passivoNaoCirculante: number;
  patrimonioLiquido:    number;
  // DRE
  receitaLiquida:       number;
  resultadoAntesIR:     number;
  resultadoLiquido:     number;
  // Fluxo de Caixa
  fluxoOperacional:     number;
  fluxoInvestimento:    number;
  fluxoFinanciamento:   number;
  variacaoCaixa:        number;
  // Estoques
  estoqueVW:            number;
  estoqueAudi:          number;
  // Valores a Receber
  valoresReceber:       number;
  // Endividamento Bancário
  endividamentoCP:      number;
  endividamentoLP:      number;
  // Mútuo dos Sócios
  mutuoSocios:          number;
  // Parcelamento Refis
  parcelamentoRefis:    number;
  // Despesas
  totalDespesas:        number;
  categoriasDespesas:   DespesaCategoria[];
}

interface LoadedPeriod {
  period:  Period;
  metrics: ComparativoMetrics | null;
  loaded:  boolean;
  error:   string | null;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function makeKey(year: number, month: number): string {
  return `${year}_${String(month).padStart(2, '0')}`;
}

function periodShortLabel(p: Period): string {
  const m = MONTH_LIST.find(x => x.n === p.month);
  return p.month === 0 ? String(p.year) : `${m?.short ?? ''}/${p.year}`;
}

function periodLongLabel(p: Period): string {
  const m = MONTH_LIST.find(x => x.n === p.month);
  return p.month === 0 ? `Anual ${p.year}` : `${m?.long ?? ''} / ${p.year}`;
}

// ─── NUMBER PARSER (formato brasileiro: 1.234.567,89) ────────────────────────
function parseNum(v: string): number {
  return parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
function fmtBRL(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(abs / 1_000_000).toFixed(2).replace('.', ',')}M`;
  if (abs >= 1_000)     return `R$ ${(abs / 1_000).toFixed(1).replace('.', ',')}K`;
  return 'R$ ' + abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBRLFull(v: number): string {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

// ─── METRICS EXTRACTOR ───────────────────────────────────────────────────────
function extractMetrics(rawText: string): ComparativoMetrics {
  const lines = rawText.split('\n').filter(l => l.trim());
  const acc: Record<string, { saldoAnt: number; saldoAtual: number; valDeb: number; valCred: number; desc: string }> = {};

  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, desc, saldoAnt, valDeb, valCred, saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id) continue;
    acc[id] = {
      saldoAnt:   parseNum(saldoAnt),
      valDeb:     parseNum(valDeb),
      valCred:    parseNum(valCred),
      saldoAtual: parseNum(saldoAtual),
      desc:       desc?.trim() ?? '',
    };
  }

  const get    = (id: string) => acc[id] ?? { saldoAnt: 0, saldoAtual: 0, valDeb: 0, valCred: 0, desc: '' };
  const absAnt = (id: string) => Math.abs(get(id).saldoAnt);
  const absAtu = (id: string) => Math.abs(get(id).saldoAtual);

  // ── Balanço Patrimonial ───────────────────────────────────────────────────
  const ativoCirculante      = absAtu('1.1');
  const ativoNaoCirculante   = absAtu('1.5');
  const ativoTotal           = absAtu('1');
  const passivoCirculante    = absAtu('2.1');
  const passivoNaoCirculante = absAtu('2.2');
  const patrimonioLiquido    = absAtu('2.3');

  // ── DRE ──────────────────────────────────────────────────────────────────
  const recBruta      = absAtu('3.1');
  const impostosV     = absAtu('3.2');
  const devolucoes    = absAtu('3.3');
  const receitaLiquida = recBruta - impostosV - devolucoes;
  const CMV           = absAtu('4');
  const lucBruto      = receitaLiquida - CMV;
  const rendOper      = absAtu('3.4');
  const rendFinanc    = absAtu('3.5');
  const rendNaoOper   = absAtu('3.6');
  const despOper5Net  = (get('5').valDeb || 0) - (get('5').valCred || 0);
  const deprec_per    = get('5.5.2.07.20').valDeb;
  const provisaoIR    = absAtu('6');
  const resultadoAntesIR = lucBruto + rendOper + rendFinanc + rendNaoOper - despOper5Net;
  const resultadoLiquido = resultadoAntesIR - provisaoIR;

  // ── Fluxo de Caixa (Método Indireto) ─────────────────────────────────────
  const estoques     = { ant: absAnt('1.1.2'),        atu: absAtu('1.1.2')       };
  const estAudi      = { ant: absAnt('1.1.7.02'),      atu: absAtu('1.1.7.02')    };
  const creditos     = { ant: absAnt('1.1.3'),         atu: absAtu('1.1.3')       };
  const contasCorr   = { ant: absAnt('1.1.4'),         atu: absAtu('1.1.4')       };
  const valDiversos  = { ant: absAnt('1.1.5'),         atu: absAtu('1.1.5')       };
  const despAntec    = { ant: absAnt('1.1.6'),         atu: absAtu('1.1.6')       };
  const fornecVW     = { ant: absAnt('2.1.3'),         atu: absAtu('2.1.3')       };
  const fornecAudi   = { ant: absAnt('2.1.4'),         atu: absAtu('2.1.4')       };
  const fornecTotal  = { ant: fornecVW.ant + fornecAudi.ant, atu: fornecVW.atu + fornecAudi.atu };
  const obrigTrib    = { ant: absAnt('2.1.2.02'),      atu: absAtu('2.1.2.02')    };
  const obrigTrab    = { ant: absAnt('2.1.2.01'),      atu: absAtu('2.1.2.01')    };
  const contasPagar  = { ant: absAnt('2.1.2.03'),      atu: absAtu('2.1.2.03')    };
  const imobiliz     = { ant: absAnt('1.5.5'),         atu: absAtu('1.5.5')       };
  const intangivel   = { ant: absAnt('1.5.7'),         atu: absAtu('1.5.7')       };
  const investimentos = { ant: absAnt('1.5.3'),         atu: absAtu('1.5.3')       };
  const realizLPCred  = { ant: absAnt('1.5.1.01.52'), atu: absAtu('1.5.1.01.52') };
  const emprestCP    = { ant: absAnt('2.1.1'),         atu: absAtu('2.1.1')       };
  const emprestLP    = { ant: absAnt('2.2.1.07'),      atu: absAtu('2.2.1.07')    };
  const pessoasLig   = { ant: absAnt('2.2.1.01'),      atu: absAtu('2.2.1.01')    };
  const debitosLig   = { ant: absAnt('2.2.1.02'),      atu: absAtu('2.2.1.02')    };
  const arrendLP     = { ant: absAnt('2.2.1.15'),      atu: absAtu('2.2.1.15')    };
  const outrosPassLP = { ant: absAnt('2.2.3'),          atu: absAtu('2.2.3')       };
  const grupo2_2_1   = { ant: absAnt('2.2.1'),          atu: absAtu('2.2.1')       };
  const outros2_2_1Ant = grupo2_2_1.ant - emprestLP.ant - pessoasLig.ant - debitosLig.ant - arrendLP.ant;
  const outros2_2_1Atu = grupo2_2_1.atu - emprestLP.atu - pessoasLig.atu - debitosLig.atu - arrendLP.atu;
  const estTotalAnt  = estoques.ant + estAudi.ant;
  const estTotalAtu  = estoques.atu + estAudi.atu;

  const fluxoOperacional =
    resultadoLiquido + deprec_per +
    (-(estTotalAtu - estTotalAnt)) + (-(creditos.atu - creditos.ant)) +
    (-(contasCorr.atu - contasCorr.ant)) + (-(valDiversos.atu - valDiversos.ant)) +
    (-(despAntec.atu - despAntec.ant)) + (fornecTotal.atu - fornecTotal.ant) +
    (obrigTrib.atu - obrigTrib.ant) + (obrigTrab.atu - obrigTrab.ant) +
    (contasPagar.atu - contasPagar.ant);

  const fluxoInvestimento =
    -(imobiliz.atu - imobiliz.ant) - (intangivel.atu - intangivel.ant) -
    (realizLPCred.atu - realizLPCred.ant) - (investimentos.atu - investimentos.ant);

  const fluxoFinanciamento =
    (emprestCP.atu - emprestCP.ant) + (emprestLP.atu - emprestLP.ant) +
    (pessoasLig.atu - pessoasLig.ant) + (debitosLig.atu - debitosLig.ant) +
    (arrendLP.atu - arrendLP.ant) + (outrosPassLP.atu - outrosPassLP.ant) +
    (outros2_2_1Atu - outros2_2_1Ant);

  const variacaoCaixa = fluxoOperacional + fluxoInvestimento + fluxoFinanciamento;

  // ── Estoques ──────────────────────────────────────────────────────────────
  const estoqueVW   = absAtu('1.1.2');
  const estoqueAudi = absAtu('1.1.7.02');

  // ── Valores a Receber ─────────────────────────────────────────────────────
  const valoresReceber = absAtu('1.1.3');

  // ── Endividamento Bancário ────────────────────────────────────────────────
  const endividamentoCP = absAtu('2.1.1');
  const endividamentoLP = emprestLP.atu;

  // ── Mútuo dos Sócios ──────────────────────────────────────────────────────
  const mutuoSocios = absAtu('2.2.1.01');

  // ── Parcelamento Refis ────────────────────────────────────────────────────
  const parcelamentoRefis = absAtu('2.1.2.02.07.020') + absAtu('2.2.1.08.01.020');

  // ── Despesas — categorias expandíveis ────────────────────────────────────
  // Subcategorias do grupo 5 (Despesas Operacionais)
  const DESPESA_CATS: { label: string; conta: string }[] = [
    { label: 'Despesas com Pessoal',             conta: '5.5.1' },
    { label: 'Despesas com Veículos e Frota',     conta: '5.5.2' },
    { label: 'Despesas com Imóveis',              conta: '5.5.3' },
    { label: 'Despesas com Terceiros / Serviços', conta: '5.5.4' },
    { label: 'Despesas Financeiras',              conta: '5.5.7' },
    { label: 'Despesas com Marketing',            conta: '5.5.8' },
    { label: 'Outras Despesas Operacionais',      conta: '5.5.9' },
  ];

  const categoriasDespesas: DespesaCategoria[] = DESPESA_CATS.map(c => ({
    label: c.label,
    conta: c.conta,
    valor: Math.abs(get(c.conta).valDeb - get(c.conta).valCred),
  })).filter(c => c.valor > 0);

  // Se nenhuma subcategoria encontrada, usa grupo 5 inteiro
  if (categoriasDespesas.length === 0) {
    const v5 = Math.abs(get('5').valDeb - get('5').valCred);
    if (v5 > 0) categoriasDespesas.push({ label: 'Total Despesas Operacionais', conta: '5', valor: v5 });
  }

  const totalDespesas = despOper5Net;

  return {
    ativoCirculante, ativoNaoCirculante, ativoTotal,
    passivoCirculante, passivoNaoCirculante, patrimonioLiquido,
    receitaLiquida, resultadoAntesIR, resultadoLiquido,
    fluxoOperacional, fluxoInvestimento, fluxoFinanciamento, variacaoCaixa,
    estoqueVW, estoqueAudi, valoresReceber,
    endividamentoCP, endividamentoLP,
    mutuoSocios, parcelamentoRefis,
    totalDespesas, categoriasDespesas,
  };
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  icon: string;
  periods: LoadedPeriod[];
  getValue: (m: ComparativoMetrics) => number;
  direction?: Direction;
  refIdx: number; // índice do período base (mais antigo)
}

function KpiCard({ title, icon, periods, getValue, direction = 'neutral', refIdx }: KpiCardProps) {
  const colors = ['emerald', 'blue', 'violet', 'amber'] as const;
  const colorText: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue:    'text-blue-600 dark:text-blue-400',
    violet:  'text-violet-600 dark:text-violet-400',
    amber:   'text-amber-600 dark:text-amber-400',
  };
  const colorBorder: Record<string, string> = {
    emerald: 'border-l-emerald-500',
    blue:    'border-l-blue-500',
    violet:  'border-l-violet-500',
    amber:   'border-l-amber-500',
  };
  const colorBg: Record<string, string> = {
    emerald: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    blue:    'bg-blue-50/60 dark:bg-blue-950/20',
    violet:  'bg-violet-50/60 dark:bg-violet-950/20',
    amber:   'bg-amber-50/60 dark:bg-amber-950/20',
  };

  const refVal = periods[refIdx]?.metrics ? getValue(periods[refIdx].metrics!) : null;
  const lastPeriod = periods[periods.length - 1];
  const lastVal = lastPeriod?.metrics ? getValue(lastPeriod.metrics!) : null;

  let deltaEl: React.ReactNode = null;
  if (refVal !== null && lastVal !== null && refVal !== 0 && periods.length > 1) {
    const pct = ((lastVal - refVal) / Math.abs(refVal)) * 100;
    const favorable =
      direction === 'neutral' ? null :
      direction === 'asc'     ? pct > 0 : pct < 0;
    const stable = Math.abs(pct) < 0.1;
    deltaEl = (
      <div className={cn(
        'inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full',
        stable          ? 'bg-slate-100 text-slate-500 dark:bg-slate-700' :
        favorable === null ? 'bg-slate-100 text-slate-500 dark:bg-slate-700' :
        favorable       ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      )}>
        {stable ? <Minus className="w-3 h-3" /> : pct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {fmtPct(pct)}
      </div>
    );
  }

  return (
    <Card className="border-l-4 border-l-slate-200 dark:border-l-slate-700">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xl">{icon}</span>
          {deltaEl}
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</p>
        <div className="space-y-1.5">
          {periods.map((p, idx) => {
            const c = colors[idx % colors.length];
            const val = p.metrics ? getValue(p.metrics) : null;
            return (
              <div key={idx} className={cn('flex items-center justify-between rounded-lg px-2 py-1', colorBg[c])}>
                <span className={cn('text-[11px] font-semibold', colorText[c])}>P{idx + 1} {periodShortLabel(p.period)}</span>
                <span className={cn('text-xs font-mono font-bold', colorText[c])} title={val !== null ? fmtBRLFull(val) : undefined}>
                  {val !== null ? (
                    val < 0
                      ? <span className="text-red-600 dark:text-red-400">({fmtBRL(Math.abs(val))})</span>
                      : fmtBRL(val)
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {periods.length > 1 && refVal !== null && (
          <p className="text-[10px] text-muted-foreground/60 mt-2 text-right">
            Δ% vs {periodShortLabel(periods[refIdx].period)} (ref.)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── COMPARISON ROW ───────────────────────────────────────────────────────────
interface CompRowProps {
  label:      string;
  desc?:      string;
  periods:    LoadedPeriod[];
  getValue:   (m: ComparativoMetrics) => number;
  direction?: Direction;
  isHeader?:  boolean;
  indent?:    boolean;
  refIdx:     number;
}

function CompRow({ label, desc, periods, getValue, direction = 'neutral', isHeader = false, indent = false, refIdx }: CompRowProps) {
  const values = periods.map(p => (p.metrics ? getValue(p.metrics) : null));
  const ref    = values[refIdx];
  const nonNull = values.filter((v): v is number => v !== null);
  const bestVal  = direction === 'asc'  ? Math.max(...nonNull) :
                   direction === 'desc' ? Math.min(...nonNull) : null;
  const worstVal = direction === 'asc'  ? Math.min(...nonNull) :
                   direction === 'desc' ? Math.max(...nonNull) : null;

  return (
    <tr className={cn(
      'border-b border-border/30 transition-colors',
      isHeader ? 'bg-slate-50 dark:bg-slate-800/50' : 'hover:bg-muted/20',
    )}>
      <td className={cn(
        'py-3 px-4 text-sm',
        isHeader ? 'font-bold text-foreground' : 'text-muted-foreground',
        indent && 'pl-8',
      )}>
        <div>{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground/60 mt-0.5">{desc}</div>}
      </td>

      {values.map((val, idx) => {
        const period = periods[idx];
        if (!period) return <td key={idx} />;
        if (period.error) return (
          <td key={idx} className="py-3 px-4 text-center">
            <span className="text-xs text-red-500">Erro</span>
          </td>
        );
        if (!period.loaded || val === null) return (
          <td key={idx} className="py-3 px-4 text-center">
            <span className="text-xs text-muted-foreground/40">—</span>
          </td>
        );

        const isBest  = bestVal  !== null && val === bestVal  && nonNull.length > 1;
        const isWorst = worstVal !== null && val === worstVal && nonNull.length > 1;

        let deltaEl: React.ReactNode = null;
        if (idx !== refIdx && ref !== null && ref !== 0) {
          const pct = ((val - ref) / Math.abs(ref)) * 100;
          const favorable =
            direction === 'neutral' ? null :
            direction === 'asc'     ? pct > 0 : pct < 0;
          const stable = Math.abs(pct) < 0.1;
          deltaEl = (
            <div className={cn(
              'text-[10px] font-semibold flex items-center justify-end gap-0.5 mt-0.5',
              stable          ? 'text-muted-foreground/60' :
              favorable === null ? 'text-muted-foreground/60' :
              favorable       ? 'text-emerald-600 dark:text-emerald-400' :
                                'text-red-600 dark:text-red-400',
            )}>
              {stable ? <Minus className="w-2.5 h-2.5" /> : pct > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {fmtPct(pct)}
            </div>
          );
        }

        return (
          <td key={idx} className={cn(
            'py-3 px-4 text-right',
            isBest  && direction !== 'neutral' && 'bg-emerald-50/60 dark:bg-emerald-950/20',
            isWorst && direction !== 'neutral' && 'bg-red-50/60 dark:bg-red-950/20',
          )}>
            <div className={cn(
              'text-sm font-mono font-semibold',
              isHeader ? 'text-foreground' : 'text-foreground/90',
            )} title={fmtBRLFull(val)}>
              {val < 0
                ? <span className="text-red-600 dark:text-red-400">({fmtBRL(Math.abs(val))})</span>
                : fmtBRL(val)}
            </div>
            {deltaEl}
            {isBest && direction !== 'neutral' && (
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">★ melhor</div>
            )}
          </td>
        );
      })}
      {Array.from({ length: MAX_PERIODS - periods.length }).map((_, i) => (
        <td key={`pad-${i}`} />
      ))}
    </tr>
  );
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, colSpan }: {
  icon: string; title: string; subtitle: string; colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="pt-5 pb-1 px-4">
        <div className="flex items-center gap-2.5 border-b-2 border-border pb-2 mt-3">
          <span className="text-base">{icon}</span>
          <div>
            <p className="text-xs font-bold text-foreground uppercase tracking-widest">{title}</p>
            <p className="text-[10px] text-muted-foreground/70">{subtitle}</p>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── DESPESAS EXPANDÍVEL ─────────────────────────────────────────────────────
function DespesasSection({ periods, refIdx }: { periods: LoadedPeriod[]; refIdx: number }) {
  const [expanded, setExpanded] = useState(false);
  const colSpan = 1 + MAX_PERIODS;

  // Obter todas as categorias únicas presentes em qualquer período
  const allCats = (() => {
    const map = new Map<string, { label: string; conta: string }>();
    for (const p of periods) {
      for (const c of p.metrics?.categoriasDespesas ?? []) {
        map.set(c.conta, { label: c.label, conta: c.conta });
      }
    }
    return Array.from(map.values());
  })();

  return (
    <>
      <SectionHeader icon="📋" title="Despesas Operacionais" subtitle="Movimentação líquida do período — grupo 5 (valDeb − valCred)" colSpan={colSpan} />
      <CompRow
        label="Total Despesas Operacionais"
        desc="Clique no ícone abaixo para ver composição por categoria"
        periods={periods}
        getValue={m => m.totalDespesas}
        direction="desc"
        isHeader
        refIdx={refIdx}
      />
      {/* Botão expandir */}
      <tr>
        <td colSpan={colSpan} className="px-4 pb-1 pt-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Ocultar composição' : 'Ver composição por categoria'}
          </button>
        </td>
      </tr>
      {expanded && allCats.map(cat => (
        <CompRow
          key={cat.conta}
          label={cat.label}
          desc={cat.conta}
          periods={periods}
          getValue={m => m.categoriasDespesas.find(c => c.conta === cat.conta)?.valor ?? 0}
          direction="desc"
          indent
          refIdx={refIdx}
        />
      ))}
    </>
  );
}

// ─── PERIOD SELECTOR ─────────────────────────────────────────────────────────
function PeriodSelector({
  index, period, availableKeys, onChange,
}: {
  index:         number;
  period:        Period;
  availableKeys: Record<string, boolean>;
  onChange:      (p: Period) => void;
}) {
  const key = makeKey(period.year, period.month);
  const hasData = !!availableKeys[key];
  const colors  = ['emerald', 'blue', 'violet', 'amber'] as const;
  const c = colors[index % colors.length];

  const border: Record<string, string> = {
    emerald: 'border-emerald-400', blue: 'border-blue-400',
    violet:  'border-violet-400',  amber: 'border-amber-400',
  };
  const bg: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30', blue: 'bg-blue-50 dark:bg-blue-950/30',
    violet:  'bg-violet-50 dark:bg-violet-950/30',   amber: 'bg-amber-50 dark:bg-amber-950/30',
  };
  const text: Record<string, string> = {
    emerald: 'text-emerald-700 dark:text-emerald-300', blue: 'text-blue-700 dark:text-blue-300',
    violet:  'text-violet-700 dark:text-violet-300',   amber: 'text-amber-700 dark:text-amber-300',
  };

  return (
    <div className={cn('rounded-xl border-2 p-3 space-y-2', border[c], bg[c])}>
      <div className={cn('text-[11px] font-bold uppercase tracking-wider', text[c])}>
        P{index + 1}{index === 0 ? ' — Base (ref.)' : ''}
      </div>
      <div className="flex gap-2">
        <select value={period.year} onChange={e => onChange({ ...period, year: +e.target.value })}
          className="flex-1 rounded-lg border border-border bg-background text-foreground text-sm px-2 py-1.5 focus:outline-none focus:ring-1">
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={period.month} onChange={e => onChange({ ...period, month: +e.target.value })}
          className="flex-1 rounded-lg border border-border bg-background text-foreground text-sm px-2 py-1.5 focus:outline-none focus:ring-1">
          {MONTH_LIST.map(m => <option key={m.n} value={m.n}>{m.short}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        {hasData
          ? <><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /><span className={cn('font-medium', text[c])}>Balancete disponível</span></>
          : <><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /><span className="text-amber-600 dark:text-amber-400">Sem dados para este período</span></>
        }
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function ComparativosTab({ selectedYear, selectedMonth }: { selectedYear?: number; selectedMonth?: number }) {
  const defaultYear = selectedYear ?? new Date().getFullYear();
  const defaultMonth = selectedMonth !== undefined ? selectedMonth : 0;
  const [availableKeys, setAvailableKeys] = useState<Record<string, boolean>>({});
  const [indexLoading,  setIndexLoading]  = useState(true);
  const [indexError,    setIndexError]    = useState<string | null>(null);

  const [selectedPeriods, setSelectedPeriods] = useState<Period[]>([
    { year: defaultYear, month: defaultMonth },
    { year: defaultYear, month: defaultMonth },
    { year: defaultYear, month: defaultMonth },
    { year: defaultYear, month: defaultMonth },
  ]);
  const [activePeriodCount, setActivePeriodCount] = useState(4);
  const [loadedPeriods,    setLoadedPeriods]    = useState<LoadedPeriod[]>([]);
  const [compLoading,      setCompLoading]      = useState(false);
  const [compError,        setCompError]        = useState<string | null>(null);
  const [hasResults,       setHasResults]       = useState(false);

  // Índice do período base = o mais antigo entre os selecionados
  const refIdx = (() => {
    if (loadedPeriods.length === 0) return 0;
    let oldest = 0;
    for (let i = 1; i < loadedPeriods.length; i++) {
      const a = loadedPeriods[oldest].period;
      const b = loadedPeriods[i].period;
      if (b.year < a.year || (b.year === a.year && b.month < a.month)) oldest = i;
    }
    return oldest;
  })();

  // ── Load index on mount ───────────────────────────────────────────────────
  useEffect(() => {
    setIndexLoading(true);
    loadFluxoCaixaIndex()
      .then(idx => { setAvailableKeys(idx); setIndexError(null); })
      .catch(e  => setIndexError(String(e)))
      .finally(() => setIndexLoading(false));
  }, []);

  // ── Presets ───────────────────────────────────────────────────────────────
  const applyPreset = (preset: 'annual' | 'monthly') => {
    const curYear  = new Date().getFullYear();
    const curMonth = new Date().getMonth() + 1;
    if (preset === 'annual') {
      setActivePeriodCount(4);
      setSelectedPeriods([
        { year: curYear - 3, month: 0 },
        { year: curYear - 2, month: 0 },
        { year: curYear - 1, month: 0 },
        { year: curYear,     month: 0 },
      ]);
    } else {
      const periods: Period[] = [];
      let y = curYear, m = curMonth;
      for (let i = 0; i < 4; i++) {
        periods.unshift({ year: y, month: m });
        m--; if (m < 1) { m = 12; y--; }
      }
      setActivePeriodCount(4);
      setSelectedPeriods(periods);
    }
  };

  // ── Run comparison ────────────────────────────────────────────────────────
  const runComparison = useCallback(async () => {
    setCompLoading(true);
    setCompError(null);
    const active = selectedPeriods.slice(0, activePeriodCount);
    const results: LoadedPeriod[] = [];

    for (const period of active) {
      const key = makeKey(period.year, period.month);
      if (!availableKeys[key]) {
        results.push({ period, metrics: null, loaded: false, error: null });
        continue;
      }
      try {
        const entry = await loadFluxoCaixaRaw(period.year, period.month);
        if (!entry?.rawText) {
          results.push({ period, metrics: null, loaded: false, error: 'Sem dados' });
          continue;
        }
        results.push({ period, metrics: extractMetrics(entry.rawText), loaded: true, error: null });
      } catch (e: any) {
        results.push({ period, metrics: null, loaded: false, error: String(e) });
      }
    }

    setLoadedPeriods(results);
    setHasResults(true);
    setCompLoading(false);
  }, [selectedPeriods, activePeriodCount, availableKeys]);

  const totalAvailable = Object.keys(availableKeys).length;
  const colSpan = 1 + MAX_PERIODS;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <BarChart3 className="w-7 h-7 text-green-600 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Painel Comparativo Executivo</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Compare até 4 períodos com indicadores financeiros extraídos dos balancetes importados nas abas do Fluxo de Caixa.
            {totalAvailable > 0 && (
              <span className="text-green-600 dark:text-green-400 font-semibold ml-1">
                {totalAvailable} período{totalAvailable !== 1 ? 's' : ''} disponíve{totalAvailable !== 1 ? 'is' : 'l'}.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Avisos de carregamento */}
      {indexLoading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
          <Loader2 className="w-4 h-4 animate-spin text-green-500" />
          Verificando períodos disponíveis...
        </div>
      )}
      {indexError && (
        <div className="flex items-center gap-2 text-red-600 text-sm p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4" /> Erro ao verificar períodos: {indexError}
        </div>
      )}

      {/* ── Setup Card ─────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 space-y-5">
          {/* Presets + nº de períodos */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Atalhos:</span>
            <button onClick={() => applyPreset('annual')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-border">
              📅 Últimos 4 Anos
            </button>
            <button onClick={() => applyPreset('monthly')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-border">
              📆 Últimos 4 Meses
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Períodos:</span>
              {[2, 3, 4].map(n => (
                <button key={n} onClick={() => setActivePeriodCount(n)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-sm font-bold border transition-colors',
                    activePeriodCount === n
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-background border-border hover:bg-muted',
                  )}>{n}</button>
              ))}
            </div>
          </div>

          {/* Seletores de período */}
          <div className={cn('grid gap-3',
            activePeriodCount === 2 ? 'grid-cols-1 sm:grid-cols-2' :
            activePeriodCount === 3 ? 'grid-cols-1 sm:grid-cols-3' :
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
          )}>
            {Array.from({ length: activePeriodCount }).map((_, idx) => (
              <PeriodSelector key={idx} index={idx}
                period={selectedPeriods[idx] ?? { year: 2025, month: 12 }}
                availableKeys={availableKeys}
                onChange={p => {
                  const next = [...selectedPeriods];
                  next[idx] = p;
                  setSelectedPeriods(next);
                }}
              />
            ))}
          </div>

          {/* Botão gerar */}
          <div className="flex items-center gap-4">
            <button onClick={runComparison} disabled={compLoading || indexLoading}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all',
                'bg-green-600 hover:bg-green-700 text-white shadow-sm',
                (compLoading || indexLoading) && 'opacity-70 cursor-wait',
              )}>
              {compLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</>
                : <><RefreshCw className="w-4 h-4" /> Gerar Comparativo</>}
            </button>
            {compError && (
              <span className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />{compError}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      {hasResults && loadedPeriods.length > 0 && (
        <>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Indicadores-Chave
            </h3>
            <div className={cn('grid gap-3',
              loadedPeriods.length === 2 ? 'grid-cols-2 md:grid-cols-4' :
              'grid-cols-2 md:grid-cols-4',
            )}>
              <KpiCard title="Patrimônio Líquido"        icon="🏛️" periods={loadedPeriods} getValue={m => m.patrimonioLiquido}    direction="asc"     refIdx={refIdx} />
              <KpiCard title="Resultado Líquido"          icon="📈" periods={loadedPeriods} getValue={m => m.resultadoLiquido}     direction="asc"     refIdx={refIdx} />
              <KpiCard title="Caixa Operacional"          icon="💰" periods={loadedPeriods} getValue={m => m.fluxoOperacional}     direction="asc"     refIdx={refIdx} />
              <KpiCard title="Total Endividamento Banc."  icon="🏦" periods={loadedPeriods} getValue={m => m.endividamentoCP + m.endividamentoLP} direction="desc" refIdx={refIdx} />
              <KpiCard title="Ativo Total"                icon="📊" periods={loadedPeriods} getValue={m => m.ativoTotal}           direction="asc"     refIdx={refIdx} />
              <KpiCard title="Receita Líquida"            icon="💵" periods={loadedPeriods} getValue={m => m.receitaLiquida}       direction="asc"     refIdx={refIdx} />
              <KpiCard title="Variação de Caixa"          icon="📉" periods={loadedPeriods} getValue={m => m.variacaoCaixa}       direction="asc"     refIdx={refIdx} />
              <KpiCard title="Total Despesas Operac."     icon="📋" periods={loadedPeriods} getValue={m => m.totalDespesas}        direction="desc"    refIdx={refIdx} />
            </div>
          </div>

          {/* Legenda Δ% */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground/70 bg-muted/20 rounded-lg px-4 py-2.5 border border-border/40">
            <span className="font-semibold text-muted-foreground">Legenda:</span>
            <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-600" /><span>Variação favorável</span></div>
            <div className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-600" /><span>Variação desfavorável</span></div>
            <div className="flex items-center gap-1"><Minus className="w-3 h-3" /><span>Estável (&lt;0,1%)</span></div>
            <span>★ = Melhor período</span>
            <span className="ml-auto">Δ% base: <strong>{loadedPeriods[refIdx] ? periodShortLabel(loadedPeriods[refIdx].period) : '—'}</strong> (mais antigo)</span>
          </div>

          {/* ── Tabela Comparativa Detalhada ─────────────────────────────── */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Análise Detalhada por Seção
            </h3>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="py-3.5 px-4 text-left text-xs uppercase tracking-wider font-semibold w-60">
                          Indicador
                        </th>
                        {loadedPeriods.map((p, idx) => (
                          <th key={idx} className="py-3.5 px-4 text-right text-xs uppercase tracking-wider font-semibold min-w-[150px]">
                            <div className="text-white">{periodShortLabel(p.period)}</div>
                            {idx === refIdx && <div className="text-slate-400 text-[10px] font-normal mt-0.5">referência (base Δ%)</div>}
                            {p.metrics === null && !p.error && <div className="text-amber-400 text-[10px] font-normal mt-0.5">sem dados</div>}
                            {p.error && <div className="text-red-400 text-[10px] font-normal mt-0.5">erro</div>}
                          </th>
                        ))}
                        {Array.from({ length: MAX_PERIODS - loadedPeriods.length }).map((_, i) => (
                          <th key={`ph-${i}`} className="py-3.5 px-4 min-w-[150px]" />
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* BALANÇO */}
                      <SectionHeader icon="📊" title="Balanço Patrimonial" subtitle="Posição financeira ao final do período (saldo atual)" colSpan={colSpan} />
                      <CompRow label="Ativo Circulante"         desc="1.1 — Disponível, estoques, créditos"             periods={loadedPeriods} getValue={m => m.ativoCirculante}      direction="asc"     refIdx={refIdx} />
                      <CompRow label="Ativo Não Circulante"     desc="1.5 — Imobilizado, intangível, investimentos"     periods={loadedPeriods} getValue={m => m.ativoNaoCirculante}  direction="neutral" refIdx={refIdx} />
                      <CompRow label="Ativo Total"              desc="1 — Total do ativo"                                periods={loadedPeriods} getValue={m => m.ativoTotal}           direction="asc"     isHeader refIdx={refIdx} />
                      <CompRow label="Passivo Circulante"       desc="2.1 — Empréstimos CP, fornecedores, obrigações"   periods={loadedPeriods} getValue={m => m.passivoCirculante}    direction="desc"    refIdx={refIdx} />
                      <CompRow label="Passivo Não Circulante"   desc="2.2 — Empréstimos LP, mútuos, outros LP"          periods={loadedPeriods} getValue={m => m.passivoNaoCirculante} direction="desc"    refIdx={refIdx} />
                      <CompRow label="Patrimônio Líquido"       desc="2.3 — Capital + resultados acumulados"            periods={loadedPeriods} getValue={m => m.patrimonioLiquido}     direction="asc"     isHeader refIdx={refIdx} />

                      {/* DRE */}
                      <SectionHeader icon="📈" title="Demonstração do Resultado (DRE)" subtitle="Movimentação do período — receitas e despesas incorridas" colSpan={colSpan} />
                      <CompRow label="Receita Líquida"                   desc="Receita bruta − impostos − devoluções"          periods={loadedPeriods} getValue={m => m.receitaLiquida}      direction="asc" refIdx={refIdx} />
                      <CompRow label="Resultado Antes do IR/CSLL"        desc="Lucro operacional antes da tributação"           periods={loadedPeriods} getValue={m => m.resultadoAntesIR}   direction="asc" isHeader refIdx={refIdx} />
                      <CompRow label="Resultado Líquido do Exercício"    desc="Lucro/Prejuízo após IR e CSLL"                   periods={loadedPeriods} getValue={m => m.resultadoLiquido}   direction="asc" isHeader refIdx={refIdx} />

                      {/* FLUXO DE CAIXA */}
                      <SectionHeader icon="💰" title="Fluxo de Caixa Direto" subtitle="Geração e consumo de caixa no período" colSpan={colSpan} />
                      <CompRow label="Caixa Líquido — At. Operacionais"   desc="Resultado ajustado por variações de capital de giro" periods={loadedPeriods} getValue={m => m.fluxoOperacional}   direction="asc"     refIdx={refIdx} />
                      <CompRow label="Caixa Líquido — At. Investimento"   desc="Imobilizado, intangável, investimentos"               periods={loadedPeriods} getValue={m => m.fluxoInvestimento} direction="neutral" refIdx={refIdx} />
                      <CompRow label="Caixa Líquido — At. Financiamento"  desc="Empréstimos, mútuos, arrendamentos"                   periods={loadedPeriods} getValue={m => m.fluxoFinanciamento} direction="neutral" refIdx={refIdx} />
                      <CompRow label="Variação Total de Caixa no Período" desc="Operacional + Investimento + Financiamento"           periods={loadedPeriods} getValue={m => m.variacaoCaixa}      direction="asc"     isHeader refIdx={refIdx} />

                      {/* ESTOQUES */}
                      <SectionHeader icon="📦" title="Posição de Estoques" subtitle="Saldo atual do inventário por marca" colSpan={colSpan} />
                      <CompRow label="Estoque Sorana VW"   desc="Veículos novos, usados e peças (1.1.2)"   periods={loadedPeriods} getValue={m => m.estoqueVW}   direction="neutral" refIdx={refIdx} />
                      <CompRow label="Estoque Sorana Audi" desc="Veículos novos, usados e peças (1.1.7.02)" periods={loadedPeriods} getValue={m => m.estoqueAudi} direction="neutral" refIdx={refIdx} />
                      <CompRow label="Total Estoques"                                                        periods={loadedPeriods} getValue={m => m.estoqueVW + m.estoqueAudi} direction="neutral" isHeader refIdx={refIdx} />

                      {/* VALORES A RECEBER */}
                      <SectionHeader icon="💳" title="Valores a Receber" subtitle="Saldo atual dos créditos de vendas (1.1.3)" colSpan={colSpan} />
                      <CompRow label="Total Valores a Receber" desc="Clientes e demais créditos de vendas" periods={loadedPeriods} getValue={m => m.valoresReceber} direction="desc" isHeader refIdx={refIdx} />

                      {/* ENDIVIDAMENTO */}
                      <SectionHeader icon="🏦" title="Endividamento Bancário" subtitle="Saldo atual dos empréstimos bancários CP e LP" colSpan={colSpan} />
                      <CompRow label="Empréstimos — Curto Prazo" desc="Floor plan e empréstimos CP (2.1.1)"   periods={loadedPeriods} getValue={m => m.endividamentoCP} direction="desc" refIdx={refIdx} />
                      <CompRow label="Empréstimos — Longo Prazo" desc="Financiamentos bancários LP (2.2.1.07)" periods={loadedPeriods} getValue={m => m.endividamentoLP} direction="desc" refIdx={refIdx} />
                      <CompRow label="Total Endividamento Bancário"                                             periods={loadedPeriods} getValue={m => m.endividamentoCP + m.endividamentoLP} direction="desc" isHeader refIdx={refIdx} />

                      {/* MÚTUO DOS SÓCIOS */}
                      <SectionHeader icon="🤝" title="Mútuo dos Sócios" subtitle="Saldo atual — conta 2.2.1.01" colSpan={colSpan} />
                      <CompRow label="Total Mútuo dos Sócios" desc="Aportes e empréstimos entre sócios e empresa" periods={loadedPeriods} getValue={m => m.mutuoSocios} direction="desc" isHeader refIdx={refIdx} />

                      {/* PARCELAMENTO REFIS */}
                      <SectionHeader icon="🧾" title="Parcelamento Refis" subtitle="Saldo atual — CP (2.1.2.02.07.020) + LP (2.2.1.08.01.020)" colSpan={colSpan} />
                      <CompRow label="Total Parcelamento Refis" desc="Obrigações tributárias parceladas (CP + LP)" periods={loadedPeriods} getValue={m => m.parcelamentoRefis} direction="desc" isHeader refIdx={refIdx} />

                      {/* DESPESAS */}
                      <DespesasSection periods={loadedPeriods} refIdx={refIdx} />
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!hasResults && !compLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-4">
          <BarChart3 className="w-14 h-14 text-muted-foreground/20" />
          <div>
            <p className="text-base font-semibold mb-1">Nenhum comparativo gerado ainda</p>
            <p className="text-sm text-muted-foreground/70">Selecione os períodos acima e clique em <strong>Gerar Comparativo</strong>.</p>
            {totalAvailable === 0 && !indexLoading && (
              <p className="text-sm mt-3 text-amber-600 dark:text-amber-400 max-w-sm mx-auto">
                Nenhum balancete importado. Importe os arquivos nas abas do Fluxo de Caixa (Ativo, Passivo, etc.) para que os períodos fiquem disponíveis aqui.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
