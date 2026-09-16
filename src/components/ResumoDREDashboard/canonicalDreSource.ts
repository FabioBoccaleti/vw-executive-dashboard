import { getBaseGerencialMes } from '@/components/BaseGerencialDashboard/baseGerencialStorage';
import { loadBaseGerencialDreSnapshot } from '@/components/BaseGerencialDashboard/baseGerencialDataProcessor';
import { createEmptyDreAudiRow, type DreAudiDept, type DreAudiRow } from './dreAudiStorage';
import { createEmptyDreVwRow, type DreVwDept, type DreVwRow } from './dreVwStorage';

const VW_DEPARTMENTS = [
  ['novos', 'novos'], ['direta', 'vendaDireta'], ['usados', 'usados'],
  ['pecas', 'pecas'], ['oficina', 'oficina'], ['funilaria', 'funilaria'], ['adm', 'administracao'],
] as const;
const AUDI_DEPARTMENTS = [
  ['novos', 'novos'], ['usados', 'usados'], ['pecas', 'pecas'],
  ['oficina', 'oficina'], ['funilaria', 'funilaria'], ['adm', 'administracao'],
] as const;

const VW_FIELDS: Record<string, keyof DreVwDept> = {
  volumeVendas: 'quant', receitaOperacionalLiquida: 'receitaOperacionalLiquida',
  custoOperacionalReceita: 'custoOperacionalReceita', lucroOperacionalBruto: 'lucroPrejOperacionalBruto',
  outrasReceitasOperacionais: 'outrasReceitasOperacionais', outrasDespesasOperacionais: 'outrasDespesasOperacionais',
  margemContribuicao: 'margemContribuicao', despesasPessoal: 'despPessoal', despesasServTerceiros: 'despServTerceiros',
  despesasOcupacao: 'despOcupacao', despesasFuncionamento: 'despFuncionamento', despesasVendas: 'despVendas',
  lucroOperacionalLiquido: 'lucroPrejOperacionalLiquido', amortizacoesDepreciacoes: 'amortizacoesDepreciacoes',
  outrasReceitasFinanceiras: 'outrasReceitasFinanceiras', despesasFinanceirasNaoOperacional: 'despFinanceirasNaoOperacional',
  despesasNaoOperacionais: 'despesasNaoOperacionais', outrasRendasNaoOperacionais: 'outrasRendasNaoOperacionais',
  lucroAntesImpostos: 'lucroPrejAntesImpostos', provisoesIrpjCs: 'provisoesIrpjCs', participacoes: 'participacoes',
  lucroLiquidoExercicio: 'lucroLiquidoExercicio',
};
const AUDI_FIELDS: Record<string, keyof DreAudiDept> = { ...VW_FIELDS } as Record<string, keyof DreAudiDept>;

function formatSourceValue(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function snapshotDept<T extends DreVwDept | DreAudiDept>(values: Record<string, number> | undefined, fields: Record<string, keyof T>): T {
  const result: Record<string, string> = {};
  for (const [source, target] of Object.entries(fields)) result[target as string] = formatSourceValue(Number(values?.[source] ?? 0));
  return result as T;
}

export async function loadCanonicalVwRow(year: number, month: number, fallback: DreVwRow | null): Promise<DreVwRow> {
  if (!(await getBaseGerencialMes(year, month))) return fallback ?? createEmptyDreVwRow(year, month);
  const snapshots = await Promise.all(VW_DEPARTMENTS.map(async ([, dashboard]) => [dashboard, await loadBaseGerencialDreSnapshot('vw', year, dashboard)] as const));
  const next = fallback ? { ...fallback } : createEmptyDreVwRow(year, month);
  for (const [rowKey, dashboard] of VW_DEPARTMENTS) {
    const snapshot = snapshots.find(([key]) => key === dashboard)?.[1];
    const values = snapshot?.months.find(item => item.month === month)?.values;
    if (values) next[rowKey] = snapshotDept(values, VW_FIELDS);
  }
  return next;
}

export async function loadCanonicalAudiRow(year: number, month: number, fallback: DreAudiRow | null): Promise<DreAudiRow> {
  if (!(await getBaseGerencialMes(year, month))) return fallback ?? createEmptyDreAudiRow(year, month);
  const snapshots = await Promise.all(AUDI_DEPARTMENTS.map(async ([, dashboard]) => [dashboard, await loadBaseGerencialDreSnapshot('audi', year, dashboard)] as const));
  const next = fallback ? { ...fallback } : createEmptyDreAudiRow(year, month);
  for (const [rowKey, dashboard] of AUDI_DEPARTMENTS) {
    const snapshot = snapshots.find(([key]) => key === dashboard)?.[1];
    const values = snapshot?.months.find(item => item.month === month)?.values;
    if (values) next[rowKey] = snapshotDept(values, AUDI_FIELDS);
  }
  return next;
}
