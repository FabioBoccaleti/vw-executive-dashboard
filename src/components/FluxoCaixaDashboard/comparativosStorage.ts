// Persistência Redis para os balancetes do menu Comparativos
// Cada período (ano+mês) é salvo em uma chave individual.
// Persiste o TEXTO BRUTO (mesma estratégia do balancete principal),
// garantindo imunidade a mudanças de schema e parse sempre atualizado.

import { kvGet, kvSet, kvDelete, kvKeys } from '@/lib/kvClient';
import { extractAccounts } from './balanceteParser';

const KEY_PREFIX = 'fluxo_caixa_comparativo_';

function makeKey(year: number, month: number): string {
  return `${KEY_PREFIX}${year}_${String(month).padStart(2, '0')}`;
}

export interface ComparativoEntry {
  year: number;
  month: number;
  /**
   * Texto bruto do balancete (latin-1, separado por ';') — re-parsed em cada uso.
   * Presente em entradas salvas após a migração para armazenamento de texto bruto.
   */
  rawText?: string;
  /**
   * @deprecated Contas pré-parsadas salvas antes da migração.
   * Mantido somente para retrocompatibilidade com entradas antigas no Redis.
   */
  accounts?: Record<string, any>;
  timestamp?: number;
}

/**
 * Resolve o mapa de contas de um ComparativoEntry,
 * suportando tanto entradas novas (rawText) quanto antigas (accounts).
 */
export function resolveComparativoAccounts(
  entry: ComparativoEntry
): Record<string, any> | null {
  if (entry.rawText) {
    return extractAccounts(entry.rawText);
  }
  if (entry.accounts) {
    return entry.accounts;
  }
  return null;
}

/**
 * Salva o texto bruto de um balancete de um período específico.
 * @param rawText Conteúdo original do arquivo lido em latin-1
 */
export async function saveComparativo(year: number, month: number, rawText: string): Promise<boolean> {
  try {
    const entry: ComparativoEntry = { year, month, rawText, timestamp: Date.now() };
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
