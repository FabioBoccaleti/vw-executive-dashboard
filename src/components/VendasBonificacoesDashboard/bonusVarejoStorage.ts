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

function extractPeriod(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [, mm, yyyy] = dateStr.split('/');
    return { year: Number(yyyy), month: Number(mm) };
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [yyyy, mm] = dateStr.split('-');
    return { year: Number(yyyy), month: Number(mm) };
  }
  return null;
}

/**
 * Mescla novos dados preservando linhas de outros períodos.
 * Remove apenas as linhas do mesmo ano/mês dos dados importados.
 */
export async function mergeBonusVarejoByPeriod(
  newRows: Omit<BonusVarejoRow, 'id' | 'highlight' | 'annotation'>[],
): Promise<{ total: number; period: string | null }> {
  if (newRows.length === 0) return { total: 0, period: null };

  // Detecta período predominante
  const counts = new Map<string, { year: number; month: number; count: number }>();
  for (const r of newRows) {
    const d = extractPeriod(r.data);
    if (!d) continue;
    const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
    const cur = counts.get(key);
    counts.set(key, cur ? { ...cur, count: cur.count + 1 } : { year: d.year, month: d.month, count: 1 });
  }
  const dominant = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0];

  // Preserva linhas de outros períodos (descarta linhas completamente vazias)
  const existing = await loadBonusVarejoRows();
  const kept = dominant
    ? existing.filter(r => {
        if (!r.chassi && !r.data && !r.notaFiscal && !r.valor) return false; // placeholder vazio
        const d = extractPeriod(r.data);
        if (!d) return true;
        return !(d.year === dominant.year && d.month === dominant.month);
      })
    : existing.filter(r => !(!r.chassi && !r.data && !r.notaFiscal && !r.valor));

  const toAdd: BonusVarejoRow[] = newRows.map(r => ({
    ...r,
    id: crypto.randomUUID(),
    highlight: false,
    annotation: '',
  }));

  await saveBonusVarejoRows([...kept, ...toAdd]);
  return {
    total: toAdd.length,
    period: dominant ? `${dominant.year}-${String(dominant.month).padStart(2, '0')}` : null,
  };
}
