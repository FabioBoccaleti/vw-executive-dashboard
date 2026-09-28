import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'blindagem_declaracao_prestadores';

export interface PrestadorServico {
  id: string;
  nome: string;
  valor: string;
}

export async function loadPrestadores(): Promise<PrestadorServico[]> {
  try {
    const data = await kvGet<PrestadorServico[]>(KEY);
    if (Array.isArray(data)) return data;
  } catch { /* fallback */ }
  return [];
}

export async function savePrestadores(rows: PrestadorServico[]): Promise<void> {
  try { await kvSet(KEY, rows); } catch { /* ignore */ }
}
