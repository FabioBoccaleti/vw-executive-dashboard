// ─────────────────────────────────────────────────────────────────────────────
// ComparativosTab — Painel Comparativo Executivo
// Compara até 4 períodos lado a lado com indicadores-chave de todas as abas.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2, Upload, Trash2, Loader2, AlertCircle,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Minus, BarChart3, Settings2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  saveComparativo,
  loadComparativo,
  loadComparativosIndex,
  deleteComparativo,
} from "./comparativosStorage";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028];

const MONTH_LIST = [
  { n: 0,  short: 'Anual', long: 'Anual'    },
  { n: 1,  short: 'Jan',   long: 'Janeiro'  },
  { n: 2,  short: 'Fev',   long: 'Fevereiro'},
  { n: 3,  short: 'Mar',   long: 'Março'    },
  { n: 4,  short: 'Abr',   long: 'Abril'    },
  { n: 5,  short: 'Mai',   long: 'Maio'     },
  { n: 6,  short: 'Jun',   long: 'Junho'    },
  { n: 7,  short: 'Jul',   long: 'Julho'    },
  { n: 8,  short: 'Ago',   long: 'Agosto'   },
  { n: 9,  short: 'Set',   long: 'Setembro' },
  { n: 10, short: 'Out',   long: 'Outubro'  },
  { n: 11, short: 'Nov',   long: 'Novembro' },
  { n: 12, short: 'Dez',   long: 'Dezembro' },
];
const MONTHS_GRID = MONTH_LIST.slice(1); // Jan–Dez para a grade de gerenciamento

const MAX_PERIODS = 4;

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Period = { year: number; month: number };

interface ComparativoMetrics {
  // Balanço Patrimonial
  ativoCirculante: number;
  ativoNaoCirculante: number;
  ativoTotal: number;
  passivoCirculante: number;
  passivoNaoCirculante: number;
  patrimonioLiquido: number;
  // DRE
  receitaLiquida: number;
  resultadoAntesIR: number;
  resultadoLiquido: number;
  // Fluxo de Caixa
  fluxoOperacional: number;
  fluxoInvestimento: number;
  fluxoFinanciamento: number;
  variacaoCaixa: number;
  // Estoques
  estoqueVW: number;
  estoqueAudi: number;
  // Valores a Receber
  valoresReceber: number;
  // Endividamento
  endividamentoCP: number;
  endividamentoLP: number;
  // Mútuo dos Sócios
  mutuoSocios: number;
  // Parcelamento Refis
  parcelamentoRefis: number;
  // Despesas Operacionais
  totalDespesas: number;
}

interface LoadedPeriod {
  period: Period;
  metrics: ComparativoMetrics | null;
  loaded: boolean;
  error: string | null;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function makeKey(year: number, month: number): string {
  return `${year}_${String(month).padStart(2, '0')}`;
}

function periodShortLabel(p: Period): string {
  const m = MONTH_LIST.find(x => x.n === p.month);
  if (p.month === 0) return String(p.year);
  return `${m?.short ?? ''}/${p.year}`;
}

function periodLongLabel(p: Period): string {
  const m = MONTH_LIST.find(x => x.n === p.month);
  if (p.month === 0) return `Anual ${p.year}`;
  return `${m?.long ?? ''} / ${p.year}`;
}

function readFileAsLatin1(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'latin1');
  });
}

// ─── NUMBER PARSER (handles Brazilian format: 1.234.567,89) ─────────────────
function parseNum(v: string): number {
  return parseFloat((v || '0').trim().replace(/\./g, '').replace(',', '.')) || 0;
}

// ─── BALANCETE METRICS EXTRACTOR ─────────────────────────────────────────────
// Segue a mesma lógica de parseBalancete em index.tsx para garantir consistência
function extractMetricsFromRaw(rawText: string): ComparativoMetrics {
  // Parse lines
  const lines = rawText.split('\n').filter(l => l.trim());
  const accounts: Record<string, { saldoAnt: number; saldoAtual: number; valDeb: number; valCred: number }> = {};
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 7) continue;
    const [nivel, conta, , saldoAnt, valDeb, valCred, saldoAtual] = parts;
    if (nivel?.trim() === 'T') continue;
    const id = conta?.trim();
    if (!id) continue;
    accounts[id] = {
      saldoAnt:  parseNum(saldoAnt),
      valDeb:    parseNum(valDeb),
      valCred:   parseNum(valCred),
      saldoAtual: parseNum(saldoAtual),
    };
  }

  const get    = (id: string) => accounts[id] ?? { saldoAnt: 0, saldoAtual: 0, valDeb: 0, valCred: 0 };
  const absAnt = (id: string) => Math.abs(get(id).saldoAnt);
  const absAtu = (id: string) => Math.abs(get(id).saldoAtual);

  // ── Balanço Patrimonial ──────────────────────────────────────────────────
  const ativoCirculante     = absAtu('1.1');
  const ativoNaoCirculante  = absAtu('1.5');
  const ativoTotal          = absAtu('1');
  const passivoCirculante   = absAtu('2.1');
  const passivoNaoCirculante = absAtu('2.2');
  const patrimonioLiquido   = absAtu('2.3');

  // ── DRE (seguindo lógica de parseBalancete) ───────────────────────────────
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

  // ── DFC — Método Indireto ─────────────────────────────────────────────────
  const estoques    = { ant: absAnt('1.1.2'),     atu: absAtu('1.1.2')     };
  const estAudi     = { ant: absAnt('1.1.7.02'),  atu: absAtu('1.1.7.02')  };
  const disponib    = { ant: absAnt('1.1.1'),     atu: absAtu('1.1.1')     };
  const creditos    = { ant: absAnt('1.1.3'),     atu: absAtu('1.1.3')     };
  const contasCorr  = { ant: absAnt('1.1.4'),     atu: absAtu('1.1.4')     };
  const valDiversos = { ant: absAnt('1.1.5'),     atu: absAtu('1.1.5')     };
  const despAntec   = { ant: absAnt('1.1.6'),     atu: absAtu('1.1.6')     };
  const fornecVW    = { ant: absAnt('2.1.3'),     atu: absAtu('2.1.3')     };
  const fornecAudi  = { ant: absAnt('2.1.4'),     atu: absAtu('2.1.4')     };
  const fornecTotal = { ant: fornecVW.ant + fornecAudi.ant, atu: fornecVW.atu + fornecAudi.atu };
  const obrigTrib   = { ant: absAnt('2.1.2.02'),  atu: absAtu('2.1.2.02')  };
  const obrigTrab   = { ant: absAnt('2.1.2.01'),  atu: absAtu('2.1.2.01')  };
  const contasPagar = { ant: absAnt('2.1.2.03'),  atu: absAtu('2.1.2.03')  };
  const imobiliz    = { ant: absAnt('1.5.5'),     atu: absAtu('1.5.5')     };
  const intangivel  = { ant: absAnt('1.5.7'),     atu: absAtu('1.5.7')     };
  const investimentos = { ant: absAnt('1.5.3'),   atu: absAtu('1.5.3')     };
  const realizLPCred  = { ant: absAnt('1.5.1.01.52'), atu: absAtu('1.5.1.01.52') };
  const emprestCP   = { ant: absAnt('2.1.1'),     atu: absAtu('2.1.1')     };
  const emprestLP   = { ant: absAnt('2.2.1.07'),  atu: absAtu('2.2.1.07')  };
  const pessoasLig  = { ant: absAnt('2.2.1.01'),  atu: absAtu('2.2.1.01')  };
  const debitosLig  = { ant: absAnt('2.2.1.02'),  atu: absAtu('2.2.1.02')  };
  const arrendLP    = { ant: absAnt('2.2.1.15'),  atu: absAtu('2.2.1.15')  };
  const outrosPassLP = { ant: absAnt('2.2.3'),    atu: absAtu('2.2.3')     };
  const grupo2_2_1  = { ant: absAnt('2.2.1'),     atu: absAtu('2.2.1')     };

  const outros2_2_1Ant = grupo2_2_1.ant - emprestLP.ant - pessoasLig.ant - debitosLig.ant - arrendLP.ant;
  const outros2_2_1Atu = grupo2_2_1.atu - emprestLP.atu - pessoasLig.atu - debitosLig.atu - arrendLP.atu;

  const estTotalAnt = estoques.ant + estAudi.ant;
  const estTotalAtu = estoques.atu + estAudi.atu;

  const fluxoOper =
    resultadoLiquido +
    deprec_per +
    (-(estTotalAtu - estTotalAnt)) +
    (-(creditos.atu - creditos.ant)) +
    (-(contasCorr.atu - contasCorr.ant)) +
    (-(valDiversos.atu - valDiversos.ant)) +
    (-(despAntec.atu - despAntec.ant)) +
    (fornecTotal.atu - fornecTotal.ant) +
    (obrigTrib.atu - obrigTrib.ant) +
    (obrigTrab.atu - obrigTrab.ant) +
    (contasPagar.atu - contasPagar.ant);

  const fluxoInvest =
    -(imobiliz.atu - imobiliz.ant) -
    (intangivel.atu - intangivel.ant) -
    (realizLPCred.atu - realizLPCred.ant) -
    (investimentos.atu - investimentos.ant);

  const fluxoFinanc =
    (emprestCP.atu - emprestCP.ant) +
    (emprestLP.atu - emprestLP.ant) +
    (pessoasLig.atu - pessoasLig.ant) +
    (debitosLig.atu - debitosLig.ant) +
    (arrendLP.atu - arrendLP.ant) +
    (outrosPassLP.atu - outrosPassLP.ant) +
    (outros2_2_1Atu - outros2_2_1Ant);

  const variacaoCaixa = fluxoOper + fluxoInvest + fluxoFinanc;

  // ── Estoques (sub-contas detalhadas) ──────────────────────────────────────
  const estoqueVW   = absAtu('1.1.2.01.01.001') + absAtu('1.1.2.02.01.001') + absAtu('1.1.2.03.01.001');
  const estoqueAudi = absAtu('1.1.7.02.01.001') + absAtu('1.1.7.02.02.001') + absAtu('1.1.7.02.03.001');

  // ── Valores a Receber ─────────────────────────────────────────────────────
  const valoresReceber =
    absAtu('1.1.3.01.01') + absAtu('1.1.3.01.03') +
    absAtu('1.1.3.01.04') + absAtu('1.1.3.01.06') + absAtu('1.1.3.01.10');

  // ── Endividamento Bancário ────────────────────────────────────────────────
  const cpBase   = absAtu('2.1.1.02.03');
  const netAcc1  = Math.max(0, absAtu('2.1.1.02.01.001') - absAtu('1.1.2.01.01.001'));
  const netAcc2  = Math.max(0, absAtu('2.1.4.01.01.007') - absAtu('1.1.7.02.01.001'));
  const endividamentoCP = cpBase + netAcc1 + netAcc2;
  const endividamentoLP = emprestLP.atu;

  // ── Mútuo dos Sócios ──────────────────────────────────────────────────────
  const mutuoSocios = absAtu('2.2.1.01.01');

  // ── Parcelamento Refis ────────────────────────────────────────────────────
  const parcelamentoRefis = absAtu('2.1.2.02.07.020') + absAtu('2.2.1.08.01.020');

  // ── Despesas Operacionais (grupo 5 líquido) ───────────────────────────────
  const totalDespesas = despOper5Net;

  return {
    ativoCirculante, ativoNaoCirculante, ativoTotal,
    passivoCirculante, passivoNaoCirculante, patrimonioLiquido,
    receitaLiquida, resultadoAntesIR, resultadoLiquido,
    fluxoOperacional: fluxoOper, fluxoInvestimento: fluxoInvest,
    fluxoFinanciamento: fluxoFinanc, variacaoCaixa,
    estoqueVW, estoqueAudi,
    valoresReceber,
    endividamentoCP, endividamentoLP,
    mutuoSocios, parcelamentoRefis, totalDespesas,
  };
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
const fmtBRL = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000)     return `R$ ${(abs / 1_000).toFixed(0)}K`;
  return 'R$ ' + abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtBRLFull = (v: number): string =>
  'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (v: number): string =>
  `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

// ─── COMPARISON ROW COMPONENT ─────────────────────────────────────────────────
type Direction = 'asc' | 'desc' | 'neutral'; // asc = higher is better

interface CompRowProps {
  label: string;
  desc?: string;
  periods: LoadedPeriod[];
  getValue: (m: ComparativoMetrics) => number;
  direction?: Direction;
  isSubtitle?: boolean;
}

function CompRow({ label, desc, periods, getValue, direction = 'neutral', isSubtitle = false }: CompRowProps) {
  const values = periods.map(p => (p.metrics ? getValue(p.metrics) : null));
  const ref = values[0]; // período 1 é a referência

  // Determinar melhor/pior para colorir cabeçalho
  const nonNullVals = values.filter((v): v is number => v !== null);
  const bestVal = direction === 'asc'  ? Math.max(...nonNullVals) :
                  direction === 'desc' ? Math.min(...nonNullVals) : null;
  const worstVal = direction === 'asc'  ? Math.min(...nonNullVals) :
                   direction === 'desc' ? Math.max(...nonNullVals) : null;

  return (
    <tr className={cn(
      'border-b border-border/40 hover:bg-muted/20 transition-colors',
      isSubtitle && 'bg-muted/30',
    )}>
      {/* Label */}
      <td className={cn('py-3 px-4 text-sm', isSubtitle ? 'font-bold text-foreground' : 'text-muted-foreground')}>
        <div className={cn(isSubtitle && 'font-bold')}>{label}</div>
        {desc && <div className="text-xs text-muted-foreground/70 mt-0.5">{desc}</div>}
      </td>

      {/* Values */}
      {values.map((val, idx) => {
        const period = periods[idx];
        if (!period) return <td key={idx} />;

        if (period.error) {
          return (
            <td key={idx} className="py-3 px-4 text-center">
              <span className="text-xs text-red-500" title={period.error}>Erro</span>
            </td>
          );
        }

        if (!period.loaded || val === null) {
          return (
            <td key={idx} className="py-3 px-4 text-center">
              <span className="text-xs text-muted-foreground/50">—</span>
            </td>
          );
        }

        const isBest  = bestVal  !== null && val === bestVal  && nonNullVals.length > 1;
        const isWorst = worstVal !== null && val === worstVal && nonNullVals.length > 1;

        // Delta vs P1
        let deltaEl: React.ReactNode = null;
        if (idx > 0 && ref !== null && ref !== 0) {
          const pct = ((val - ref) / Math.abs(ref)) * 100;
          const favorable =
            direction === 'neutral' ? null :
            direction === 'asc'  ? pct > 0 :
            pct < 0; // desc→ decrease is good
          const neutralChange = Math.abs(pct) < 0.1;
          deltaEl = (
            <div className={cn(
              'text-xs font-semibold flex items-center justify-end gap-0.5 mt-0.5',
              neutralChange         ? 'text-muted-foreground' :
              favorable === null    ? 'text-muted-foreground' :
              favorable             ? 'text-emerald-600 dark:text-emerald-400' :
                                      'text-red-600 dark:text-red-400',
            )}>
              {neutralChange ? (
                <Minus className="w-3 h-3" />
              ) : pct > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {fmtPct(pct)}
            </div>
          );
        }

        return (
          <td key={idx} className={cn(
            'py-3 px-4 text-right',
            isBest  && direction !== 'neutral' && 'bg-emerald-50/50 dark:bg-emerald-950/20',
            isWorst && direction !== 'neutral' && 'bg-red-50/50 dark:bg-red-950/20',
          )}>
            <div className={cn(
              'text-sm font-mono font-semibold',
              isSubtitle ? 'text-foreground' : 'text-foreground/90',
            )} title={fmtBRLFull(val)}>
              {val < 0 ? <span className="text-red-600 dark:text-red-400">({fmtBRL(Math.abs(val))})</span> : fmtBRL(val)}
            </div>
            {deltaEl}
            {isBest && direction !== 'neutral' && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">★ Melhor</div>
            )}
          </td>
        );
      })}

      {/* Pads for unused period columns */}
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
      <td colSpan={colSpan} className="pt-6 pb-0 px-4">
        <div className="flex items-center gap-2 border-b-2 border-border pb-2 mb-0 mt-4">
          <span className="text-lg">{icon}</span>
          <div>
            <div className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── COMPARISON PANEL ────────────────────────────────────────────────────────
function ComparisonPanel({ periods }: { periods: LoadedPeriod[] }) {
  const activePeriods = periods.filter(p => p.loaded || p.metrics !== null);
  const colSpan = 1 + MAX_PERIODS;

  if (activePeriods.length === 0) return null;

  const allLoading = periods.some(p => p.loaded === false && p.metrics === null && !p.error);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* ── Column headers ─────────────────────────────────── */}
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="py-3.5 px-4 text-left text-xs uppercase tracking-wider font-semibold w-52">
                  Indicador
                </th>
                {periods.map((p, idx) => (
                  <th key={idx} className="py-3.5 px-4 text-right text-xs uppercase tracking-wider font-semibold min-w-[140px]">
                    <div className="text-white">{periodShortLabel(p.period)}</div>
                    {idx === 0 && <div className="text-slate-400 text-[10px] font-normal mt-0.5">referência</div>}
                    {idx > 0 && <div className="text-slate-400 text-[10px] font-normal mt-0.5">vs P{1}</div>}
                    {p.metrics === null && p.loaded === false && !p.error && (
                      <div className="text-amber-400 text-[10px] font-normal mt-0.5">sem dados</div>
                    )}
                    {p.error && <div className="text-red-400 text-[10px] font-normal mt-0.5">erro</div>}
                  </th>
                ))}
                {Array.from({ length: MAX_PERIODS - periods.length }).map((_, i) => (
                  <th key={`ph-${i}`} className="py-3.5 px-4 min-w-[140px]" />
                ))}
              </tr>
            </thead>

            <tbody>
              {/* ─────────── BALANÇO PATRIMONIAL ─────────────── */}
              <SectionHeader icon="📊" title="Balanço Patrimonial" subtitle="Posição Financeira ao Final do Período (Saldo Atual)" colSpan={colSpan} />
              <CompRow label="Ativo Circulante"      desc="1.1 — Disponível, estoques, créditos, outros"             periods={periods} getValue={m => m.ativoCirculante}      direction="asc"     />
              <CompRow label="Ativo Não Circulante"  desc="1.5 — Imobilizado, intangível, investimentos"             periods={periods} getValue={m => m.ativoNaoCirculante}  direction="neutral" />
              <CompRow label="Ativo Total"                                                                            periods={periods} getValue={m => m.ativoTotal}           direction="asc"     isSubtitle />
              <CompRow label="Passivo Circulante"    desc="2.1 — Empréstimos CP, fornecedores, obrigações"           periods={periods} getValue={m => m.passivoCirculante}    direction="desc"    />
              <CompRow label="Passivo Não Circulante" desc="2.2 — Empréstimos LP, mútuos, diferidos"                 periods={periods} getValue={m => m.passivoNaoCirculante} direction="desc"    />
              <CompRow label="Patrimônio Líquido"    desc="2.3 — Capital + Resultados Acumulados"                    periods={periods} getValue={m => m.patrimonioLiquido}     direction="asc"     isSubtitle />

              {/* ─────────── DEMONSTRAÇÃO DO RESULTADO ─────────── */}
              <SectionHeader icon="📈" title="Demonstração do Resultado (DRE)" subtitle="Movimentações do período (receitas e despesas incorridas)" colSpan={colSpan} />
              <CompRow label="Receita Líquida"          desc="Receita Bruta − Impostos − Devoluções"                   periods={periods} getValue={m => m.receitaLiquida}      direction="asc" />
              <CompRow label="Resultado Antes do IR/CSLL" desc="Lucro operacional antes da tributação"                  periods={periods} getValue={m => m.resultadoAntesIR}   direction="asc" isSubtitle />
              <CompRow label="Resultado Líquido do Exercício" desc="Lucro/Prejuízo após IR e CSLL"                       periods={periods} getValue={m => m.resultadoLiquido}   direction="asc" isSubtitle />

              {/* ─────────── FLUXO DE CAIXA ──────────────────── */}
              <SectionHeader icon="💰" title="Fluxo de Caixa (FC Direto)" subtitle="Geração e consumo de caixa no período — Método Indireto" colSpan={colSpan} />
              <CompRow label="Caixa Líquido — Atividades Operacionais"    desc="Resultado ajustado pelas variações de capital de giro"  periods={periods} getValue={m => m.fluxoOperacional}   direction="asc"     />
              <CompRow label="Caixa Líquido — Atividades de Investimento" desc="Imobilizado, intangível, investimentos"                  periods={periods} getValue={m => m.fluxoInvestimento} direction="neutral" />
              <CompRow label="Caixa Líquido — Atividades de Financiamento" desc="Empréstimos, mútuos, arrendamentos"                     periods={periods} getValue={m => m.fluxoFinanciamento} direction="neutral" />
              <CompRow label="Variação Total de Caixa no Período"                                                                        periods={periods} getValue={m => m.variacaoCaixa}      direction="asc"     isSubtitle />

              {/* ─────────── ESTOQUES ────────────────────────── */}
              <SectionHeader icon="📦" title="Posição de Estoques" subtitle="Saldo atual do inventário por marca (contas 1.1.2 e 1.1.7.02)" colSpan={colSpan} />
              <CompRow label="Estoque Sorana VW"    desc="Veículos novos, usados e peças (1.1.2.x)"   periods={periods} getValue={m => m.estoqueVW}   direction="neutral" />
              <CompRow label="Estoque Sorana Audi"  desc="Veículos novos, usados e peças (1.1.7.02.x)" periods={periods} getValue={m => m.estoqueAudi} direction="neutral" />

              {/* ─────────── VALORES A RECEBER ───────────────── */}
              <SectionHeader icon="💳" title="Valores a Receber" subtitle="Saldo atual dos créditos de vendas (1.1.3.01.x)" colSpan={colSpan} />
              <CompRow label="Total Valores a Receber" desc="Clientes e demais créditos de vendas" periods={periods} getValue={m => m.valoresReceber} direction="desc" />

              {/* ─────────── ENDIVIDAMENTO BANCÁRIO ─────────── */}
              <SectionHeader icon="🏦" title="Endividamento Bancário" subtitle="Saldo atual dos empréstimos bancários CP e LP" colSpan={colSpan} />
              <CompRow label="Empréstimos — Curto Prazo"  desc="Floor plan e empréstimos CP (2.1.1.02.03 + floor plans)" periods={periods} getValue={m => m.endividamentoCP} direction="desc" />
              <CompRow label="Empréstimos — Longo Prazo"  desc="Financiamentos bancários LP (2.2.1.07)"                   periods={periods} getValue={m => m.endividamentoLP} direction="desc" />
              <CompRow label="Total Endividamento Bancário"                                                                periods={periods} getValue={m => m.endividamentoCP + m.endividamentoLP} direction="desc" isSubtitle />

              {/* ─────────── MÚTUO DOS SÓCIOS ────────────────── */}
              <SectionHeader icon="🤝" title="Mútuo dos Sócios" subtitle="Saldo atual — conta 2.2.1.01.01" colSpan={colSpan} />
              <CompRow label="Total Mútuo dos Sócios" desc="Aportes e empréstimos entre sócios e empresa" periods={periods} getValue={m => m.mutuoSocios} direction="desc" />

              {/* ─────────── PARCELAMENTO REFIS ──────────────── */}
              <SectionHeader icon="🧾" title="Parcelamento Refis" subtitle="Saldo atual — CP (2.1.2.02.07.020) + LP (2.2.1.08.01.020)" colSpan={colSpan} />
              <CompRow label="Total Parcelamento Refis" desc="Obrigações tributárias parceladas (CP + LP)" periods={periods} getValue={m => m.parcelamentoRefis} direction="desc" />

              {/* ─────────── DESPESAS OPERACIONAIS ───────────── */}
              <SectionHeader icon="📋" title="Despesas Operacionais" subtitle="Movimentação líquida do período — conta 5 (valDeb − valCred)" colSpan={colSpan} />
              <CompRow label="Total Despesas Operacionais" desc="Pessoal, veículos, imóveis, terceiros, financeiras, marketing e outras" periods={periods} getValue={m => m.totalDespesas} direction="desc" />
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div className="border-t border-border px-4 py-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-muted/20">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" />
            <span>★ Melhor período (para indicadores direcionais)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Variação favorável vs P1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-red-600" />
            <span>Variação desfavorável vs P1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Minus className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Estável (variação &lt; 0,1%)</span>
          </div>
          <span className="ml-auto">Valores: hover para exibir valor completo</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PERIOD SELECTOR ─────────────────────────────────────────────────────────
function PeriodSelector({
  index, period, availableKeys, onChange,
}: {
  index: number;
  period: Period;
  availableKeys: Record<string, boolean>;
  onChange: (p: Period) => void;
}) {
  const key = makeKey(period.year, period.month);
  const hasData = !!availableKeys[key];
  const colors = ['emerald', 'blue', 'violet', 'amber'] as const;
  const color = colors[index % colors.length];

  const colorBorder: Record<string, string> = {
    emerald: 'border-emerald-500',
    blue:    'border-blue-500',
    violet:  'border-violet-500',
    amber:   'border-amber-500',
  };
  const colorBg: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30',
    blue:    'bg-blue-50 dark:bg-blue-950/30',
    violet:  'bg-violet-50 dark:bg-violet-950/30',
    amber:   'bg-amber-50 dark:bg-amber-950/30',
  };
  const colorText: Record<string, string> = {
    emerald: 'text-emerald-700 dark:text-emerald-300',
    blue:    'text-blue-700 dark:text-blue-300',
    violet:  'text-violet-700 dark:text-violet-300',
    amber:   'text-amber-700 dark:text-amber-300',
  };

  return (
    <div className={cn(
      'rounded-xl border-2 p-3 space-y-2',
      colorBorder[color], colorBg[color],
    )}>
      <div className={cn('text-xs font-bold uppercase tracking-wider', colorText[color])}>
        Período {index + 1}{index === 0 ? ' — Referência' : ''}
      </div>

      <div className="flex gap-2">
        {/* Ano */}
        <select
          value={period.year}
          onChange={e => onChange({ ...period, year: Number(e.target.value) })}
          className="flex-1 rounded-lg border border-border bg-background text-foreground text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-offset-1"
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Mês */}
        <select
          value={period.month}
          onChange={e => onChange({ ...period, month: Number(e.target.value) })}
          className="flex-1 rounded-lg border border-border bg-background text-foreground text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-offset-1"
        >
          {MONTH_LIST.map(m => <option key={m.n} value={m.n}>{m.short}</option>)}
        </select>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5 text-xs">
        {hasData ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-700 dark:text-emerald-300 font-medium">Balancete disponível</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400">Sem dados para este período</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function ComparativosTab() {
  // ── KV Index ───────────────────────────────────────────────────────────────
  const [availableKeys, setAvailableKeys] = useState<Record<string, boolean>>({});
  const [indexLoading, setIndexLoading]   = useState(true);
  const [indexError, setIndexError]       = useState<string | null>(null);

  // ── Comparison state ────────────────────────────────────────────────────────
  const [selectedPeriods, setSelectedPeriods] = useState<Period[]>([
    { year: 2025, month: 12 },
    { year: 2025, month: 6  },
    { year: 2024, month: 12 },
    { year: 2024, month: 6  },
  ]);
  const [activePeriodCount, setActivePeriodCount] = useState(4);
  const [loadedPeriods, setLoadedPeriods]   = useState<LoadedPeriod[]>([]);
  const [compLoading, setCompLoading]       = useState(false);
  const [compError, setCompError]           = useState<string | null>(null);
  const [hasResults, setHasResults]         = useState(false);

  // ── Data management (upload grid) ─────────────────────────────────────────
  const [manageOpen, setManageOpen]       = useState(false);
  const [uploading, setUploading]         = useState<string | null>(null);
  const [deleting, setDeleting]           = useState<string | null>(null);
  const [cellError, setCellError]         = useState<{ key: string; msg: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ year: number; month: number } | null>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const pendingCell = useRef<{ year: number; month: number } | null>(null);

  // ── Load KV index on mount ──────────────────────────────────────────────────
  useEffect(() => {
    setIndexLoading(true);
    loadComparativosIndex()
      .then(idx => { setAvailableKeys(idx); setIndexError(null); })
      .catch(e => setIndexError(String(e)))
      .finally(() => setIndexLoading(false));
  }, []);

  // ── Preset helpers ──────────────────────────────────────────────────────────
  const applyPreset = (preset: 'annual' | 'monthly') => {
    const now = new Date();
    const curYear = now.getFullYear();
    if (preset === 'annual') {
      setActivePeriodCount(4);
      setSelectedPeriods([
        { year: curYear,     month: 0 },
        { year: curYear - 1, month: 0 },
        { year: curYear - 2, month: 0 },
        { year: curYear - 3, month: 0 },
      ]);
    } else {
      const curMonth = now.getMonth() + 1;
      const periods: Period[] = [];
      let y = curYear, m = curMonth;
      for (let i = 0; i < 4; i++) {
        periods.push({ year: y, month: m });
        m--; if (m < 1) { m = 12; y--; }
      }
      setActivePeriodCount(4);
      setSelectedPeriods(periods);
    }
  };

  // ── Run comparison ──────────────────────────────────────────────────────────
  const runComparison = useCallback(async () => {
    setCompLoading(true);
    setCompError(null);
    const active = selectedPeriods.slice(0, activePeriodCount);
    const results: LoadedPeriod[] = [];

    for (const period of active) {
      const key = makeKey(period.year, period.month);
      const inIndex = !!availableKeys[key];

      if (!inIndex) {
        results.push({ period, metrics: null, loaded: false, error: null });
        continue;
      }

      try {
        const entry = await loadComparativo(period.year, period.month);
        if (!entry?.rawText) {
          results.push({ period, metrics: null, loaded: false, error: 'Sem rawText' });
          continue;
        }
        const metrics = extractMetricsFromRaw(entry.rawText);
        results.push({ period, metrics, loaded: true, error: null });
      } catch (e: any) {
        results.push({ period, metrics: null, loaded: false, error: String(e) });
      }
    }

    setLoadedPeriods(results);
    setHasResults(true);
    setCompLoading(false);
  }, [selectedPeriods, activePeriodCount, availableKeys]);

  // ── Upload handler ──────────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const cell = pendingCell.current;
    if (!file || !cell) return;
    e.target.value = '';
    const { year, month } = cell;
    const key = makeKey(year, month);
    setUploading(key); setCellError(null);
    try {
      const text = await readFileAsLatin1(file);
      await saveComparativo(year, month, text);
      setAvailableKeys(prev => ({ ...prev, [key]: true }));
    } catch (err: any) {
      setCellError({ key, msg: err?.message ?? 'Erro ao importar arquivo' });
    } finally {
      setUploading(null); pendingCell.current = null;
    }
  }, []);

  const openFilePicker = (year: number, month: number) => {
    pendingCell.current = { year, month };
    fileRef.current?.click();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { year, month } = confirmDelete;
    const key = makeKey(year, month);
    setConfirmDelete(null); setDeleting(key); setCellError(null);
    try {
      await deleteComparativo(year, month);
      setAvailableKeys(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch (err: any) {
      setCellError({ key, msg: err?.message ?? 'Erro ao excluir' });
    } finally {
      setDeleting(null);
    }
  };

  const handleCellClick = (year: number, month: number) => {
    const key = makeKey(year, month);
    if (uploading === key || deleting === key) return;
    if (availableKeys[key]) setConfirmDelete({ year, month });
    else openFilePicker(year, month);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const totalAvailable = Object.keys(availableKeys).length;
  const activePeriods  = selectedPeriods.slice(0, activePeriodCount);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <BarChart3 className="w-6 h-6 text-green-600" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Painel Comparativo Executivo
          </h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 ml-9">
          Compare até 4 períodos lado a lado com indicadores-chave extraídos automaticamente dos balancetes importados.
          {totalAvailable > 0 && (
            <span className="text-green-600 dark:text-green-400 font-medium ml-1">
              {totalAvailable} período{totalAvailable !== 1 ? 's' : ''} disponíve{totalAvailable !== 1 ? 'is' : 'l'}.
            </span>
          )}
        </p>
      </div>

      {indexLoading && (
        <div className="flex items-center gap-3 text-slate-500 text-sm py-4">
          <Loader2 className="w-5 h-5 animate-spin text-green-500" />
          Carregando dados disponíveis...
        </div>
      )}
      {indexError && (
        <div className="flex items-center gap-3 text-red-600 text-sm p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5" />
          Erro ao carregar índice: {indexError}
        </div>
      )}

      {/* ── Setup Card ── */}
      <Card>
        <CardContent className="pt-5 space-y-5">
          {/* Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atalhos:</span>
            <button
              onClick={() => applyPreset('annual')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-border"
            >
              📅 Últimos 4 Anos (Anual)
            </button>
            <button
              onClick={() => applyPreset('monthly')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-border"
            >
              📆 Últimos 4 Meses
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Períodos:</span>
              {[2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setActivePeriodCount(n)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-sm font-bold border transition-colors',
                    activePeriodCount === n
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-background border-border hover:bg-muted',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Period selectors */}
          <div className={cn(
            'grid gap-3',
            activePeriodCount === 2 ? 'grid-cols-1 sm:grid-cols-2' :
            activePeriodCount === 3 ? 'grid-cols-1 sm:grid-cols-3' :
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
          )}>
            {Array.from({ length: activePeriodCount }).map((_, idx) => (
              <PeriodSelector
                key={idx}
                index={idx}
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

          {/* Run button */}
          <div className="flex items-center gap-4">
            <button
              onClick={runComparison}
              disabled={compLoading || indexLoading}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all',
                'bg-green-600 hover:bg-green-700 text-white shadow-sm',
                (compLoading || indexLoading) && 'opacity-70 cursor-wait',
              )}
            >
              {compLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Gerar Comparativo</>
              )}
            </button>
            {compError && (
              <span className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />{compError}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Summary KPI strip ── */}
      {hasResults && loadedPeriods.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loadedPeriods.map((p, idx) => {
            const colors = ['emerald', 'blue', 'violet', 'amber'] as const;
            const c = colors[idx % colors.length];
            const colorMap: Record<string, string> = {
              emerald: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
              blue:    'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30',
              violet:  'border-l-violet-500 bg-violet-50 dark:bg-violet-950/30',
              amber:   'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
            };
            const textMap: Record<string, string> = {
              emerald: 'text-emerald-700 dark:text-emerald-300',
              blue:    'text-blue-700 dark:text-blue-300',
              violet:  'text-violet-700 dark:text-violet-300',
              amber:   'text-amber-700 dark:text-amber-300',
            };
            return (
              <Card key={idx} className={cn('border-l-4', colorMap[c])}>
                <CardContent className="pt-4 pb-3">
                  <div className={cn('text-xs font-bold uppercase tracking-wider mb-1', textMap[c])}>
                    P{idx + 1} — {periodShortLabel(p.period)}
                  </div>
                  <div className="text-sm font-semibold text-foreground">{periodLongLabel(p.period)}</div>
                  {p.metrics ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Ativo Total: <span className="font-mono font-semibold">{fmtBRL(p.metrics.ativoTotal)}</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {p.error ? 'Erro ao carregar' : 'Sem dados'}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Comparison table ── */}
      {hasResults && <ComparisonPanel periods={loadedPeriods} />}

      {/* ── Empty state ── */}
      {!hasResults && !compLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-4">
          <BarChart3 className="w-12 h-12 text-muted-foreground/30" />
          <div>
            <p className="text-base font-semibold mb-1">Nenhum comparativo gerado ainda</p>
            <p className="text-sm">Selecione os períodos acima e clique em <strong>Gerar Comparativo</strong>.</p>
            {totalAvailable === 0 && (
              <p className="text-sm mt-2 text-amber-600 dark:text-amber-400">
                Nenhum balancete importado. Use a seção <strong>Gerenciar Balancetes</strong> abaixo para importar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Manage section (collapsible) ── */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setManageOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold text-sm text-foreground">Gerenciar Balancetes Importados</span>
            {totalAvailable > 0 && (
              <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                {totalAvailable} importados
              </span>
            )}
          </div>
          {manageOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {manageOpen && (
          <div className="p-5 space-y-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Clique em uma célula para importar o balancete (.txt / .csv) daquele período.
              Balancetes importados ficam disponíveis para uso no comparativo acima.
            </p>

            {/* Hidden file input */}
            <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFileChange} />

            {/* Grid */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-4 py-3 text-left font-semibold w-16 rounded-tl-xl">Ano</th>
                    <th className="px-3 py-3 text-center font-semibold w-16">Anual</th>
                    {MONTHS_GRID.map(m => (
                      <th key={m.n} className="px-3 py-3 text-center font-semibold w-14">{m.short}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {YEARS.map((year, yi) => (
                    <tr key={year} className={cn(yi % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50')}>
                      <td className="px-4 py-2 font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700">{year}</td>
                      {[{ n: 0, short: 'Anual' }, ...MONTHS_GRID].map(m => {
                        const key = makeKey(year, m.n);
                        const isLoaded    = !!availableKeys[key];
                        const isUploading = uploading === key;
                        const isDeleting  = deleting === key;
                        const hasError    = cellError?.key === key;
                        const busy        = isUploading || isDeleting;
                        return (
                          <td key={m.n} className="px-1 py-1 text-center">
                            <button
                              onClick={() => handleCellClick(year, m.n)}
                              disabled={busy}
                              title={isLoaded ? `${m.short}/${year} — clique para excluir ou substituir` : `Importar balancete ${m.short}/${year}`}
                              className={cn(
                                'w-9 h-9 rounded-lg flex items-center justify-center mx-auto transition-all border focus:outline-none',
                                busy       && 'cursor-wait opacity-70',
                                !busy && isLoaded && !hasError && 'border-green-300 bg-green-50 hover:bg-red-50 hover:border-red-300 dark:bg-green-900/30 dark:border-green-700 group',
                                !busy && !isLoaded && !hasError && 'border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800',
                                hasError   && 'border-red-300 bg-red-50 dark:bg-red-900/30',
                              )}
                            >
                              {isUploading || isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                              ) : hasError ? (
                                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                              ) : isLoaded ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-green-600 group-hover:hidden dark:text-green-400" />
                                  <Trash2 className="w-3.5 h-3.5 text-red-500 hidden group-hover:block" />
                                </>
                              ) : (
                                <Upload className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded border border-green-300 bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                </div>
                <span>Balancete importado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded border border-slate-200 bg-white flex items-center justify-center">
                  <Upload className="w-3 h-3 text-slate-400" />
                </div>
                <span>Sem dados — clique para importar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded border border-red-300 bg-red-50 flex items-center justify-center">
                  <Trash2 className="w-3 h-3 text-red-500" />
                </div>
                <span>Passe o mouse para excluir</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Confirm delete dialog ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-80 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Excluir balancete?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Deseja excluir ou substituir o balancete de{' '}
              <strong>
                {MONTH_LIST.find(m => m.n === confirmDelete.month)?.short}/{confirmDelete.year}
              </strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { const { year, month } = confirmDelete; setConfirmDelete(null); openFilePicker(year, month); }}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >Substituir</button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >Excluir</button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 dark:text-slate-300 dark:border-slate-600 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
