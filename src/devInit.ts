/**
 * Inicialização de desenvolvimento — roda apenas em `npm run dev`.
 * Popula o IndexedDB com o snapshot do Redis na primeira abertura,
 * garantindo paridade com produção sem nenhum custo de request.
 *
 * Para re-sincronizar: no console do browser execute:
 *   indexedDB.deleteDatabase('__kvStore__')
 * e recarregue a página.
 */

import { kvGet, kvBulkSet } from './lib/kvClient';
// @ts-expect-error — arquivo gerado pelo script scripts/dumpRedisToJson.mjs
import snapshot from '../scripts/redis-snapshot.json';

const SYNC_KEY = '__kv_synced__';

async function initDevData() {
  const alreadySynced = await kvGet<string>(SYNC_KEY);
  if (alreadySynced) return;

  const entries = Object.entries(snapshot as Record<string, unknown>)
    .filter(([key]) => !key.startsWith('auth_session') && !key.startsWith('auth_user'))
    .map(([key, value]) => ({ key, value }));

  await kvBulkSet(entries);
  await kvBulkSet([{ key: SYNC_KEY, value: new Date().toISOString() }]);

  // Limpa localStorage antigo (__kv__*) para liberar espaço
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('__kv__') || k === '__kv_synced__') toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));

  console.info(`✅ [DEV] Snapshot Redis → IndexedDB: ${entries.length} chaves carregadas. Recarregando...`);
  window.location.reload();
}

initDevData();
