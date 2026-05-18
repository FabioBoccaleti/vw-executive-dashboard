import { kvGet, kvSet } from '@/lib/kvClient';

const KEY_NOVOS  = 'comissoes_status_novos';
const KEY_USADOS = 'comissoes_status_usados';

export interface ComissaoStatusEntry {
  rowId:       string;   // ID do VendasResultadoRow correspondente
  situacao:    string;   // ex: "Pendente", "Pago", etc.
  dataPgto:    string;   // ex: "2026-05-10" ou "10/05/2026"
}

type Tab = 'novos' | 'usados';

const KEY: Record<Tab, string> = {
  novos:  KEY_NOVOS,
  usados: KEY_USADOS,
};

export async function loadComissaoStatus(tab: Tab): Promise<ComissaoStatusEntry[]> {
  try {
    const data = await kvGet(KEY[tab]);
    if (Array.isArray(data)) return data as ComissaoStatusEntry[];
    return [];
  } catch { return []; }
}

export async function saveComissaoStatus(tab: Tab, entries: ComissaoStatusEntry[]): Promise<void> {
  await kvSet(KEY[tab], entries);
}

/** Atualiza ou insere uma entrada pelo rowId */
export async function upsertComissaoStatus(
  tab: Tab,
  rowId: string,
  patch: Partial<Omit<ComissaoStatusEntry, 'rowId'>>,
): Promise<void> {
  const all = await loadComissaoStatus(tab);
  const idx = all.findIndex(e => e.rowId === rowId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch };
  } else {
    all.push({ rowId, situacao: '', dataPgto: '', ...patch });
  }
  await saveComissaoStatus(tab, all);
}
