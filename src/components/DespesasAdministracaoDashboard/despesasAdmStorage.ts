import { kvGet, kvSet } from '@/lib/kvClient';

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
