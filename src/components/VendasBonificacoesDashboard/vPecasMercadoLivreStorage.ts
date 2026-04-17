import { kvGet, kvSet, kvKeys } from '@/lib/kvClient';
import * as XLSX from 'xlsx';

const KEY_VPECAS_ML          = 'registro_vpecas_ml';
const KEY_VPECAS_ML_DEVOLUCAO = 'registro_vpecas_ml_devolucao';

// ─── Todos os cabeçalhos do nível de NF (na ordem original do arquivo) ────────
export const NF_HEADERS = [
  'EMPRESA', 'REVENDA', 'NUMERO_NOTA_FISCAL', 'SERIE_NOTA_FISCAL', 'NFE_CHAVE_ACESSO',
  'NFSE', 'CODIGO_CST_ITEM', 'TIPO_TRANSACAO', 'CONTADOR', 'DTA_ENTRADA_SAIDA',
  'DTA_DOCUMENTO', 'MODALIDADE', 'PERCENT_DESCONTO_NOTA', 'CAIXA', 'OPERACAO',
  'FATOPERACAO', 'FATOPERACAO_ORIGINAL', 'DEPARTAMENTO', 'NOME_DEPARTAMENTO',
  'FONTE', 'NOME_FONTE', 'MOTIVO', 'NOME_MOTIVO', 'ORIGEM', 'NOME_ORIGEM',
  'CONTATO', 'USUARIO', 'NOME_USUARIO', 'COD_MODELO_NF_USOFISCAL', 'NOME_MODELO',
  'COD_RETENCAO_RECEITA_FEDERAL', 'COD_RET_RECEITA_FEDERAL_IR',
  'CODIGO_TRIBUTACAO_SERVICO_NFSE', 'DESC_TRIBUTACAO_SERVICO_NFSE',
  'TOT_NOTA_FISCAL', 'LIQ_NOTA_FISCAL', 'TOT_CUSTO_MEDIO', 'TOT_MERCADORIA',
  'VALDESCONTO', 'TOT_SERVICOS', 'VALDESCONTO_MO', 'TOT_CUSTO_REPOSICAO',
  'DIFERENCA_ICMS', 'VAL_ICMS', 'VALOR_ICMS_AUX_OUTROS', 'VAL_FRETE', 'VAL_ISS',
  'VAL_SEGURO', 'VAL_ICMS_FRETE', 'VAL_ICMS_RETIDO', 'VAL_ENCARGOS_FINANCEIROS',
  'VAL_PIS', 'VAL_COFINS', 'VAL_PIS_OUTROS', 'VAL_COFINS_OUTROS', 'VAL_PIS_ST',
  'VAL_COFINS_ST', 'VAL_CSLL', 'TOT_IPI', 'VALOR_ICMSRET_ARESSARCIR',
  'VALOR_ICMSRET_ARECOLHER', 'VAL_IMPOSTO_RENDA', 'VAL_CONTRIBUICAO',
  'VAL_ISS_RETIDO', 'VAL_INSS_RETIDO', 'VAL_SOMA_MEI', 'TOT_SUFRAMA',
  'VAL_ICMS_PARTIL_UF_REM', 'VAL_ICMS_PARTIL_UF_DEST', 'VAL_ICMS_COMB_POBREZA',
  'VAL_BCICMS_UF_DEST', 'TIPO_OS', 'NRO_OS', 'NOTA_REFERENTE_CUPOM',
  'NOTA_REFERENTE_NFCE', 'TIPO', 'SUBTIPO_TRANSACAO', 'NOME_TIPO_TRANSACAO',
  'NOME_CATEGORIA_CLIENTE', 'VENDEDOR', 'NOME_VENDEDOR', 'VENDEDOR2', 'NOME_VENDEDOR2',
  'CLIENTE', 'NOME_CLIENTE', 'FISJUR', 'CATEGORIA', 'CGCCPF', 'CIDADE', 'ESTADO',
  'STATUS', 'REC', 'OBSERVACAO', 'VAL_BASE_IRRF', 'VAL_BASE_PCC', 'VAL_BASE_PIS_ST',
  'VAL_BASE_COFINS_ST', 'SOMA_ICMS_ANTECIPADO_CUSTO', 'BASE_ICMS_ANTECIPADO',
  'VAL_ICMS_ANTECIPADO', 'VAL_FCP_ST', 'VAL_FCP_OUTROS', 'VAL_DIFAL_FCP',
  'VAL_FCP_DIFERIDO', 'VAL_FCP_EFETIVO', 'VAL_PIS_FPF', 'VAL_COFINS_FPF',
] as const;

// ─── Campos que devem ser formatados como moeda ───────────────────────────────
export const CURRENCY_FIELDS = new Set<string>([
  'TOT_NOTA_FISCAL', 'LIQ_NOTA_FISCAL', 'TOT_CUSTO_MEDIO', 'TOT_MERCADORIA',
  'VALDESCONTO', 'TOT_SERVICOS', 'VALDESCONTO_MO', 'TOT_CUSTO_REPOSICAO',
  'DIFERENCA_ICMS', 'VAL_ICMS', 'VALOR_ICMS_AUX_OUTROS', 'VAL_FRETE', 'VAL_ISS',
  'VAL_SEGURO', 'VAL_ICMS_FRETE', 'VAL_ICMS_RETIDO', 'VAL_ENCARGOS_FINANCEIROS',
  'VAL_PIS', 'VAL_COFINS', 'VAL_PIS_OUTROS', 'VAL_COFINS_OUTROS', 'VAL_PIS_ST',
  'VAL_COFINS_ST', 'VAL_CSLL', 'TOT_IPI', 'VALOR_ICMSRET_ARESSARCIR',
  'VALOR_ICMSRET_ARECOLHER', 'VAL_IMPOSTO_RENDA', 'VAL_CONTRIBUICAO',
  'VAL_ISS_RETIDO', 'VAL_INSS_RETIDO', 'VAL_SOMA_MEI', 'TOT_SUFRAMA',
  'VAL_ICMS_PARTIL_UF_REM', 'VAL_ICMS_PARTIL_UF_DEST', 'VAL_ICMS_COMB_POBREZA',
  'VAL_BCICMS_UF_DEST', 'VAL_BASE_IRRF', 'VAL_BASE_PCC', 'VAL_BASE_PIS_ST',
  'VAL_BASE_COFINS_ST', 'SOMA_ICMS_ANTECIPADO_CUSTO', 'BASE_ICMS_ANTECIPADO',
  'VAL_ICMS_ANTECIPADO', 'VAL_FCP_ST', 'VAL_FCP_OUTROS', 'VAL_DIFAL_FCP',
  'VAL_FCP_DIFERIDO', 'VAL_FCP_EFETIVO', 'VAL_PIS_FPF', 'VAL_COFINS_FPF',
  'PERCENT_DESCONTO_NOTA',
]);

export const DATE_FIELDS = new Set<string>(['DTA_ENTRADA_SAIDA', 'DTA_DOCUMENTO']);

// ─── Tipo principal ───────────────────────────────────────────────────────────
export interface VPecasMLRow {
  id: string;
  periodoImport?: string; // "YYYY-MM"
  isDevolucao?: boolean;
  highlight?: boolean;
  annotation?: string;
  data: Record<string, string>;
}

// ─── Chunked period storage ───────────────────────────────────────────────────
const CHUNK_SIZE       = 200;
const KEY_PERIOD_META  = (p: string) => `registro_vpecas_ml_per_${p}_meta`;
const KEY_PERIOD_CHUNK = (p: string, i: number) => `registro_vpecas_ml_per_${p}_c${i}`;

async function savePeriodRows(periodo: string, rows: VPecasMLRow[]): Promise<void> {
  const chunks: VPecasMLRow[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) chunks.push(rows.slice(i, i + CHUNK_SIZE));
  await Promise.all([
    kvSet(KEY_PERIOD_META(periodo), { chunks: chunks.length }),
    ...chunks.map((chunk, i) => kvSet(KEY_PERIOD_CHUNK(periodo, i), chunk)),
  ]);
}

async function loadPeriodRows(periodo: string): Promise<VPecasMLRow[]> {
  const meta = await kvGet<{ chunks: number }>(KEY_PERIOD_META(periodo));
  if (!meta || !meta.chunks) return [];
  const keys = Array.from({ length: meta.chunks }, (_, i) => KEY_PERIOD_CHUNK(periodo, i));
  const chunks = await Promise.all(keys.map(k => kvGet<VPecasMLRow[]>(k)));
  return chunks.filter((c): c is VPecasMLRow[] => Array.isArray(c)).flat();
}

async function getAllMLPeriods(): Promise<string[]> {
  try {
    const keys = await kvKeys('registro_vpecas_ml_per_*_meta');
    return keys.map(k => k.replace('registro_vpecas_ml_per_', '').replace('_meta', ''));
  } catch { return []; }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
export async function loadVPecasMLRows(): Promise<VPecasMLRow[]> {
  try {
    const periods = await getAllMLPeriods();
    if (periods.length > 0) {
      const arrays = await Promise.all(periods.map(loadPeriodRows));
      return arrays.flat();
    }
    const rawData = await kvGet(KEY_VPECAS_ML);
    if (!Array.isArray(rawData)) return [];
    return (rawData as Record<string, unknown>[]).map(item => {
      if (item.data && typeof item.data === 'object') return item as unknown as VPecasMLRow;
      const { id, periodoImport, highlight, annotation, ...fields } = item as Record<string, unknown>;
      return {
        id: String(id ?? crypto.randomUUID()),
        periodoImport: periodoImport as string | undefined,
        highlight: highlight as boolean | undefined,
        annotation: annotation as string | undefined,
        data: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v ?? '')])),
      } as VPecasMLRow;
    });
  } catch {
    return [];
  }
}

export async function saveVPecasMLRows(rows: VPecasMLRow[]): Promise<boolean> {
  try {
    const byPeriod = new Map<string, VPecasMLRow[]>();
    for (const r of rows) {
      const p = r.periodoImport ?? 'sem-periodo';
      byPeriod.set(p, [...(byPeriod.get(p) ?? []), r]);
    }
    const saveOps = [...byPeriod.entries()].map(([p, rs]) => savePeriodRows(p, rs));
    const existingPeriods = await getAllMLPeriods();
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

export async function appendVPecasMLRows(
  newRows: Omit<VPecasMLRow, 'id'>[],
): Promise<{ added: number }> {
  const byPeriod = new Map<string, Omit<VPecasMLRow, 'id'>[]>();
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

export async function replaceVPecasMLRows(
  rows: Omit<VPecasMLRow, 'id'>[],
): Promise<{ total: number }> {
  const periods = await getAllMLPeriods();
  await Promise.all(periods.map(p => savePeriodRows(p, [])));
  try { await kvSet(KEY_VPECAS_ML, []); } catch { /* legacy */ }
  const { added } = await appendVPecasMLRows(rows);
  return { total: added };
}

// ─── Devoluções ───────────────────────────────────────────────────────────────
function negateCurrencyFields(data: Record<string, string>): Record<string, string> {
  const result = { ...data };
  for (const field of CURRENCY_FIELDS) {
    const raw = result[field];
    if (!raw) continue;
    const n = parseFloat(raw.replace(',', '.'));
    if (!isNaN(n)) result[field] = (-n).toFixed(2).replace('.', ',');
  }
  return result;
}

export async function loadVPecasMLDevolucaoRows(): Promise<VPecasMLRow[]> {
  try {
    const rawData = await kvGet(KEY_VPECAS_ML_DEVOLUCAO);
    if (!Array.isArray(rawData)) return [];
    return (rawData as Record<string, unknown>[]).map(item => {
      if (item.data && typeof item.data === 'object') return { ...(item as unknown as VPecasMLRow), isDevolucao: true };
      const { id, periodoImport, highlight, annotation, isDevolucao: _d, ...fields } = item as Record<string, unknown>;
      return {
        id: String(id ?? crypto.randomUUID()),
        periodoImport: periodoImport as string | undefined,
        isDevolucao: true,
        highlight: highlight as boolean | undefined,
        annotation: annotation as string | undefined,
        data: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v ?? '')])),
      } as VPecasMLRow;
    });
  } catch {
    return [];
  }
}

export async function saveVPecasMLDevolucaoRows(rows: VPecasMLRow[]): Promise<boolean> {
  try {
    await kvSet(KEY_VPECAS_ML_DEVOLUCAO, rows);
    return true;
  } catch {
    return false;
  }
}

export async function appendVPecasMLDevolucaoRows(
  periodo: string,
  newRows: Omit<VPecasMLRow, 'id'>[],
): Promise<{ added: number; removed: number }> {
  const existing = await loadVPecasMLDevolucaoRows();
  const kept = existing.filter(r => r.periodoImport !== periodo);
  const removed = existing.length - kept.length;
  const toAdd: VPecasMLRow[] = newRows.map(r => ({ ...r, id: crypto.randomUUID(), periodoImport: periodo, isDevolucao: true }));
  await saveVPecasMLDevolucaoRows([...kept, ...toAdd]);
  return { added: toAdd.length, removed };
}

// ─── Transações ignoradas ─────────────────────────────────────────────────────
const IGNORED_TRANSACOES_EXACT = new Set([
  'V21', 'U21', 'I21', 'C41', 'C21',
  'V42', 'V29', 'U25', 'P68', 'P37', 'P30',
  'G23', 'P27', 'O25', 'ST1', 'P64', 'P65', 'P66',
]);
function isIgnoredTransacao(t: string): boolean {
  const upper = t.toUpperCase();
  return IGNORED_TRANSACOES_EXACT.has(upper) || upper.startsWith('L');
}

// ─── Parser TXT ───────────────────────────────────────────────────────────────
export function parsePecasMLTxt(content: string): Omit<VPecasMLRow, 'id'>[] {
  const rawLines = content.split(/\r?\n/);
  const lines: string[] = [];
  for (const raw of rawLines) {
    if (!raw.trim()) continue;
    if (lines.length === 0 || /^[A-Za-z\d]/.test(raw)) {
      lines.push(raw);
    } else {
      lines[lines.length - 1] += raw;
    }
  }

  if (lines.length < 2) return [];

  const nfHeaders = lines[0].split(';').map(h => h.trim());
  const nfColIdx: Record<string, number> = {};
  nfHeaders.forEach((h, i) => { if (h) nfColIdx[h] = i; });

  const result: Omit<VPecasMLRow, 'id'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\d/.test(line)) continue;

    const fields = line.split(';');
    const rowData: Record<string, string> = {};

    for (const header of NF_HEADERS) {
      const idx = nfColIdx[header];
      rowData[header] = idx !== undefined ? (fields[idx] ?? '').trim() : '';
    }

    nfHeaders.forEach((h, idx) => {
      if (h && !(h in rowData)) {
        rowData[h] = (fields[idx] ?? '').trim();
      }
    });

    result.push({ data: rowData });
  }

  return result.filter(r => !isIgnoredTransacao(r.data['TIPO_TRANSACAO'] ?? ''));
}

// ─── Parser TXT de devoluções ─────────────────────────────────────────────────
export function parsePecasMLDevolucaoTxt(content: string): Omit<VPecasMLRow, 'id'>[] {
  const TIPOS_DEVOLUCAO = new Set(['P07', 'A07']);

  const rawLines = content.split(/\r?\n/);
  const lines: string[] = [];
  for (const raw of rawLines) {
    if (!raw.trim()) continue;
    if (lines.length === 0 || /^[A-Za-z\d]/.test(raw)) {
      lines.push(raw);
    } else {
      lines[lines.length - 1] += raw;
    }
  }

  if (lines.length < 2) return [];

  const nfHeaders = lines[0].split(';').map(h => h.trim());
  const nfColIdx: Record<string, number> = {};
  nfHeaders.forEach((h, i) => { if (h) nfColIdx[h] = i; });

  const result: Omit<VPecasMLRow, 'id'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\d/.test(line)) continue;

    const fields = line.split(';');
    const tipoIdx = nfColIdx['TIPO_TRANSACAO'];
    const tipo = tipoIdx !== undefined ? (fields[tipoIdx] ?? '').trim().toUpperCase() : '';
    if (!TIPOS_DEVOLUCAO.has(tipo)) continue;

    const rowData: Record<string, string> = {};
    for (const header of NF_HEADERS) {
      const idx = nfColIdx[header];
      rowData[header] = idx !== undefined ? (fields[idx] ?? '').trim() : '';
    }
    nfHeaders.forEach((h, idx) => {
      if (h && !(h in rowData)) rowData[h] = (fields[idx] ?? '').trim();
    });

    result.push({ data: negateCurrencyFields(rowData), isDevolucao: true });
  }
  return result;
}

// ─── Parser Excel ─────────────────────────────────────────────────────────────
export function parsePecasMLExcel(buffer: ArrayBuffer): Omit<VPecasMLRow, 'id'>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return raw
    .map(r => ({
      data: Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k.trim(), String(v ?? '')])
      ),
    }))
    .filter(r => !isIgnoredTransacao(r.data['TIPO_TRANSACAO'] ?? ''));
}
