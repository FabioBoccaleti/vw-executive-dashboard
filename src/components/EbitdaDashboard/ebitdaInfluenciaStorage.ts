/**
 * Regra de influência das Despesas Financeiras na DRE (Ebitda VW).
 *
 * Uma única regra para todo o grupo "Despesas Financeiras": o usuário escolhe
 * uma linha-alvo da DRE e o sinal (positivo = soma / negativo = deduz). O valor
 * aplicado em cada departamento é o subtotal de Despesas Financeiras daquele
 * departamento no período. O departamento "Diretoria" é somado em Administração.
 *
 * O cálculo é um overlay: não altera a base real da DRE (Resumo DRE VW),
 * apenas os números exibidos na aba DRE do Ebitda VW.
 */

import { kvGet, kvSet } from '@/lib/kvClient';
import { parseDreValue } from '@/components/ResumoDREDashboard/dreDisplayFormat';
import type { DreVwRow, DreVwDept } from '@/components/ResumoDREDashboard/dreVwStorage';
import {
  getDespesasAdmMes,
  loadClassificacoes,
  loadRegrasDeptos,
  extractByDeptoRule,
  type DeptoTab,
} from '@/components/DespesasDeptoVwDashboard/despesasDeptoVwStorage';

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Campos da DRE que podem ser alvo da influência (linhas base, sem totais). */
export type DreTargetField =
  | 'receitaOperacionalLiquida'
  | 'custoOperacionalReceita'
  | 'outrasReceitasOperacionais'
  | 'outrasDespesasOperacionais'
  | 'despPessoal'
  | 'despServTerceiros'
  | 'despOcupacao'
  | 'despFuncionamento'
  | 'despVendas'
  | 'amortizacoesDepreciacoes'
  | 'outrasReceitasFinanceiras'
  | 'despFinanceirasNaoOperacional'
  | 'despesasNaoOperacionais'
  | 'outrasRendasNaoOperacionais'
  | 'provisoesIrpjCs'
  | 'participacoes';

export interface InfluenciaDFRule {
  /** Linha-alvo da DRE. '' = não influenciar. */
  targetField: DreTargetField | '';
  /** +1 soma na linha, -1 deduz da linha. */
  sign: 1 | -1;
  /** Linhas da DRE que devem ser zeradas (0,00) antes de recalcular os totais. */
  zeroedLines?: DreTargetField[];
  /**
   * Contas do grupo Despesas Financeiras que entram na influência.
   * `undefined` = todas (compatibilidade); `[]` = nenhuma (sem influência);
   * lista = apenas as contas marcadas.
   */
  selectedContas?: string[];
}

export const DEFAULT_INFLUENCIA_RULE: InfluenciaDFRule = {
  targetField: '',
  sign: -1,
  zeroedLines: [],
};

/** Linhas da DRE que podem ser zeradas individualmente (apenas no Ebitda VW). */
export const ZEROABLE_LINES: { field: DreTargetField; label: string }[] = [
  { field: 'outrasReceitasFinanceiras',     label: 'Outras Receitas Financeiras' },
  { field: 'despFinanceirasNaoOperacional', label: '(-) Despesas Financeiras Não Operacional' },
  { field: 'despesasNaoOperacionais',       label: '(-) Despesas Não Operacionais' },
  { field: 'outrasRendasNaoOperacionais',   label: 'Outras Rendas Não Operacionais' },
];

const ZEROABLE_FIELDS = new Set<DreTargetField>(ZEROABLE_LINES.map(l => l.field));

/** Linhas da DRE selecionáveis como alvo, na ordem da DRE. */
export const DRE_TARGET_LINES: { field: DreTargetField; label: string }[] = [
  { field: 'receitaOperacionalLiquida',    label: 'Receita Operacional Líquida' },
  { field: 'custoOperacionalReceita',      label: '(-) Custo Operacional da Receita' },
  { field: 'outrasReceitasOperacionais',   label: 'Outras Receitas Operacionais' },
  { field: 'outrasDespesasOperacionais',   label: '(-) Outras Despesas Operacionais' },
  { field: 'despPessoal',                  label: '(-) Despesas c/ Pessoal' },
  { field: 'despServTerceiros',            label: '(-) Despesas c/ Serv. de Terceiros' },
  { field: 'despOcupacao',                 label: '(-) Despesas c/ Ocupação' },
  { field: 'despFuncionamento',            label: '(-) Despesas c/ Funcionamento' },
  { field: 'despVendas',                   label: '(-) Despesas c/ Vendas' },
  { field: 'amortizacoesDepreciacoes',     label: 'Amortizações e Depreciações' },
  { field: 'outrasReceitasFinanceiras',    label: 'Outras Receitas Financeiras' },
  { field: 'despFinanceirasNaoOperacional', label: '(-) Despesas Financeiras Não Operacional' },
  { field: 'despesasNaoOperacionais',      label: '(-) Despesas Não Operacionais' },
  { field: 'outrasRendasNaoOperacionais',  label: 'Outras Rendas Não Operacionais' },
  { field: 'provisoesIrpjCs',              label: '(-) Provisões IRPJ e C.S.' },
  { field: 'participacoes',                label: '(-) Participações' },
];

type DreDeptKey = 'novos' | 'direta' | 'usados' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

const DRE_DEPT_KEYS: DreDeptKey[] = ['novos', 'direta', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'];

// Mapeamento departamento (Despesas Depto) → departamento da DRE.
// Diretoria é somada em Administração (adm).
const DEPTO_TO_DRE: { depto: DeptoTab; dre: DreDeptKey }[] = [
  { depto: 'veiculos_novos',  dre: 'novos' },
  { depto: 'venda_direta',    dre: 'direta' },
  { depto: 'veiculos_usados', dre: 'usados' },
  { depto: 'pecas',           dre: 'pecas' },
  { depto: 'oficina',         dre: 'oficina' },
  { depto: 'funilaria',       dre: 'funilaria' },
  { depto: 'administracao',   dre: 'adm' },
  { depto: 'diretoria',       dre: 'adm' },
];

// ─── Persistência ──────────────────────────────────────────────────────────

const RULE_KEY = 'ebitda:vw:influencia_df';

export async function loadInfluenciaDF(): Promise<InfluenciaDFRule> {
  const saved = await kvGet<InfluenciaDFRule>(RULE_KEY);
  if (!saved) return { ...DEFAULT_INFLUENCIA_RULE };
  return {
    targetField: saved.targetField ?? '',
    sign: saved.sign === 1 ? 1 : -1,
    zeroedLines: (saved.zeroedLines ?? []).filter(f => ZEROABLE_FIELDS.has(f)),
    // undefined = todas as contas (compatibilidade com regras antigas)
    selectedContas: Array.isArray(saved.selectedContas) ? saved.selectedContas : undefined,
  };
}

export async function saveInfluenciaDF(rule: InfluenciaDFRule): Promise<void> {
  await kvSet(RULE_KEY, rule);
}

/** Retorna a lista (ordenada) de contas classificadas como Despesas Financeiras. */
export async function loadFinanceirasContas(): Promise<string[]> {
  const classif = await loadClassificacoes();
  return Object.entries(classif)
    .filter(([, tipo]) => tipo === 'financeiras')
    .map(([conta]) => conta)
    .sort((a, b) => a.localeCompare(b));
}

// ─── Cálculo das Despesas Financeiras por departamento da DRE ────────────────

/**
 * Soma o subtotal de Despesas Financeiras de cada departamento (mapeado para a
 * DRE) para um mês específico (1-12). Diretoria é somada em Administração.
 * Se `selectedContas` for informado, soma apenas essas contas; `undefined`
 * considera todas as contas de Despesas Financeiras.
 */
export async function computeFinanceirasPorDreDepto(
  year: number,
  month: number,
  selectedContas?: string[],
): Promise<Record<DreDeptKey, number>> {
  const result: Record<DreDeptKey, number> = {
    novos: 0, direta: 0, usados: 0, pecas: 0, oficina: 0, funilaria: 0, adm: 0,
  };

  const data = await getDespesasAdmMes(year, month);
  if (!data) return result;

  const [classif, regras] = await Promise.all([loadClassificacoes(), loadRegrasDeptos()]);
  const contaFilter = selectedContas ? new Set(selectedContas) : null;

  for (const { depto, dre } of DEPTO_TO_DRE) {
    const map = extractByDeptoRule(data, depto, regras);
    let sum = 0;
    for (const [conta, valor] of map) {
      if (classif[conta] !== 'financeiras') continue;
      if (contaFilter && !contaFilter.has(conta)) continue;
      sum += valor;
    }
    result[dre] += sum;
  }

  return result;
}

// ─── Aplicação do overlay ────────────────────────────────────────────────────

const g = (dept: DreVwDept, field: keyof DreVwDept) => parseDreValue(dept[field]);

/** Recalcula as linhas de total/subtotal da DRE a partir das linhas base. */
function recomputeDeptTotals(dept: DreVwDept, isAdm: boolean): DreVwDept {
  // Administração não tem Receita Operacional Líquida (exibida como 0,00 no
  // Resumo DRE via isAdmROL). Tratamos como 0 para não vazar valor no total.
  const rol = isAdm ? 0 : g(dept, 'receitaOperacionalLiquida');
  const lucroBruto = rol + g(dept, 'custoOperacionalReceita');
  const margem =
    lucroBruto + g(dept, 'outrasReceitasOperacionais') + g(dept, 'outrasDespesasOperacionais');
  const lucroLiq =
    margem +
    g(dept, 'despPessoal') + g(dept, 'despServTerceiros') + g(dept, 'despOcupacao') +
    g(dept, 'despFuncionamento') + g(dept, 'despVendas');
  const lucroAntes =
    lucroLiq +
    g(dept, 'amortizacoesDepreciacoes') + g(dept, 'outrasReceitasFinanceiras') +
    g(dept, 'despFinanceirasNaoOperacional') + g(dept, 'despesasNaoOperacionais') +
    g(dept, 'outrasRendasNaoOperacionais');
  const lucroLiquidoEx =
    lucroAntes + g(dept, 'provisoesIrpjCs') + g(dept, 'participacoes');

  return {
    ...dept,
    lucroPrejOperacionalBruto: String(Math.round(lucroBruto)),
    margemContribuicao: String(Math.round(margem)),
    lucroPrejOperacionalLiquido: String(Math.round(lucroLiq)),
    lucroPrejAntesImpostos: String(Math.round(lucroAntes)),
    lucroLiquidoExercicio: String(Math.round(lucroLiquidoEx)),
  };
}

/** Aplica o delta financeiro à linha-alvo, zera as linhas marcadas e recalcula totais. */
function applyToDept(dept: DreVwDept, financeiras: number, rule: InfluenciaDFRule, isAdm: boolean): DreVwDept {
  const next: DreVwDept = { ...dept };
  // Influência: soma/deduz o valor financeiro na linha-alvo.
  if (rule.targetField && financeiras !== 0) {
    const atual = parseDreValue(next[rule.targetField]);
    next[rule.targetField] = String(Math.round(atual + rule.sign * financeiras));
  }
  // Zerar linhas marcadas (zerar vence sobre a influência).
  if (rule.zeroedLines) {
    for (const f of rule.zeroedLines) next[f] = '0';
  }
  return recomputeDeptTotals(next, isAdm);
}

/**
 * Cria a função de overlay que o VwDreTab aplica após carregar cada linha.
 * Para o período (ano, mês) soma as Despesas Financeiras por departamento e
 * injeta na linha-alvo escolhida, zera as linhas marcadas e recalcula os
 * totais. Não altera a base.
 */
export function makeInfluenciaOverlay(
  rule: InfluenciaDFRule,
): (row: DreVwRow, year: number, month: number) => Promise<DreVwRow> {
  return async (row, year, month) => {
    const hasZero = (rule.zeroedLines?.length ?? 0) > 0;
    // Influência efetiva: linha-alvo escolhida E ao menos uma conta (ou "todas").
    const hasInflu = !!rule.targetField && (rule.selectedContas === undefined || rule.selectedContas.length > 0);
    if (!hasZero && !hasInflu) return row;

    let fin: Record<DreDeptKey, number> = {
      novos: 0, direta: 0, usados: 0, pecas: 0, oficina: 0, funilaria: 0, adm: 0,
    };
    if (hasInflu && month >= 1 && month <= 12) {
      fin = await computeFinanceirasPorDreDepto(year, month, rule.selectedContas);
    }

    const next: DreVwRow = { ...row };
    for (const k of DRE_DEPT_KEYS) {
      if (hasZero || fin[k] !== 0) {
        next[k] = applyToDept(row[k], fin[k], rule, k === 'adm');
      }
    }
    return next;
  };
}
