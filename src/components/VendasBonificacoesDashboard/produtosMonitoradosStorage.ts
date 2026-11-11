import { kvGet, kvSet } from '@/lib/kvClient';
import { type VPecasItemRow } from './vPecasItemStorage';
import { saveChunkedByPeriod, loadChunkedByPeriod } from './chunkedKvStorage';

const KEY_CODES = 'produtos_monitorados_codes';
const KEY_ROWS  = 'registro_produtos_monitorados';
const PRODUTOS_PREFIX = 'registro_produtos_monitorados_per_';

function normalizeProdutoRow(item: Record<string, unknown>): VPecasItemRow {
  if (item.data && typeof item.data === 'object') return item as unknown as VPecasItemRow;
  const { id, periodoImport, highlight, annotation, ...fields } = item;
  return {
    id: String(id ?? crypto.randomUUID()),
    periodoImport: periodoImport as string | undefined,
    highlight: highlight as boolean | undefined,
    annotation: annotation as string | undefined,
    data: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v ?? '')])),
  } as VPecasItemRow;
}

export const DEFAULT_MONITORED_CODES = [
  '6EA096301A',
  'EQ80021',
  '6EA096309',
  'G001780M3',
  'STPST0912',
];

// ─── Códigos monitorados ──────────────────────────────────────────────────────

export async function loadProdutosMonitoradosCodes(): Promise<string[]> {
  try {
    const data = await kvGet(KEY_CODES);
    if (Array.isArray(data) && data.every(d => typeof d === 'string')) return data as string[];
    // Primeiro acesso: persiste os padrões
    await kvSet(KEY_CODES, DEFAULT_MONITORED_CODES);
    return DEFAULT_MONITORED_CODES;
  } catch {
    return DEFAULT_MONITORED_CODES;
  }
}

export async function saveProdutosMonitoradosCodes(codes: string[]): Promise<void> {
  await kvSet(KEY_CODES, codes);
}

// ─── Linhas de produtos monitorados ──────────────────────────────────────────

export async function loadProdutosRows(): Promise<VPecasItemRow[]> {
  return loadChunkedByPeriod(PRODUTOS_PREFIX, KEY_ROWS, normalizeProdutoRow);
}

export async function saveProdutosRows(rows: VPecasItemRow[]): Promise<boolean> {
  return saveChunkedByPeriod(PRODUTOS_PREFIX, rows);
}

// ─── Sincronização pós-importação ────────────────────────────────────────────
// Chamada após cada import TXT de Itens de Peças, passando os dados COMPLETOS
// (antes do filtro 100+100). Extrai os itens com códigos monitorados e persiste.
export async function syncProdutosFromImport(
  periodo: string,
  allRows: Omit<VPecasItemRow, 'id'>[],
): Promise<number> {
  const codes = await loadProdutosMonitoradosCodes();
  const codesSet = new Set(codes.map(c => c.trim().toUpperCase()));

  const matching = allRows.filter(r => {
    const pub = (r.data['ITEM_ESTOQUE_PUB'] ?? '').trim().toUpperCase();
    return codesSet.has(pub);
  });

  const existing = await loadProdutosRows();
  const kept = existing.filter(r => r.periodoImport !== periodo);
  const toAdd: VPecasItemRow[] = matching.map(r => ({
    ...r,
    id: crypto.randomUUID(),
    periodoImport: periodo,
  }));
  await saveProdutosRows([...kept, ...toAdd]);
  return toAdd.length;
}
