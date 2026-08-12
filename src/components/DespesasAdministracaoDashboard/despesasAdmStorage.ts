import { kvGet, kvSet, kvKeys } from '@/lib/kvClient';

export type TipoClassificacao =
  | 'pessoal'
  | 'servicos_terceiros'
  | 'ocupacao'
  | 'funcionamento'
  | 'vendas'
  | 'amort_deprec'
  | 'financeiras'
  | 'outras_operacionais';

export const TIPO_LABELS: Record<TipoClassificacao, string> = {
  pessoal:             'Despesas c/ Pessoal',
  servicos_terceiros:  'Despesas c/ Serviços de Terceiros',
  ocupacao:            'Despesas c/ Ocupação',
  funcionamento:       'Despesas c/ Funcionamento',
  vendas:              'Despesas c/ Vendas',
  amort_deprec:        'Amortizações e Depreciações',
  financeiras:         'Despesas Financeiras',
  outras_operacionais: 'Outras Despesas Operacionais',
};

export const TIPOS_ORDENADOS: TipoClassificacao[] = [
  'pessoal', 'servicos_terceiros', 'ocupacao', 'funcionamento',
  'vendas', 'amort_deprec', 'financeiras', 'outras_operacionais',
];

export interface DespesaAdmRow {
  conta: string;
  isMain: boolean;
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface DespesasAdmTotalRow {
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface DespesasAdmMesData {
  rows: DespesaAdmRow[];
  totalRow: DespesasAdmTotalRow | null;
  importedAt: string;
  fileName: string;
}

function makeKey(year: number, month: number): string {
  return `despesas_adm:${year}:${String(month).padStart(2, '0')}`;
}

export async function getDespesasAdmMes(
  year: number,
  month: number,
): Promise<DespesasAdmMesData | null> {
  return kvGet<DespesasAdmMesData>(makeKey(year, month));
}

export async function setDespesasAdmMes(
  year: number,
  month: number,
  data: DespesasAdmMesData,
): Promise<void> {
  await kvSet(makeKey(year, month), data);
}

export async function deleteDespesasAdmMes(year: number, month: number): Promise<void> {
  await kvSet(makeKey(year, month), null);
}

const CLASSIFICACOES_KEY = 'despesas_adm:classificacoes';

export async function loadClassificacoes(): Promise<Record<string, TipoClassificacao>> {
  return (await kvGet<Record<string, TipoClassificacao>>(CLASSIFICACOES_KEY)) ?? {};
}

export async function saveClassificacoes(data: Record<string, TipoClassificacao>): Promise<void> {
  await kvSet(CLASSIFICACOES_KEY, data);
}

export async function getAllImportedMonthsData(): Promise<DespesasAdmMesData[]> {
  const keys = await kvKeys('despesas_adm:*');
  const monthKeys = keys.filter(k => /^despesas_adm:\d{4}:\d{2}$/.test(k));
  if (monthKeys.length === 0) return [];
  const results = await Promise.all(monthKeys.map(k => kvGet<DespesasAdmMesData>(k)));
  return results.filter((d): d is DespesasAdmMesData => d !== null);
}

function makeObsKey(prefix: string, year: number, month: number): string {
  return `despesas_adm:obs_${prefix}:${year}:${String(month).padStart(2, '0')}`;
}

export async function loadObsVw(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('vw', year, month))) ?? {};
}

export async function saveObsVw(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('vw', year, month), obs);
}

export async function loadObsAudi(year: number, month: number): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(makeObsKey('audi', year, month))) ?? {};
}

export async function saveObsAudi(year: number, month: number, obs: Record<string, string>): Promise<void> {
  await kvSet(makeObsKey('audi', year, month), obs);
}
