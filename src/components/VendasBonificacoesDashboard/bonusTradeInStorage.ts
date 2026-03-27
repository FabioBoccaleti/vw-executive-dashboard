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
