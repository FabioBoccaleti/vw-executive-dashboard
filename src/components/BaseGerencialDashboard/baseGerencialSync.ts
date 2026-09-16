import type { Department } from '@/lib/dataStorage';
import { clearCache } from '@/lib/dbStorage';
import { getBaseGerencialMes, setBaseGerencialDreCache, type DeptoClassificacao, type Marca } from './baseGerencialStorage';
import { getDashboardDreLineIds, loadBaseGerencialDreSnapshot, type BaseGerencialDreSnapshot } from './baseGerencialDataProcessor';
import { createEmptyDreAudiRow, loadDreAudi, saveDreAudi, type DreAudiDept } from '../ResumoDREDashboard/dreAudiStorage';
import { createEmptyDreVwRow, loadDreVw, saveDreVw, type DreVwDept } from '../ResumoDREDashboard/dreVwStorage';
import { emitBaseGerencialUpdated } from './baseGerencialEvents';

const SYNC_DEPARTMENTS: Array<{ dashboard: Department; storage: DeptoClassificacao | null }> = [
  { dashboard: 'novos', storage: 'veiculos_novos' },
  { dashboard: 'vendaDireta', storage: 'venda_direta' },
  { dashboard: 'usados', storage: 'veiculos_usados' },
  { dashboard: 'pecas', storage: 'pecas' },
  { dashboard: 'oficina', storage: 'oficina' },
  { dashboard: 'funilaria', storage: 'funilaria' },
  { dashboard: 'administracao', storage: 'administracao' },
  { dashboard: 'consolidado', storage: null },
];

const VW_SUMMARY_DEPARTMENTS = [
  ['novos', 'novos'], ['vendaDireta', 'direta'], ['usados', 'usados'],
  ['pecas', 'pecas'], ['oficina', 'oficina'], ['funilaria', 'funilaria'],
  ['administracao', 'adm'],
] as const;

const AUDI_SUMMARY_DEPARTMENTS = [
  ['novos', 'novos'], ['usados', 'usados'], ['pecas', 'pecas'],
  ['oficina', 'oficina'], ['funilaria', 'funilaria'], ['administracao', 'adm'],
] as const;

function buildCacheValues(snapshot: BaseGerencialDreSnapshot): Record<string, number[]> {
  return Object.fromEntries(getDashboardDreLineIds().map(([, id]) => [
    id,
    Array.from({ length: 12 }, (_, index) => snapshot.months.find(month => month.month === index + 1)?.values[id] ?? 0),
  ]));
}

function formatSummaryValue(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deptFromSnapshot(snapshot: BaseGerencialDreSnapshot, month: number): Record<string, string> {
  const values = snapshot.months.find(item => item.month === month)?.values ?? {};
  return Object.fromEntries(getDashboardDreLineIds().map(([, id]) => [id, formatSummaryValue(Number(values[id] ?? 0))]));
}

function applySummaryDept<T extends DreVwDept | DreAudiDept>(target: T, values: Record<string, string>): T {
  const fieldMap: Record<string, string> = {
    volumeVendas: 'quant', receitaOperacionalLiquida: 'receitaOperacionalLiquida',
    custoOperacionalReceita: 'custoOperacionalReceita', lucroOperacionalBruto: 'lucroPrejOperacionalBruto',
    outrasReceitasOperacionais: 'outrasReceitasOperacionais', outrasDespesasOperacionais: 'outrasDespesasOperacionais',
    margemContribuicao: 'margemContribuicao', despesasPessoal: 'despPessoal',
    despesasServTerceiros: 'despServTerceiros', despesasOcupacao: 'despOcupacao',
    despesasFuncionamento: 'despFuncionamento', despesasVendas: 'despVendas',
    lucroOperacionalLiquido: 'lucroPrejOperacionalLiquido', amortizacoesDepreciacoes: 'amortizacoesDepreciacoes',
    outrasReceitasFinanceiras: 'outrasReceitasFinanceiras', despesasFinanceirasNaoOperacional: 'despFinanceirasNaoOperacional',
    despesasNaoOperacionais: 'despesasNaoOperacionais', outrasRendasNaoOperacionais: 'outrasRendasNaoOperacionais',
    lucroAntesImpostos: 'lucroPrejAntesImpostos', provisoesIrpjCs: 'provisoesIrpjCs',
    participacoes: 'participacoes', lucroLiquidoExercicio: 'lucroLiquidoExercicio',
  };
  const next = { ...target };
  for (const [source, destination] of Object.entries(fieldMap)) next[destination] = values[source] ?? '0';
  return next;
}

async function syncSummaryRows(
  marca: Marca,
  year: number,
  snapshots: Map<Department, BaseGerencialDreSnapshot>,
  importedMonths: Set<number>,
): Promise<void> {
  if (marca === 'vw') {
    const rows = await Promise.all(Array.from(importedMonths, month => loadDreVw(year, month)));
    await Promise.all(Array.from(importedMonths, async (month, index) => {
      const row = rows[index] ?? createEmptyDreVwRow(year, month);
      for (const [dashboard, summary] of VW_SUMMARY_DEPARTMENTS) {
        const snapshot = snapshots.get(dashboard as Department);
        if (snapshot) row[summary] = applySummaryDept(row[summary], deptFromSnapshot(snapshot, month));
      }
      await saveDreVw(row);
    }));
    return;
  }

  const rows = await Promise.all(Array.from(importedMonths, month => loadDreAudi(year, month)));
  await Promise.all(Array.from(importedMonths, async (month, index) => {
    const row = rows[index] ?? createEmptyDreAudiRow(year, month);
    for (const [dashboard, summary] of AUDI_SUMMARY_DEPARTMENTS) {
      const snapshot = snapshots.get(dashboard as Department);
      if (snapshot) row[summary] = applySummaryDept(row[summary], deptFromSnapshot(snapshot, month));
    }
    await saveDreAudi(row);
  }));
}

export async function syncBaseGerencialAfterImport(year: number): Promise<void> {
  const importedMonths = new Set<number>();
  for (let month = 1; month <= 12; month += 1) {
    if (await getBaseGerencialMes(year, month)) importedMonths.add(month);
  }
  if (importedMonths.size === 0) return;

  clearCache();
  for (const marca of ['vw', 'audi'] as const) {
    const snapshots = new Map<Department, BaseGerencialDreSnapshot>();
    await Promise.all(SYNC_DEPARTMENTS.map(async ({ dashboard, storage }) => {
      const snapshot = await loadBaseGerencialDreSnapshot(marca, year, dashboard);
      snapshots.set(dashboard, snapshot);
      if (storage !== 'venda_direta' || marca !== 'audi') {
        await setBaseGerencialDreCache(marca, year, storage ?? 'consolidado', buildCacheValues(snapshot));
      }
    }));
    await syncSummaryRows(marca, year, snapshots, importedMonths);
  }

  emitBaseGerencialUpdated(year);
}