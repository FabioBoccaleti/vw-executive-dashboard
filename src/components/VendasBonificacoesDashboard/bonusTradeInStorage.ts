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
  highlight: boolean;
  annotation: string;
}

export function createEmptyBonusTradeInRow(): BonusTradeInRow {
  return {
    id: crypto.randomUUID(),
    dataVenda: '',
    cliente: '',
    chassi: '',
    modelo: '',
    vendedor: '',
    nTitulo: '',
    valorTradeIn: '',
    recebido: '',
    dataRecebimento: '',
    highlight: false,
    annotation: '',
  };
}

function normalize(r: Record<string, unknown> & { id: string }): BonusTradeInRow {
  return {
    id: r.id,
    dataVenda:       String(r.dataVenda       ?? ''),
    cliente:         String(r.cliente         ?? ''),
    chassi:          String(r.chassi          ?? ''),
    modelo:          String(r.modelo          ?? ''),
    vendedor:        String(r.vendedor        ?? ''),
    nTitulo:         String(r.nTitulo         ?? ''),
    valorTradeIn:    String(r.valorTradeIn    ?? ''),
    recebido:        String(r.recebido        ?? ''),
    dataRecebimento: String(r.dataRecebimento ?? ''),
    highlight:       Boolean(r.highlight      ?? false),
    annotation:      String(r.annotation      ?? ''),
  };
}

export async function loadBonusTradeInRows(): Promise<BonusTradeInRow[]> {
  try {
    const data = await kvGet(KEY);
    if (Array.isArray(data)) return (data as (Record<string, unknown> & { id: string })[]).map(normalize);
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
  rows: Omit<BonusTradeInRow, 'id' | 'highlight' | 'annotation'>[],
): Promise<{ total: number }> {
  const withIds: BonusTradeInRow[] = rows.map(r => ({
    ...r,
    id: crypto.randomUUID(),
    highlight: false,
    annotation: '',
  }));
  await saveBonusTradeInRows(withIds);
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
export async function mergeBonusTradeInByPeriod(
  newRows: Omit<BonusTradeInRow, 'id' | 'highlight' | 'annotation'>[],
): Promise<{ total: number; period: string | null }> {
  if (newRows.length === 0) return { total: 0, period: null };

  // Detecta período predominante (usa dataVenda)
  const counts = new Map<string, { year: number; month: number; count: number }>();
  for (const r of newRows) {
    const d = extractPeriod(r.dataVenda);
    if (!d) continue;
    const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
    const cur = counts.get(key);
    counts.set(key, cur ? { ...cur, count: cur.count + 1 } : { year: d.year, month: d.month, count: 1 });
  }
  const dominant = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0];

  // Preserva linhas de outros períodos (descarta linhas completamente vazias)
  const existing = await loadBonusTradeInRows();
  const kept = dominant
    ? existing.filter(r => {
        if (!r.chassi && !r.dataVenda && !r.cliente && !r.valorTradeIn) return false; // placeholder vazio
        const d = extractPeriod(r.dataVenda);
        if (!d) return true;
        return !(d.year === dominant.year && d.month === dominant.month);
      })
    : existing.filter(r => !(!r.chassi && !r.dataVenda && !r.cliente && !r.valorTradeIn));

  const toAdd: BonusTradeInRow[] = newRows.map(r => ({
    ...r,
    id: crypto.randomUUID(),
    highlight: false,
    annotation: '',
  }));

  await saveBonusTradeInRows([...kept, ...toAdd]);
  return {
    total: toAdd.length,
    period: dominant ? `${dominant.year}-${String(dominant.month).padStart(2, '0')}` : null,
  };
}
