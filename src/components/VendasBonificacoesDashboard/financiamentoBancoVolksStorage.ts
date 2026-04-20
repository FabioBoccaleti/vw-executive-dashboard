import { kvGet, kvSet } from '@/lib/kvClient';

export interface FinanciamentoMesData {
  columns: string[];
  rows: Record<string, unknown>[];
  importedAt: string; // ISO datetime
  fileName: string;
}

function makeKey(year: number, month: number): string {
  return `financiamento_banco_volks:${year}:${String(month).padStart(2, '0')}`;
}

export async function getFinanciamentoMes(
  year: number,
  month: number
): Promise<FinanciamentoMesData | null> {
  return kvGet<FinanciamentoMesData>(makeKey(year, month));
}

export async function setFinanciamentoMes(
  year: number,
  month: number,
  data: FinanciamentoMesData
): Promise<void> {
  await kvSet(makeKey(year, month), data);
}

export async function deleteFinanciamentoMes(
  year: number,
  month: number
): Promise<void> {
  await kvSet(makeKey(year, month), null);
}
