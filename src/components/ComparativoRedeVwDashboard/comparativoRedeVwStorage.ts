import { kvDelete, kvGet, kvSet } from '@/lib/kvClient';

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
