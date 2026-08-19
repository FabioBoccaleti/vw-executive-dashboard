import { kvGet, kvSet, kvKeys } from '@/lib/kvClient';

export interface IEORow {
  conta: string;
  isMain: boolean;
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface IEOTotalRow {
  saldoAnterior: number;
  valDebito: number;
  valCredito: number;
  saldoPeriodo: number;
  saldoAtual: number;
}

export interface IEOSemestreData {
  rows: IEORow[];
  totalRow: IEOTotalRow | null;
  importedAt: string;
  fileName: string;
}

const KEY_PREFIX = 'ieo';

function makeKey(year: number, semestre: number): string {
  return `${KEY_PREFIX}:${year}:S${semestre}`;
}

export async function getIEOSemestre(
  year: number,
  semestre: number,
): Promise<IEOSemestreData | null> {
  return kvGet<IEOSemestreData>(makeKey(year, semestre));
}

export async function setIEOSemestre(
  year: number,
  semestre: number,
  data: IEOSemestreData,
): Promise<void> {
  await kvSet(makeKey(year, semestre), data);
}

export async function deleteIEOSemestre(year: number, semestre: number): Promise<void> {
  await kvSet(makeKey(year, semestre), null);
}

export async function getAllImportedSemestresData(): Promise<IEOSemestreData[]> {
  const keys = await kvKeys(`${KEY_PREFIX}:*`);
  const dataKeys = keys.filter(k => /^ieo:\d{4}:S[12]$/.test(k));
  const results = await Promise.all(dataKeys.map(k => kvGet<IEOSemestreData>(k)));
  return results.filter((d): d is IEOSemestreData => d !== null);
}
