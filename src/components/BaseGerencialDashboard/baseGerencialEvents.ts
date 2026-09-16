export const BASE_GERENCIAL_UPDATED_EVENT = 'sorana:base-gerencial-updated';
const STORAGE_KEY = 'sorana:base-gerencial-updated';

export function emitBaseGerencialUpdated(year: number): void {
  const detail = { year, updatedAt: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent(BASE_GERENCIAL_UPDATED_EVENT, { detail }));
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // O evento da mesma aba já foi emitido; o storage é apenas o canal entre abas.
  }
}

export function subscribeBaseGerencialUpdated(listener: () => void): () => void {
  const onCustomEvent = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener(BASE_GERENCIAL_UPDATED_EVENT, onCustomEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(BASE_GERENCIAL_UPDATED_EVENT, onCustomEvent);
    window.removeEventListener('storage', onStorage);
  };
}