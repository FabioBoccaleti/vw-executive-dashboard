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
}

export const DEFAULT_INFLUENCIA_RULE: InfluenciaDFRule = {
  targetField: '',
  sign: -1,
};

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
  };
}

export async function saveInfluenciaDF(rule: InfluenciaDFRule): Promise<void> {
  await kvSet(RULE_KEY, rule);
}

// ─── Cálculo das Despesas Financeiras por departamento da DRE ────────────────

/**
 * Soma o subtotal de Despesas Financeiras de cada departamento (mapeado para a
 * DRE) para um mês específico (1-12). Diretoria é somada em Administração.
 */
export async function computeFinanceirasPorDreDepto(
  year: number,
  month: number,
): Promise<Record<DreDeptKey, number>> {
  const result: Record<DreDeptKey, number> = {
    novos: 0, direta: 0, usados: 0, pecas: 0, oficina: 0, funilaria: 0, adm: 0,
  };

  const data = await getDespesasAdmMes(year, month);
  if (!data) return result;

  const [classif, regras] = await Promise.all([loadClassificacoes(), loadRegrasDeptos()]);

  for (const { depto, dre } of DEPTO_TO_DRE) {
    const map = extractByDeptoRule(data, depto, regras);
    let sum = 0;
    for (const [conta, valor] of map) {
      if (classif[conta] === 'financeiras') sum += valor;
    }
    result[dre] += sum;
  }

  return result;
}

// ─── Aplicação do overlay ────────────────────────────────────────────────────

const g = (dept: DreVwDept, field: keyof DreVwDept) => parseDreValue(dept[field]);

/** Recalcula as linhas de total/subtotal da DRE a partir das linhas base. */
function recomputeDeptTotals(dept: DreVwDept): DreVwDept {
  const lucroBruto =
    g(dept, 'receitaOperacionalLiquida') + g(dept, 'custoOperacionalReceita');
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

/** Aplica o delta financeiro à linha-alvo do departamento e recalcula totais. */
function applyToDept(dept: DreVwDept, financeiras: number, rule: InfluenciaDFRule): DreVwDept {
  if (!rule.targetField) return dept;
  const next: DreVwDept = { ...dept };
  const atual = parseDreValue(next[rule.targetField]);
  next[rule.targetField] = String(Math.round(atual + rule.sign * financeiras));
  return recomputeDeptTotals(next);
}

/**
 * Cria a função de overlay que o VwDreTab aplica após carregar cada linha.
 * Para o período (ano, mês) soma as Despesas Financeiras por departamento e
 * injeta na linha-alvo escolhida, recalculando os totais. Não altera a base.
 */
export function makeInfluenciaOverlay(
  rule: InfluenciaDFRule,
): (row: DreVwRow, year: number, month: number) => Promise<DreVwRow> {
  return async (row, year, month) => {
    if (!rule.targetField || month < 1 || month > 12) return row;

    const fin = await computeFinanceirasPorDreDepto(year, month);
    const hasInfluence = DRE_DEPT_KEYS.some(k => fin[k] !== 0);
    if (!hasInfluence) return row;

    const next: DreVwRow = { ...row };
    for (const k of DRE_DEPT_KEYS) {
      if (fin[k] !== 0) next[k] = applyToDept(row[k], fin[k], rule);
    }
    return next;
  };
}
