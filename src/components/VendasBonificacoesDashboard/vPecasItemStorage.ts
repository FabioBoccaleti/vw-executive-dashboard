import { kvGet, kvSet } from '@/lib/kvClient';
import * as XLSX from 'xlsx';

const KEY_VPECAS_ITEM = 'registro_vpecas_item';
const KEY_VPECAS_ITEM_DEVOLUCAO = 'registro_vpecas_item_devolucao';

// Todos os cabecalhos do arquivo de itens (na ordem original)
export const ITEM_HEADERS = [
  'EMPRESA', 'REVENDA', 'ITEM_ESTOQUE', 'VAL_VENDA', 'VAL_RENTABILIDADE',
  'PER_RENTABILIDADE', 'VAL_IMPOSTOS', 'ITEM_ESTOQUE_PUB', 'DES_ITEM_ESTOQUE',
  'CLASS_ABC', 'CLASS_XYZ', 'QUANTIDADE', 'VAL_DESCONTO', 'VAL_DEVERIA',
  'VAL_UNITARIO', 'VAL_FRETE_PF', 'VAL_FRETE', 'CUSTO_REPOS', 'CUSTO_MEDIO',
  'PRECO_PUBLICO_ATUAL', 'NOME_GRUPO', 'GRUPO', 'NOME_CATEGORIA', 'CATEGORIA',
  'NOME_SUB_CATEGORIA', 'SUB_CATEGORIA', 'PCT_DESCONTO', 'GRUPO_DESCONTO',
  'CLIENTE', 'NOME_CLIENTE', 'CATEGORIA_CLIENTE', 'CGCCPF', 'NOME_CATEGORIA_CLIENTE',
  'VENDEDOR', 'NOME_VENDEDOR', 'NOME_DEPARTAMENTO', 'DEPARTAMENTO',
  'DTA_ENTRADA_SAIDA', 'MODALIDADE', 'TIPO_TRANSACAO', 'TIPO',
  'NUMERO_NOTA_FISCAL', 'SERIE_NOTA_FISCAL', 'NOME_USUARIO', 'PCTDESC_PERMITIDO',
  'PCT_PIS', 'PCT_COFINS', 'CST_PIS_COFINS', 'CONTADOR',
] as const;

// Campos monetarios
export const ITEM_CURRENCY_FIELDS = new Set<string>([
  'VAL_VENDA', 'VAL_RENTABILIDADE', 'VAL_IMPOSTOS', 'VAL_DESCONTO',
  'VAL_DEVERIA', 'VAL_UNITARIO', 'VAL_FRETE_PF', 'VAL_FRETE',
  'CUSTO_REPOS', 'CUSTO_MEDIO', 'PRECO_PUBLICO_ATUAL',
]);

// Campos percentuais
export const ITEM_PERCENT_FIELDS = new Set<string>([
  'PER_RENTABILIDADE', 'PCT_DESCONTO', 'PCTDESC_PERMITIDO', 'PCT_PIS', 'PCT_COFINS',
]);

export const ITEM_DATE_FIELDS = new Set<string>(['DTA_ENTRADA_SAIDA']);

export interface VPecasItemRow {
  id: string;
  periodoImport?: string; // "YYYY-MM"
  isDevolucao?: boolean;
  highlight?: boolean;
  annotation?: string;
  data: Record<string, string>;
}

// CRUD
export async function loadVPecasItemRows(): Promise<VPecasItemRow[]> {
  try {
    const rawData = await kvGet(KEY_VPECAS_ITEM);
    if (!Array.isArray(rawData)) return [];
    return (rawData as Record<string, unknown>[]).map(item => {
      if (item.data && typeof item.data === 'object') return item as unknown as VPecasItemRow;
      const { id, periodoImport, highlight, annotation, ...fields } = item as Record<string, unknown>;
      return {
        id: String(id ?? crypto.randomUUID()),
        periodoImport: periodoImport as string | undefined,
        highlight: highlight as boolean | undefined,
        annotation: annotation as string | undefined,
        data: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v ?? '')])),
      } as VPecasItemRow;
    });
  } catch {
    return [];
  }
}

export async function saveVPecasItemRows(rows: VPecasItemRow[]): Promise<boolean> {
  try {
    await kvSet(KEY_VPECAS_ITEM, rows);
    return true;
  } catch {
    return false;
  }
}

// ─── Limite de importação por departamento ───────────────────────────────────
const ITEM_LIMIT_PER_DEPT = 100; // top 100 lucro + top 100 prejuízo por departamento

export function filterTopItemsByDept(
  rows: Omit<VPecasItemRow, 'id'>[],
): { filtered: Omit<VPecasItemRow, 'id'>[]; originalCount: number } {
  const originalCount = rows.length;
  const n = (v?: string) => parseFloat(String(v ?? '').replace(',', '.')) || 0;

  // Agrupa por departamento
  const byDept = new Map<string, Omit<VPecasItemRow, 'id'>[]>();
  for (const r of rows) {
    const dept = r.data['DEPARTAMENTO']?.trim() || '(sem depto)';
    const list = byDept.get(dept) ?? [];
    list.push(r);
    byDept.set(dept, list);
  }

  const result: Omit<VPecasItemRow, 'id'>[] = [];
  for (const items of byDept.values()) {
    const sorted = [...items].sort(
      (a, b) => n(b.data['VAL_RENTABILIDADE']) - n(a.data['VAL_RENTABILIDADE'])
    );
    // 100 linhas com maior lucro (topo) + 100 linhas com maior prejuízo (base)
    const topLucro = sorted.slice(0, ITEM_LIMIT_PER_DEPT);
    const topPrejuizo = sorted.length > ITEM_LIMIT_PER_DEPT
      ? sorted.slice(-ITEM_LIMIT_PER_DEPT)
      : [];
    // União sem duplicatas por índice (quando depto tem ≤ 200 linhas)
    const seen = new Set<number>();
    for (const entry of [...topLucro, ...topPrejuizo]) {
      const idx = sorted.indexOf(entry);
      if (!seen.has(idx)) { seen.add(idx); result.push(entry); }
    }
  }
  return { filtered: result, originalCount };
}

// TXT import: substitui linhas do mesmo periodo, mantem os demais
export async function importVPecasItemForPeriod(
  periodo: string,
  newRows: Omit<VPecasItemRow, 'id'>[],
): Promise<{ added: number; removed: number; originalCount: number }> {
  const { filtered, originalCount } = filterTopItemsByDept(newRows);
  const existing = await loadVPecasItemRows();
  const kept = existing.filter(r => r.periodoImport !== periodo);
  const removed = existing.length - kept.length;
  const toAdd: VPecasItemRow[] = filtered.map(r => ({
    ...r,
    id: crypto.randomUUID(),
    periodoImport: periodo,
  }));
  await saveVPecasItemRows([...kept, ...toAdd]);
  return { added: toAdd.length, removed, originalCount };
}

// Excel import: substitui tudo
export async function replaceVPecasItemRows(
  rows: Omit<VPecasItemRow, 'id'>[],
): Promise<{ total: number; originalCount: number }> {
  const { filtered, originalCount } = filterTopItemsByDept(rows);
  const withIds: VPecasItemRow[] = filtered.map(r => ({ ...r, id: crypto.randomUUID() }));
  await saveVPecasItemRows(withIds);
  return { total: withIds.length, originalCount };
}

// Parser TXT: uma linha de cabecalho, todas as linhas de dados comecam com digito
export function parsePecasItemTxt(content: string): Omit<VPecasItemRow, 'id'>[] {
  const lines = content.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(';').map(h => h.trim()).filter(h => h);
  const colIdx: Record<string, number> = {};
  headers.forEach((h, i) => { colIdx[h] = i; });

  const result: Omit<VPecasItemRow, 'id'>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\d/.test(line)) continue;
    const fields = line.split(';');
    const rowData: Record<string, string> = {};

    for (const h of ITEM_HEADERS) {
      const idx = colIdx[h];
      rowData[h] = idx !== undefined ? (fields[idx] ?? '').trim() : '';
    }
    // Colunas extras no arquivo alem de ITEM_HEADERS
    headers.forEach((h, idx) => {
      if (h && !(h in rowData)) rowData[h] = (fields[idx] ?? '').trim();
    });

    // Ignora transações P07 e A07
    const tipoTransacao = (rowData['TIPO_TRANSACAO'] ?? '').trim().toUpperCase();
    if (tipoTransacao === 'P07' || tipoTransacao === 'A07') continue;

    result.push({ data: rowData });
  }
  return result;
}

// ─── Devoluções (P07 / A07) ──────────────────────────────────────────────────

function negateMonetaryFields(data: Record<string, string>): Record<string, string> {
  const result = { ...data };
  for (const field of ITEM_CURRENCY_FIELDS) {
    const raw = result[field];
    if (!raw) continue;
    const n = parseFloat(raw.replace(',', '.'));
    if (!isNaN(n)) result[field] = (-n).toFixed(2).replace('.', ',');
  }
  return result;
}

export async function loadVPecasItemDevolucaoRows(): Promise<VPecasItemRow[]> {
  try {
    const rawData = await kvGet(KEY_VPECAS_ITEM_DEVOLUCAO);
    if (!Array.isArray(rawData)) return [];
    return (rawData as Record<string, unknown>[]).map(item => {
      if (item.data && typeof item.data === 'object') return { ...(item as unknown as VPecasItemRow), isDevolucao: true };
      const { id, periodoImport, highlight, annotation, isDevolucao: _d, ...fields } = item as Record<string, unknown>;
      return {
        id: String(id ?? crypto.randomUUID()),
        periodoImport: periodoImport as string | undefined,
        isDevolucao: true,
        highlight: highlight as boolean | undefined,
        annotation: annotation as string | undefined,
        data: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v ?? '')])),
      } as VPecasItemRow;
    });
  } catch {
    return [];
  }
}

export async function saveVPecasItemDevolucaoRows(rows: VPecasItemRow[]): Promise<boolean> {
  try {
    await kvSet(KEY_VPECAS_ITEM_DEVOLUCAO, rows);
    return true;
  } catch {
    return false;
  }
}

export async function importVPecasItemDevolucaoForPeriod(
  periodo: string,
  newRows: Omit<VPecasItemRow, 'id'>[],
): Promise<{ added: number; removed: number; originalCount: number }> {
  const { filtered, originalCount } = filterTopItemsByDept(newRows);
  const existing = await loadVPecasItemDevolucaoRows();
  const kept = existing.filter(r => r.periodoImport !== periodo);
  const removed = existing.length - kept.length;
  const toAdd: VPecasItemRow[] = filtered.map(r => ({
    ...r,
    id: crypto.randomUUID(),
    periodoImport: periodo,
    isDevolucao: true,
  }));
  await saveVPecasItemDevolucaoRows([...kept, ...toAdd]);
  return { added: toAdd.length, removed, originalCount };
}

// Parser TXT de devoluções: aceita apenas P07 e A07, nega campos monetários
export function parsePecasItemDevolucaoTxt(content: string): Omit<VPecasItemRow, 'id'>[] {
  const lines = content.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(';').map(h => h.trim()).filter(h => h);
  const colIdx: Record<string, number> = {};
  headers.forEach((h, i) => { colIdx[h] = i; });

  const TIPOS_DEVOLUCAO = new Set(['P07', 'A07']);
  const result: Omit<VPecasItemRow, 'id'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\d/.test(line)) continue;
    const fields = line.split(';');

    const tipoIdx = colIdx['TIPO_TRANSACAO'];
    const tipoTransacao = tipoIdx !== undefined ? (fields[tipoIdx] ?? '').trim().toUpperCase() : '';
    if (!TIPOS_DEVOLUCAO.has(tipoTransacao)) continue;

    const rowData: Record<string, string> = {};
    for (const h of ITEM_HEADERS) {
      const idx = colIdx[h];
      rowData[h] = idx !== undefined ? (fields[idx] ?? '').trim() : '';
    }
    headers.forEach((h, idx) => {
      if (h && !(h in rowData)) rowData[h] = (fields[idx] ?? '').trim();
    });

    result.push({ data: negateMonetaryFields(rowData), isDevolucao: true });
  }
  return result;
}

// Parser Excel
export function parsePecasItemExcel(buffer: ArrayBuffer): Omit<VPecasItemRow, 'id'>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return raw.map(r => ({
    data: Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k.trim(), String(v ?? '')])
    ),
  }));
}
