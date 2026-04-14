import { kvGet, kvSet } from '@/lib/kvClient';
import * as XLSX from 'xlsx';

const KEY_VPECAS = 'registro_vpecas';

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

// ─── Tipo principal: todos os campos NF ficam em `data` ──────────────────────
export interface VPecasRow {
  id: string;
  periodoImport?: string; // "YYYY-MM"
  highlight?: boolean;
  annotation?: string;
  data: Record<string, string>; // todos os campos do cabeçalho NF
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
export async function loadVPecasRows(): Promise<VPecasRow[]> {
  try {
    const rawData = await kvGet(KEY_VPECAS);
    if (!Array.isArray(rawData)) return [];
    return (rawData as Record<string, unknown>[]).map(item => {
      // Migração: formato antigo tinha campos avulsos; novo tem `.data`
      if (item.data && typeof item.data === 'object') return item as unknown as VPecasRow;
      const { id, periodoImport, highlight, annotation, ...fields } = item as Record<string, unknown>;
      return {
        id: String(id ?? crypto.randomUUID()),
        periodoImport: periodoImport as string | undefined,
        highlight: highlight as boolean | undefined,
        annotation: annotation as string | undefined,
        data: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v ?? '')])),
      } as VPecasRow;
    });
  } catch {
    return [];
  }
}

export async function saveVPecasRows(rows: VPecasRow[]): Promise<boolean> {
  try {
    await kvSet(KEY_VPECAS, rows);
    return true;
  } catch {
    return false;
  }
}

export async function appendVPecasRows(
  newRows: Omit<VPecasRow, 'id'>[],
): Promise<{ added: number }> {
  const existing = await loadVPecasRows();
  const toAdd: VPecasRow[] = newRows.map(r => ({ ...r, id: crypto.randomUUID() }));
  await saveVPecasRows([...existing, ...toAdd]);
  return { added: toAdd.length };
}

export async function replaceVPecasRows(
  rows: Omit<VPecasRow, 'id'>[],
): Promise<{ total: number }> {
  const withIds: VPecasRow[] = rows.map(r => ({ ...r, id: crypto.randomUUID() }));
  await saveVPecasRows(withIds);
  return { total: withIds.length };
}

// ─── Parser TXT ───────────────────────────────────────────────────────────────
// Linha 0: cabeçalho das NFs (começa direto com "EMPRESA;...")
// Linha 1: cabeçalho dos itens (começa com ";TIPO;...")
// Linhas de dados de NF: começam com dígito (EMPRESA = "1")
// Linhas de itens: começam com ";"
export function parsePecasTxt(content: string): Omit<VPecasRow, 'id'>[] {
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

  // Mapeia posição de cada coluna do cabeçalho real do arquivo
  const nfHeaders = lines[0].split(';').map(h => h.trim());
  const nfColIdx: Record<string, number> = {};
  nfHeaders.forEach((h, i) => { if (h) nfColIdx[h] = i; });

  const result: Omit<VPecasRow, 'id'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Apenas linhas de NF (começam com dígito — campo EMPRESA)
    if (!/^\d/.test(line)) continue;

    const fields = line.split(';');
    const rowData: Record<string, string> = {};

    // Captura todos os cabeçalhos conhecidos
    for (const header of NF_HEADERS) {
      const idx = nfColIdx[header];
      rowData[header] = idx !== undefined ? (fields[idx] ?? '').trim() : '';
    }

    // Captura também qualquer coluna extra presente no arquivo mas não em NF_HEADERS
    nfHeaders.forEach((h, idx) => {
      if (h && !(h in rowData)) {
        rowData[h] = (fields[idx] ?? '').trim();
      }
    });

    result.push({ data: rowData });
  }

  return result;
}

// ─── Parser Excel ─────────────────────────────────────────────────────────────
export function parsePecasExcel(buffer: ArrayBuffer): Omit<VPecasRow, 'id'>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return raw.map(r => ({
    data: Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k.trim(), String(v ?? '')])
    ),
  }));
}
