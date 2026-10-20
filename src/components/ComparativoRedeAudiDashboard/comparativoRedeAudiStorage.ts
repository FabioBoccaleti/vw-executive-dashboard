import { kvBulkGet, kvDelete, kvGet, kvKeys, kvSet } from '@/lib/kvClient';

export interface ComparativoRedeAudiSheet {
  name: string;
  rows: unknown[][];
}

export interface ComparativoRedeAudiMonthData {
  year: number;
  month: number;
  fileName: string;
  importedAt: string;
  sheets: ComparativoRedeAudiSheet[];
}

export interface ComparativoRedeAudiConcessionarias {
  mediaNacionalTotal: number;
  mediaNacionalSemSorana: number;
  porteGTotal: number;
  porteGSemSorana: number;
  regiaoSETotal: number;
  regiaoSESemSorana: number;
  top25Total: number;
  top25SemSorana: number;
}

const keyFor = (year: number, month: number) =>
  `comparativo-rede-audi:${year}:M${String(month).padStart(2, '0')}`;

const concessionariasKeyFor = (year: number, month: number) =>
  `comparativo-rede-audi-concessionarias:${year}:M${String(month).padStart(2, '0')}`;

export async function getLatestComparativoRedeAudiMonth() {
  const keys = await kvKeys('comparativo-rede-audi:*');
  const periods = keys
    .map(key => {
      const match = key.match(/^comparativo-rede-audi:(\d{4}):M(\d{2})$/);
      return match ? { key, year: Number(match[1]), month: Number(match[2]) } : null;
    })
    .filter((period): period is { key: string; year: number; month: number } => period !== null)
    .sort((left, right) => right.year - left.year || right.month - left.month);

  const dataByKey = await kvBulkGet<ComparativoRedeAudiMonthData>(periods.map(period => period.key));
  for (const period of periods) {
    const data = dataByKey[period.key];
    if (data) return data;
  }
  return null;
}

export async function getComparativoRedeAudiMonth(year: number, month: number) {
  return kvGet<ComparativoRedeAudiMonthData>(keyFor(year, month));
}

export async function setComparativoRedeAudiMonth(data: ComparativoRedeAudiMonthData) {
  return kvSet(keyFor(data.year, data.month), data);
}

export async function deleteComparativoRedeAudiMonth(year: number, month: number) {
  return kvDelete(keyFor(year, month));
}

export async function getComparativoRedeAudiConcessionarias(year: number, month: number) {
  return kvGet<ComparativoRedeAudiConcessionarias>(concessionariasKeyFor(year, month));
}

export async function setComparativoRedeAudiConcessionarias(
  year: number,
  month: number,
  data: ComparativoRedeAudiConcessionarias,
) {
  return kvSet(concessionariasKeyFor(year, month), data);
}

export async function deleteComparativoRedeAudiConcessionarias(year: number, month: number) {
  return kvDelete(concessionariasKeyFor(year, month));
}
