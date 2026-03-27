import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'bonus_trade_in';

export interface BonusTradeInRow {
  id: string;
  dataVenda: string;
  cliente: string;
  chassi: string;
  modelo: string;
  vendedor: string;
  nTitulo: string;
  valorTradeIn: string;
  recebido: string;
  dataRecebimento: string;
}

export async function loadBonusTradeInRows(): Promise<BonusTradeInRow[]> {
  try {
    const data = await kvGet(KEY);
    if (Array.isArray(data)) return data as BonusTradeInRow[];
    return [];
  } catch {
    return [];
  }
}

export async function saveBonusTradeInRows(rows: BonusTradeInRow[]): Promise<boolean> {
  try {
    await kvSet(KEY, rows);
    return true;
  } catch {
    return false;
  }
}

/** Substitui todos os dados (usado na importação por Excel) */
export async function replaceBonusTradeInRows(
  rows: Omit<BonusTradeInRow, 'id'>[],
): Promise<{ total: number }> {
  const withIds: BonusTradeInRow[] = rows.map(r => ({ ...r, id: crypto.randomUUID() }));
  await saveBonusTradeInRows(withIds);
  return { total: withIds.length };
}
