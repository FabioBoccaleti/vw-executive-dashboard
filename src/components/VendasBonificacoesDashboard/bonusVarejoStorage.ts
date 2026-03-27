import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'bonus_varejo';

export interface BonusVarejoRow {
  id: string;
  chassi: string;
  data: string;
  notaFiscal: string;
  valor: string;
  vendedor: string;
}

export async function loadBonusVarejoRows(): Promise<BonusVarejoRow[]> {
  try {
    const data = await kvGet(KEY);
    if (Array.isArray(data)) return data as BonusVarejoRow[];
    return [];
  } catch {
    return [];
  }
}

export async function saveBonusVarejoRows(rows: BonusVarejoRow[]): Promise<boolean> {
  try {
    await kvSet(KEY, rows);
    return true;
  } catch {
    return false;
  }
}

/** Substitui todos os dados (usado na importação por Excel) */
export async function replaceBonusVarejoRows(
  rows: Omit<BonusVarejoRow, 'id'>[],
): Promise<{ total: number }> {
  const withIds: BonusVarejoRow[] = rows.map(r => ({ ...r, id: crypto.randomUUID() }));
  await saveBonusVarejoRows(withIds);
  return { total: withIds.length };
}
