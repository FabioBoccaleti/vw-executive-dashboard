import { kvDelete, kvGet, kvKeys, kvSet } from '@/lib/kvClient';

export type MonitoramentoBVBrand = 'vw' | 'audi';

export interface MonitoramentoBVSheet {
  name: string;
  rows: unknown[][];
}

export interface MonitoramentoBVDayData {
  brand: MonitoramentoBVBrand;
  /** Data base do arquivo no formato ISO 'YYYY-MM-DD'. */
  date: string;
  fileName: string;
  importedAt: string;
  sheets: MonitoramentoBVSheet[];
}

const keyFor = (brand: MonitoramentoBVBrand, date: string) =>
  `monitoramento-custo-financeiro-bv:${brand}:${date}`;

export async function getMonitoramentoBVDay(brand: MonitoramentoBVBrand, date: string) {
  return kvGet<MonitoramentoBVDayData>(keyFor(brand, date));
}

export async function setMonitoramentoBVDay(data: MonitoramentoBVDayData) {
  return kvSet(keyFor(data.brand, data.date), data);
}

export async function deleteMonitoramentoBVDay(brand: MonitoramentoBVBrand, date: string) {
  return kvDelete(keyFor(brand, date));
}

/** Lista as datas (ISO 'YYYY-MM-DD') já importadas para a marca, mais recentes primeiro. */
export async function listMonitoramentoBVDates(brand: MonitoramentoBVBrand): Promise<string[]> {
  const keys = await kvKeys(`monitoramento-custo-financeiro-bv:${brand}:*`);
  return keys
    .map(key => {
      const match = key.match(/:(\d{4}-\d{2}-\d{2})$/);
      return match ? match[1] : null;
    })
    .filter((date): date is string => date !== null)
    .sort((left, right) => (left < right ? 1 : left > right ? -1 : 0));
}
