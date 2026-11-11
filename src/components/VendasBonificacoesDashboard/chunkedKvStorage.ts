import { kvGet, kvSet, kvKeys, kvDelete } from '@/lib/kvClient';

/**
 * Armazenamento no KV fragmentado por período + chunks.
 *
 * Mantém cada valor bem abaixo do limite de tamanho de requisição do
 * Upstash/Vercel (~1-4,5 MB), evitando falhas silenciosas de gravação quando
 * um único mês/ano acumula muitos registros. Usado por todos os storages de
 * V.Peças (vendas e devoluções) e produtos monitorados.
 *
 * Convenção de chaves:
 *   `${prefix}${periodo}_meta`  -> { chunks: number }
 *   `${prefix}${periodo}_c${i}` -> T[]
 */

const CHUNK_SIZE = 200;

interface Periodized { periodoImport?: string; }

const metaKey  = (prefix: string, p: string) => `${prefix}${p}_meta`;
const chunkKey = (prefix: string, p: string, i: number) => `${prefix}${p}_c${i}`;

async function savePeriodChunked<T>(prefix: string, periodo: string, rows: T[]): Promise<boolean> {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) chunks.push(rows.slice(i, i + CHUNK_SIZE));
  const results = await Promise.all([
    kvSet(metaKey(prefix, periodo), { chunks: chunks.length }),
    ...chunks.map((chunk, i) => kvSet(chunkKey(prefix, periodo, i), chunk)),
  ]);
  return results.every(Boolean);
}

async function loadPeriodChunked<T>(prefix: string, periodo: string): Promise<T[]> {
  const meta = await kvGet<{ chunks: number }>(metaKey(prefix, periodo));
  if (!meta || !meta.chunks) return [];
  const keys = Array.from({ length: meta.chunks }, (_, i) => chunkKey(prefix, periodo, i));
  const chunks = await Promise.all(keys.map(k => kvGet<T[]>(k)));
  return chunks.filter((c): c is T[] => Array.isArray(c)).flat();
}

export async function getChunkedPeriods(prefix: string): Promise<string[]> {
  try {
    const keys = await kvKeys(`${prefix}*_meta`);
    return keys.map(k => k.replace(prefix, '').replace('_meta', ''));
  } catch { return []; }
}

/** Salva o array completo, agrupando por período e limpando os períodos ausentes. */
export async function saveChunkedByPeriod<T extends Periodized>(prefix: string, rows: T[]): Promise<boolean> {
  try {
    const byPeriod = new Map<string, T[]>();
    for (const r of rows) {
      const p = r.periodoImport ?? 'sem-periodo';
      byPeriod.set(p, [...(byPeriod.get(p) ?? []), r]);
    }
    const saveOps = [...byPeriod.entries()].map(([p, rs]) => savePeriodChunked(prefix, p, rs));
    const existing = await getChunkedPeriods(prefix);
    const present = new Set(byPeriod.keys());
    const clearOps = existing
      .filter(p => !present.has(p))
      .map(p => savePeriodChunked(prefix, p, []));
    const results = await Promise.all([...saveOps, ...clearOps]);
    return results.every(Boolean);
  } catch {
    return false;
  }
}

/**
 * Carrega todos os períodos. Se o formato novo ainda não existir, lê a chave
 * única legada, migra-a para o formato fragmentado e remove a chave antiga
 * (apenas se a migração persistiu com sucesso).
 */
export async function loadChunkedByPeriod<T extends Periodized>(
  prefix: string,
  legacyKey: string,
  normalize: (item: Record<string, unknown>) => T,
): Promise<T[]> {
  try {
    const periods = await getChunkedPeriods(prefix);
    if (periods.length > 0) {
      const arrays = await Promise.all(periods.map(p => loadPeriodChunked<T>(prefix, p)));
      return arrays.flat();
    }
    const legacy = await kvGet(legacyKey);
    if (!Array.isArray(legacy)) return [];
    const rows = (legacy as Record<string, unknown>[]).map(normalize);
    if (rows.length > 0) {
      const migrated = await saveChunkedByPeriod(prefix, rows);
      if (migrated) { try { await kvDelete(legacyKey); } catch { /* mantém legado */ } }
    }
    return rows;
  } catch {
    return [];
  }
}

/** Limpa todos os períodos fragmentados e a chave legada (usado em "substituir tudo"). */
export async function clearChunked(prefix: string, legacyKey: string): Promise<void> {
  const periods = await getChunkedPeriods(prefix);
  await Promise.all(periods.map(p => savePeriodChunked(prefix, p, [])));
  try { await kvDelete(legacyKey); } catch { /* ignore */ }
}
