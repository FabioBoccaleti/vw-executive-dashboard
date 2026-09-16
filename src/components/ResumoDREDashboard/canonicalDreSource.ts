import { getBaseGerencialMes } from '@/components/BaseGerencialDashboard/baseGerencialStorage';
import { getDashboardDreLineIds, loadBaseGerencialDreSnapshot } from '@/components/BaseGerencialDashboard/baseGerencialDataProcessor';
import type { DREData, Department } from '@/lib/dataStorage';
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
const snapshotCache = new Map<string, Promise<Awaited<ReturnType<typeof loadBaseGerencialDreSnapshot>>>>();

function loadCachedSnapshot(brand: 'vw' | 'audi', year: number, department: string) {
  const cacheKey = `${brand}:${year}:${department}`;
  const cached = snapshotCache.get(cacheKey);
  if (cached) return cached;
  const request = loadBaseGerencialDreSnapshot(brand, year, department);
  snapshotCache.set(cacheKey, request);
  return request;
}

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
  const snapshots = await Promise.all(VW_DEPARTMENTS.map(async ([, dashboard]) => [dashboard, await loadCachedSnapshot('vw', year, dashboard)] as const));
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
  const snapshots = await Promise.all(AUDI_DEPARTMENTS.map(async ([, dashboard]) => [dashboard, await loadCachedSnapshot('audi', year, dashboard)] as const));
  const next = fallback ? { ...fallback } : createEmptyDreAudiRow(year, month);
  for (const [rowKey, dashboard] of AUDI_DEPARTMENTS) {
    const snapshot = snapshots.find(([key]) => key === dashboard)?.[1];
    const values = snapshot?.months.find(item => item.month === month)?.values;
    if (values) next[rowKey] = snapshotDept(values, AUDI_FIELDS);
  }
  return next;
}

export async function loadCanonicalDreData(
  brand: 'vw' | 'audi',
  year: number,
  department: Department,
  fallback: DREData | null,
): Promise<DREData | null> {
  const snapshot = await loadCachedSnapshot(brand, year, department);
  if (snapshot.months.length === 0) return fallback;

  return getDashboardDreLineIds().map(([label, id]) => {
    const previous = fallback?.find(line => line.id === id || line.label === label);
    const values = Array.from({ length: 12 }, (_, index) => {
      const current = snapshot.months.find(item => item.month === index + 1);
      return current ? Number(current.values[id] ?? 0) : Number(previous?.meses?.[index] ?? previous?.values?.[index] ?? 0);
    });
    return {
      ...(previous ?? {}),
      id,
      label: previous?.label ?? label,
      values,
      meses: values,
      total: values.reduce((sum, value) => sum + value, 0),
    } as DREData[number];
  });
}
