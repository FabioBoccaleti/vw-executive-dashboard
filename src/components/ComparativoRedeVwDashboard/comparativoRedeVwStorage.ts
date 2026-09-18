import { kvBulkGet, kvDelete, kvGet, kvKeys, kvSet } from '@/lib/kvClient';

export interface ComparativoRedeVwSheet {
  name: string;
  rows: unknown[][];
}

export interface ComparativoRedeVwMonthData {
  year: number;
  month: number;
  fileName: string;
  importedAt: string;
  sheets: ComparativoRedeVwSheet[];
}

export interface ComparativoRedeVwConcessionarias {
  regiaoTotal: number;
  regiaoSemSorana: number;
  sateliteTotal: number;
  sateliteSemSorana: number;
}

const keyFor = (year: number, month: number) =>
  `comparativo-rede-vw:${year}:M${String(month).padStart(2, '0')}`;

const concessionariasKeyFor = (year: number, month: number) =>
  `comparativo-rede-vw-concessionarias:${year}:M${String(month).padStart(2, '0')}`;

export async function getLatestComparativoRedeVwMonth() {
  const keys = await kvKeys('comparativo-rede-vw:*');
  const periods = keys
    .map(key => {
      const match = key.match(/^comparativo-rede-vw:(\d{4}):M(\d{2})$/);
      return match ? { key, year: Number(match[1]), month: Number(match[2]) } : null;
    })
    .filter((period): period is { key: string; year: number; month: number } => period !== null)
    .sort((left, right) => right.year - left.year || right.month - left.month);

  const dataByKey = await kvBulkGet<ComparativoRedeVwMonthData>(periods.map(period => period.key));
  for (const period of periods) {
    const data = dataByKey[period.key];
    if (data) return data;
  }
  return null;
}

export async function getComparativoRedeVwMonth(year: number, month: number) {
  return kvGet<ComparativoRedeVwMonthData>(keyFor(year, month));
}

export async function setComparativoRedeVwMonth(data: ComparativoRedeVwMonthData) {
  return kvSet(keyFor(data.year, data.month), data);
}

export async function deleteComparativoRedeVwMonth(year: number, month: number) {
  return kvDelete(keyFor(year, month));
}

export async function getComparativoRedeVwConcessionarias(year: number, month: number) {
  return kvGet<ComparativoRedeVwConcessionarias>(concessionariasKeyFor(year, month));
}

export async function setComparativoRedeVwConcessionarias(
  year: number,
  month: number,
  data: ComparativoRedeVwConcessionarias,
) {
  return kvSet(concessionariasKeyFor(year, month), data);
}

export async function deleteComparativoRedeVwConcessionarias(year: number, month: number) {
  return kvDelete(concessionariasKeyFor(year, month));
}
