// Persistência Redis para os balancetes do menu Comparativos
// Cada período (ano+mês) é salvo em uma chave individual.

import { kvGet, kvSet, kvDelete, kvKeys } from '@/lib/kvClient';

const KEY_PREFIX = 'fluxo_caixa_comparativo_';

function makeKey(year: number, month: number): string {
  return `${KEY_PREFIX}${year}_${String(month).padStart(2, '0')}`;
}

export interface ComparativoEntry {
  year: number;
  month: number;
  accounts: Record<string, any>;
  timestamp?: number;
}

/** Salva um balancete de um período específico */
export async function saveComparativo(year: number, month: number, data: Record<string, any>): Promise<boolean> {
  try {
    const entry: ComparativoEntry = { year, month, accounts: data, timestamp: Date.now() };
    return await kvSet(makeKey(year, month), entry);
  } catch (err) {
    console.error('Erro ao salvar comparativo:', err);
    return false;
  }
}

/** Carrega o balancete de um período específico */
export async function loadComparativo(year: number, month: number): Promise<ComparativoEntry | null> {
  try {
    return await kvGet<ComparativoEntry>(makeKey(year, month));
  } catch (err) {
    console.error('Erro ao carregar comparativo:', err);
    return null;
  }
}

/** Remove o balancete de um período específico */
export async function deleteComparativo(year: number, month: number): Promise<boolean> {
  try {
    return await kvDelete(makeKey(year, month));
  } catch (err) {
    console.error('Erro ao deletar comparativo:', err);
    return false;
  }
}

/** Retorna um mapa de quais períodos têm dados carregados: "YYYY_MM" -> true */
export async function loadComparativosIndex(): Promise<Record<string, boolean>> {
  try {
    const allKeys = await kvKeys(`${KEY_PREFIX}*`);
    const index: Record<string, boolean> = {};
    for (const key of allKeys) {
      const suffix = key.replace(KEY_PREFIX, ''); // "2024_01"
      index[suffix] = true;
    }
    return index;
  } catch (err) {
    console.error('Erro ao carregar índice de comparativos:', err);
    return {};
  }
}
