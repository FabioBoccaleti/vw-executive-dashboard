import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'bonus_varejo';

export interface BonusVarejoRow {
  id: string;
  chassi: string;
  data: string;
  notaFiscal: string;
  valor: string;
  vendedor: string;
  highlight: boolean;
  annotation: string;
}

export function createEmptyBonusVarejoRow(): BonusVarejoRow {
  return {
    id: crypto.randomUUID(),
    chassi: '',
    data: '',
    notaFiscal: '',
    valor: '',
    vendedor: '',
    highlight: false,
    annotation: '',
  };
}

function normalize(r: Record<string, unknown> & { id: string }): BonusVarejoRow {
  return {
    id: r.id,
    chassi:     String(r.chassi     ?? ''),
    data:       String(r.data       ?? ''),
    notaFiscal: String(r.notaFiscal ?? ''),
    valor:      String(r.valor      ?? ''),
    vendedor:   String(r.vendedor   ?? ''),
    highlight:  Boolean(r.highlight ?? false),
    annotation: String(r.annotation ?? ''),
  };
}

export async function loadBonusVarejoRows(): Promise<BonusVarejoRow[]> {
  try {
    const data = await kvGet(KEY);
    if (Array.isArray(data)) return (data as (Record<string, unknown> & { id: string })[]).map(normalize);
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
  rows: Omit<BonusVarejoRow, 'id' | 'highlight' | 'annotation'>[],
): Promise<{ total: number }> {
  const withIds: BonusVarejoRow[] = rows.map(r => ({
    ...r,
    id: crypto.randomUUID(),
    highlight: false,
    annotation: '',
  }));
  await saveBonusVarejoRows(withIds);
  return { total: withIds.length };
}
