/**
 * Persistência dos dados de Análise Evolutiva de Despesas por marca (VW / Audi).
 * Chaveamento: analise_despesas_{brand}_{YYYY}_{MM}
 * Tipos:       analise_despesas_tipos_{brand}
 */

import { kvGet, kvSet, kvKeys, kvBulkGet } from '@/lib/kvClient';

export type AnaliseBrand = 'vw' | 'audi';

export interface AnaliseDespesasRaw {
  rawText: string;
  fileName?: string;
  timestamp?: number;
}

function getKey(brand: AnaliseBrand, year: number, month: number): string {
  const mm = String(month).padStart(2, '0');
  return `analise_despesas_${brand}_${year}_${mm}`;
}

function getTiposKey(brand: AnaliseBrand): string {
  return `analise_despesas_tipos_${brand}`;
}

/** Salva o texto bruto do balancete para marca/mês/ano. */
export async function saveAnaliseDespesas(
  brand: AnaliseBrand,
  rawText: string,
  fileName: string | undefined,
  year: number,
  month: number,
): Promise<boolean> {
  try {
    const payload: AnaliseDespesasRaw = { rawText, fileName, timestamp: Date.now() };
    return await kvSet(getKey(brand, year, month), payload);
  } catch (err) {
    console.error('Erro ao salvar análise despesas:', err);
    return false;
  }
}

/** Carrega o texto bruto do balancete para marca/mês/ano. */
export async function loadAnaliseDespesasRaw(
  brand: AnaliseBrand,
  year: number,
  month: number,
): Promise<AnaliseDespesasRaw | null> {
  try {
    return await kvGet<AnaliseDespesasRaw>(getKey(brand, year, month));
  } catch (err) {
    console.error('Erro ao carregar análise despesas:', err);
    return null;
  }
}

/** Retorna mapa de quais períodos têm dados: "YYYY_MM" -> true */
export async function loadAnaliseDespesasIndex(
  brand: AnaliseBrand,
): Promise<Record<string, boolean>> {
  try {
    const prefix = `analise_despesas_${brand}_`;
    const allKeys = await kvKeys(`${prefix}*`);
    const index: Record<string, boolean> = {};
    for (const key of allKeys) {
      const suffix = key.replace(prefix, '');
      if (/^\d{4}_\d{2}$/.test(suffix)) {
        index[suffix] = true;
      }
    }
    return index;
  } catch (err) {
    console.error('Erro ao carregar índice análise despesas:', err);
    return {};
  }
}

/** Carrega vários meses de uma vez (bulk). Retorna { month -> rawText }. */
export async function loadMultipleMonthsAnaliseDespesas(
  brand: AnaliseBrand,
  year: number,
  months: number[],
): Promise<Record<number, string>> {
  try {
    const keys = months.map((m) => getKey(brand, year, m));
    const result = await kvBulkGet<AnaliseDespesasRaw>(keys);
    const out: Record<number, string> = {};
    for (let i = 0; i < months.length; i++) {
      const val = result[keys[i]];
      if (val?.rawText) out[months[i]] = val.rawText;
    }
    return out;
  } catch (err) {
    console.error('Erro ao carregar múltiplos meses análise despesas:', err);
    return {};
  }
}

/** Carrega o mapa de tipos de despesas para a marca. */
export async function loadAnaliseDespesasTipos(
  brand: AnaliseBrand,
): Promise<Record<string, string>> {
  try {
    return (await kvGet<Record<string, string>>(getTiposKey(brand))) ?? {};
  } catch (err) {
    return {};
  }
}

/** Salva o mapa de tipos de despesas para a marca. */
export async function saveAnaliseDespesasTipos(
  brand: AnaliseBrand,
  tipos: Record<string, string>,
): Promise<void> {
  try {
    await kvSet(getTiposKey(brand), tipos);
  } catch (err) {
    console.error('Erro ao salvar tipos análise despesas:', err);
  }
}
