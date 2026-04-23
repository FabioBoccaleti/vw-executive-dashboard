import { kvGet, kvSet, kvKeys } from '@/lib/kvClient';

const KEY_TAXA_EP          = 'registro_taxa_epecos';
const KEY_TAXA_EP_META     = (p: string) => `registro_taxa_epecos_per_${p}_meta`;
const KEY_TAXA_EP_CHUNK    = (p: string, i: number) => `registro_taxa_epecos_per_${p}_c${i}`;
const CHUNK_SIZE           = 200;

// ─── Tipo principal ───────────────────────────────────────────────────────────
export interface TaxaEPecasRow {
  id: string;
  periodoImport?: string; // "YYYY-MM"
  highlight?: boolean;
  annotation?: string;
  data: Record<string, string>;
}

// ─── Chunked period storage ───────────────────────────────────────────────────
async function savePeriodRows(periodo: string, rows: TaxaEPecasRow[]): Promise<void> {
  const chunks: TaxaEPecasRow[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) chunks.push(rows.slice(i, i + CHUNK_SIZE));
  await Promise.all([
    kvSet(KEY_TAXA_EP_META(periodo), { chunks: chunks.length }),
    ...chunks.map((chunk, i) => kvSet(KEY_TAXA_EP_CHUNK(periodo, i), chunk)),
  ]);
}

async function loadPeriodRows(periodo: string): Promise<TaxaEPecasRow[]> {
  const meta = await kvGet<{ chunks: number }>(KEY_TAXA_EP_META(periodo));
  if (!meta || !meta.chunks) return [];
  const keys = Array.from({ length: meta.chunks }, (_, i) => KEY_TAXA_EP_CHUNK(periodo, i));
  const chunks = await Promise.all(keys.map(k => kvGet<TaxaEPecasRow[]>(k)));
  return chunks.filter((c): c is TaxaEPecasRow[] => Array.isArray(c)).flat();
}

async function getAllPeriods(): Promise<string[]> {
  try {
    const keys = await kvKeys('registro_taxa_epecos_per_*_meta');
    return keys.map(k => k.replace('registro_taxa_epecos_per_', '').replace('_meta', ''));
  } catch { return []; }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
export async function loadTaxaEPecasRows(): Promise<TaxaEPecasRow[]> {
  try {
    const periods = await getAllPeriods();
    if (periods.length > 0) {
      const arrays = await Promise.all(periods.map(loadPeriodRows));
      return arrays.flat();
    }
    const rawData = await kvGet(KEY_TAXA_EP);
    if (!Array.isArray(rawData)) return [];
    return (rawData as Record<string, unknown>[]).map(item => {
      if (item.data && typeof item.data === 'object') return item as unknown as TaxaEPecasRow;
      const { id, periodoImport, highlight, annotation, ...fields } = item as Record<string, unknown>;
      return {
        id: String(id ?? crypto.randomUUID()),
        periodoImport: periodoImport as string | undefined,
        highlight: highlight as boolean | undefined,
        annotation: annotation as string | undefined,
        data: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v ?? '')])),
      } as TaxaEPecasRow;
    });
  } catch {
    return [];
  }
}

export async function saveTaxaEPecasRows(rows: TaxaEPecasRow[]): Promise<boolean> {
  try {
    const byPeriod = new Map<string, TaxaEPecasRow[]>();
    for (const r of rows) {
      const p = r.periodoImport ?? 'sem-periodo';
      byPeriod.set(p, [...(byPeriod.get(p) ?? []), r]);
    }
    const saveOps = [...byPeriod.entries()].map(([p, rs]) => savePeriodRows(p, rs));
    const existingPeriods = await getAllPeriods();
    const presentPeriods = new Set(byPeriod.keys());
    const clearOps = existingPeriods
      .filter(p => !presentPeriods.has(p))
      .map(p => savePeriodRows(p, []));
    await Promise.all([...saveOps, ...clearOps]);
    return true;
  } catch {
    return false;
  }
}

export async function appendTaxaEPecasRows(
  newRows: Omit<TaxaEPecasRow, 'id'>[],
): Promise<{ added: number }> {
  const byPeriod = new Map<string, Omit<TaxaEPecasRow, 'id'>[]>();
  for (const r of newRows) {
    const p = r.periodoImport ?? 'sem-periodo';
    byPeriod.set(p, [...(byPeriod.get(p) ?? []), r]);
  }
  await Promise.all([...byPeriod.entries()].map(([periodo, rs]) => {
    const withIds = rs.map(r => ({ ...r, id: crypto.randomUUID() }));
    return savePeriodRows(periodo, withIds);
  }));
  return { added: newRows.length };
}

export async function replaceTaxaEPecasRows(
  newRows: Omit<TaxaEPecasRow, 'id'>[],
): Promise<{ total: number }> {
  const withIds: TaxaEPecasRow[] = newRows.map(r => ({ ...r, id: crypto.randomUUID() }));
  await saveTaxaEPecasRows(withIds);
  return { total: withIds.length };
}

// ─── Parser TXT genérico ──────────────────────────────────────────────────────
export function parseTaxaEPecasTxt(text: string): Omit<TaxaEPecasRow, 'id'>[] {
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const raw of rawLines) {
    if (!raw.trim()) continue;
    // Junta linhas de continuação (que não começam com letra/dígito)
    if (lines.length === 0 || /^[A-Za-z\d]/.test(raw)) {
      lines.push(raw);
    } else {
      lines[lines.length - 1] += raw;
    }
  }

  if (lines.length < 2) return [];

  // Linha 0 = cabeçalho
  const headers = lines[0].split(';').map(h => h.trim()).filter(h => h.length > 0);
  if (headers.length === 0) return [];

  const result: Omit<TaxaEPecasRow, 'id'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = line.split(';');
    const rowData: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowData[h] = (fields[idx] ?? '').trim();
    });

    result.push({ data: rowData });
  }

  return result;
}
