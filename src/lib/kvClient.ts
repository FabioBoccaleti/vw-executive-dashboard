/**
 * Cliente de API para comunicação com o Redis via Vercel Functions.
 *
 * Em desenvolvimento (import.meta.env.DEV), usa IndexedDB para evitar
 * qualquer request para a Vercel/Redis (sem custos de deploy) e para
 * contornar o limite de 5-10 MB do localStorage.
 * Em produção usa as Vercel Functions normalmente.
 */

const IS_DEV = import.meta.env.DEV;

// ─── Modo dev: IndexedDB ───────────────────────────────────────────────────
const IDB_NAME  = '__kvStore__';
const IDB_STORE = 'kv';

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbKeys(pattern: string): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAllKeys();
    req.onsuccess = () => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      resolve((req.result as string[]).filter(k => regex.test(k)));
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── URL base (produção) ───────────────────────────────────────────────────
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

// ─── API pública ───────────────────────────────────────────────────────────

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  if (IS_DEV) return idbGet<T>(key);
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/get?key=${encodeURIComponent(key)}`);
    if (!response.ok) { console.error(`KV GET error: ${response.status}`); return null; }
    const data = await response.json();
    return data.value as T | null;
  } catch (error) { console.error('KV GET error:', error); return null; }
}

export async function kvSet(key: string, value: unknown): Promise<boolean> {
  if (IS_DEV) { await idbSet(key, value); return true; }
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!response.ok) { console.error(`KV SET error: ${response.status}`); return false; }
    return true;
  } catch (error) { console.error('KV SET error:', error); return false; }
}

export async function kvDelete(key: string): Promise<boolean> {
  if (IS_DEV) { await idbDelete(key); return true; }
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/delete?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    if (!response.ok) { console.error(`KV DELETE error: ${response.status}`); return false; }
    return true;
  } catch (error) { console.error('KV DELETE error:', error); return false; }
}

export async function kvKeys(pattern: string = '*'): Promise<string[]> {
  if (IS_DEV) return idbKeys(pattern);
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/keys?pattern=${encodeURIComponent(pattern)}`);
    if (!response.ok) { console.error(`KV KEYS error: ${response.status}`); return []; }
    const data = await response.json();
    return data.keys || [];
  } catch (error) { console.error('KV KEYS error:', error); return []; }
}

export async function kvBulkSet(items: Array<{ key: string; value: unknown }>): Promise<boolean> {
  if (IS_DEV) {
    await Promise.all(items.map(({ key, value }) => idbSet(key, value)));
    return true;
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/bulk-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!response.ok) { console.error(`KV BULK SET error: ${response.status}`); return false; }
    return true;
  } catch (error) { console.error('KV BULK SET error:', error); return false; }
}

export async function kvBulkGet<T = unknown>(keys: string[]): Promise<Record<string, T | null>> {
  if (IS_DEV) {
    const result: Record<string, T | null> = {};
    await Promise.all(keys.map(async k => { result[k] = await idbGet<T>(k); }));
    return result;
  }
  try {
    if (keys.length === 0) return {};
    const response = await fetch(`${getApiBaseUrl()}/api/kv/bulk-get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    if (!response.ok) { console.error(`KV BULK GET error: ${response.status}`); return {}; }
    const data = await response.json();
    return data.data || {};
  } catch (error) { console.error('KV BULK GET error:', error); return {}; }
}

export async function kvClearPattern(pattern: string): Promise<boolean> {
  if (IS_DEV) {
    const keys = await idbKeys(pattern);
    await Promise.all(keys.map(k => idbDelete(k)));
    return true;
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/clear-pattern?pattern=${encodeURIComponent(pattern)}`, {
      method: 'DELETE',
    });
    if (!response.ok) { console.error(`KV CLEAR PATTERN error: ${response.status}`); return false; }
    return true;
  } catch (error) { console.error('KV CLEAR PATTERN error:', error); return false; }
}

export async function kvHasData(pattern: string = 'vw_*'): Promise<boolean> {
  const keys = await kvKeys(pattern);
  return keys.length > 0;
}
