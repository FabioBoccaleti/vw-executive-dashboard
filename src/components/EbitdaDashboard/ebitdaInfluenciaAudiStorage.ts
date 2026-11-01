/**
 * Regra de influência das Despesas Financeiras na DRE Audi (Ebitda Audi).
 *
 * Mesmo mecanismo do Ebitda VW, porém:
 *  - lê os dados de "Despesas por Departamento na Sorana Audi";
 *  - aplica o overlay na DRE Audi (6 departamentos, sem "Venda Direta").
 *
 * Mapeamento de departamentos (Despesas Audi → DRE Audi):
 *  - Venda Direta é somada em Veículos Novos (não há coluna na DRE Audi);
 *  - Diretoria é somada em Administração.
 *
 * Regra e overlay são independentes do Ebitda VW (chave KV própria).
 */

import { kvGet, kvSet } from '@/lib/kvClient';
import { parseDreValue } from '@/components/ResumoDREDashboard/dreDisplayFormat';
import type { DreAudiRow, DreAudiDept } from '@/components/ResumoDREDashboard/dreAudiStorage';
import {
  getDespesasAdmMes,
  loadClassificacoes,
  loadRegrasDeptos,
  extractByDeptoRule,
  type DeptoTab,
} from '@/components/DespesasDeptoAudiDashboard/despesasDeptoAudiStorage';
import {
  DEFAULT_INFLUENCIA_RULE,
  ZEROABLE_LINES,
  type InfluenciaDFRule,
} from './ebitdaInfluenciaStorage';

const ZEROABLE_FIELDS = new Set(ZEROABLE_LINES.map(l => l.field));

type DreDeptKey = 'novos' | 'usados' | 'pecas' | 'oficina' | 'funilaria' | 'adm';

const DRE_DEPT_KEYS: DreDeptKey[] = ['novos', 'usados', 'pecas', 'oficina', 'funilaria', 'adm'];

// Mapeamento departamento (Despesas Audi) → departamento da DRE Audi.
// Venda Direta → Veículos Novos; Diretoria → Administração.
const DEPTO_TO_DRE: { depto: DeptoTab; dre: DreDeptKey }[] = [
  { depto: 'veiculos_novos',  dre: 'novos' },
  { depto: 'venda_direta',    dre: 'novos' },
  { depto: 'veiculos_usados', dre: 'usados' },
  { depto: 'pecas',           dre: 'pecas' },
  { depto: 'oficina',         dre: 'oficina' },
  { depto: 'funilaria',       dre: 'funilaria' },
  { depto: 'administracao',   dre: 'adm' },
  { depto: 'diretoria',       dre: 'adm' },
];

// ─── Persistência ──────────────────────────────────────────────────────────

const RULE_KEY = 'ebitda:audi:influencia_df';

export async function loadInfluenciaAudiDF(): Promise<InfluenciaDFRule> {
  const saved = await kvGet<InfluenciaDFRule>(RULE_KEY);
  if (!saved) return { ...DEFAULT_INFLUENCIA_RULE };
  return {
    targetField: saved.targetField ?? '',
    sign: saved.sign === 1 ? 1 : -1,
    zeroedLines: (saved.zeroedLines ?? []).filter(f => ZEROABLE_FIELDS.has(f)),
    selectedContas: Array.isArray(saved.selectedContas) ? saved.selectedContas : undefined,
  };
}

export async function saveInfluenciaAudiDF(rule: InfluenciaDFRule): Promise<void> {
  await kvSet(RULE_KEY, rule);
}

/** Lista (ordenada) das contas classificadas como Despesas Financeiras (Audi). */
export async function loadFinanceirasContasAudi(): Promise<string[]> {
  const classif = await loadClassificacoes();
  return Object.entries(classif)
    .filter(([, tipo]) => tipo === 'financeiras')
    .map(([conta]) => conta)
    .sort((a, b) => a.localeCompare(b));
}

// ─── Cálculo por departamento da DRE Audi ────────────────────────────────────

export async function computeFinanceirasPorDreDeptoAudi(
  year: number,
  month: number,
  selectedContas?: string[],
): Promise<Record<DreDeptKey, number>> {
  const result: Record<DreDeptKey, number> = {
    novos: 0, usados: 0, pecas: 0, oficina: 0, funilaria: 0, adm: 0,
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

// ─── Overlay ──────────────────────────────────────────────────────────────────

const g = (dept: DreAudiDept, field: keyof DreAudiDept) => parseDreValue(dept[field]);

/** Recalcula os totais da DRE Audi. Administração: ROL tratada como 0 (isAdmROL). */
function recomputeDeptTotals(dept: DreAudiDept, isAdm: boolean): DreAudiDept {
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

function applyToDept(dept: DreAudiDept, financeiras: number, rule: InfluenciaDFRule, isAdm: boolean): DreAudiDept {
  const next: DreAudiDept = { ...dept };
  if (rule.targetField && financeiras !== 0) {
    const atual = parseDreValue(next[rule.targetField]);
    next[rule.targetField] = String(Math.round(atual + rule.sign * financeiras));
  }
  if (rule.zeroedLines) {
    for (const f of rule.zeroedLines) next[f] = '0';
  }
  return recomputeDeptTotals(next, isAdm);
}

export function makeInfluenciaAudiOverlay(
  rule: InfluenciaDFRule,
): (row: DreAudiRow, year: number, month: number) => Promise<DreAudiRow> {
  return async (row, year, month) => {
    const hasZero = (rule.zeroedLines?.length ?? 0) > 0;
    const hasInflu = !!rule.targetField && (rule.selectedContas === undefined || rule.selectedContas.length > 0);
    if (!hasZero && !hasInflu) return row;

    let fin: Record<DreDeptKey, number> = {
      novos: 0, usados: 0, pecas: 0, oficina: 0, funilaria: 0, adm: 0,
    };
    if (hasInflu && month >= 1 && month <= 12) {
      fin = await computeFinanceirasPorDreDeptoAudi(year, month, rule.selectedContas);
    }

    const next: DreAudiRow = { ...row };
    for (const k of DRE_DEPT_KEYS) {
      if (hasZero || fin[k] !== 0) {
        next[k] = applyToDept(row[k], fin[k], rule, k === 'adm');
      }
    }
    return next;
  };
}
