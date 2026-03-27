import { kvGet, kvSet } from '@/lib/kvClient';

const KEY_NOVOS    = 'registro_vendas_novos';
const KEY_FROTISTA = 'registro_vendas_frotista';
const KEY_USADOS   = 'registro_vendas_usados';

export type RegistroSubTab = 'novos' | 'frotista' | 'usados';

/** Valores de TIPO_TRANSACAO que pertencem a cada aba */
export const TRANSACAO_MAP: Record<RegistroSubTab, string[]> = {
  novos:    ['V21', 'V07'],
  frotista: ['VD'],
  usados:   ['U21', 'U07'],
};

export interface RegistroVendasRow {
  id: string;
  chassi: string;
  modelo: string;
  valVenda: string;
  nfVenda: string;
  nfEntrada: string;
  valCusto: string;
  dtaEntrada: string;
  dtaVenda: string;
  nomeCor: string;
  nomeVendedor: string;
  transacao: string;
  highlight?: boolean;
  annotation?: string;
  periodoImport?: string; // "YYYY-MM" — período declarado na importação, tem prioridade sobre dtaVenda
}

function keyFor(tab: RegistroSubTab): string {
  return { novos: KEY_NOVOS, frotista: KEY_FROTISTA, usados: KEY_USADOS }[tab];
}

export async function loadRegistroRows(tab: RegistroSubTab): Promise<RegistroVendasRow[]> {
  try {
    const data = await kvGet(keyFor(tab));
    if (Array.isArray(data)) return data as RegistroVendasRow[];
    return [];
  } catch {
    return [];
  }
}

export async function saveRegistroRows(tab: RegistroSubTab, rows: RegistroVendasRow[]): Promise<boolean> {
  try {
    await kvSet(keyFor(tab), rows);
    return true;
  } catch {
    return false;
  }
}

/** Adiciona linhas (sem verificação de duplicata — entra tudo) */
export async function appendRegistroRows(
  tab: RegistroSubTab,
  newRows: Omit<RegistroVendasRow, 'id'>[],
): Promise<{ added: number }> {
  const existing = await loadRegistroRows(tab);
  const toAdd: RegistroVendasRow[] = newRows.map(r => ({ ...r, id: crypto.randomUUID() }));
  await saveRegistroRows(tab, [...existing, ...toAdd]);
  return { added: toAdd.length };
}

/** Substitui todos os dados da aba (usado na importação por Excel) */
export async function replaceRegistroRows(
  tab: RegistroSubTab,
  rows: Omit<RegistroVendasRow, 'id'>[],
): Promise<{ total: number }> {
  const withIds: RegistroVendasRow[] = rows.map(r => ({ ...r, id: crypto.randomUUID() }));
  await saveRegistroRows(tab, withIds);
  return { total: withIds.length };
}

// ─── Parser de linha TXT ──────────────────────────────────────────────────────

const COL: Record<string, number> = {};

export function initColMap(headers: string[]): void {
  headers.forEach((h, i) => { COL[h.trim()] = i; });
}

function col(fields: string[], name: string): string {
  const idx = COL[name];
  return idx !== undefined ? (fields[idx] ?? '').trim() : '';
}

/**
 * Parseia todas as linhas de um arquivo TXT (separador `;`)
 * e distribui por sub-aba conforme TIPO_TRANSACAO.
 */
export function parseTxtLines(content: string): Record<RegistroSubTab, Omit<RegistroVendasRow, 'id'>[]> {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { novos: [], frotista: [], usados: [] };

  initColMap(lines[0].split(';'));

  const result: Record<RegistroSubTab, Omit<RegistroVendasRow, 'id'>[]> = {
    novos: [], frotista: [], usados: [],
  };

  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(';');
    const transacao = col(fields, 'TIPO_TRANSACAO');

    let tab: RegistroSubTab | null = null;
    for (const [key, values] of Object.entries(TRANSACAO_MAP) as [RegistroSubTab, string[]][]) {
      if (values.includes(transacao)) { tab = key; break; }
    }
    if (!tab) continue;

    result[tab].push({
      chassi:       col(fields, 'CHASSI'),
      modelo:       col(fields, 'DES_MODELO'),
      valVenda:     col(fields, 'VAL_VENDA'),
      nfVenda:      col(fields, 'NUMERO_NOTA_FISCAL'),
      nfEntrada:    col(fields, 'NUMERO_NOTA_NFENTRADA'),
      valCusto:     col(fields, 'VAL_CUSTO_CONTABIL'),
      dtaEntrada:   col(fields, 'DTA_ENTRADA'),
      dtaVenda:     col(fields, 'DTA_VENDA'),
      nomeCor:      col(fields, 'NOME_COR'),
      nomeVendedor: col(fields, 'NOME_VENDEDOR'),
      transacao,
    });
  }

  return result;
}
