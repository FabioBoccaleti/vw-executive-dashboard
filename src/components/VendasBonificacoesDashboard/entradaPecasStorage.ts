import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'entrada_pecas_compra';

export interface EntradaPecasRow {
  id: string;
  // ─── Cabeçalho da NF ──────────────────────────────────────────────────────
  numeroNF: string;
  serieNF: string;
  tipoTransacao: string;    // TIPO_TRANSACAO (ex: P01)
  nfeChaveAcesso: string;
  dtaEntrada: string;       // DD/MM/YYYY
  dtaDocumento: string;     // DD/MM/YYYY
  modalidade: string;       // A=Avista, V=Vista...
  nomeDepartamento: string; // NOME_DEPARTAMENTO
  nomeUsuario: string;      // NOME_USUARIO (quem lançou)
  nomeFonte: string;        // NOME_FONTE
  nomeCliente: string;      // NOME_CLIENTE (fornecedor)
  cgccpf: string;
  cidade: string;
  estado: string;
  status: string;
  nomeCategoriaCliente: string;
  totNotaFiscal: number;
  liqNotaFiscal: number;
  totMercadoria: number;
  valDescontoNF: number;
  valIcmsNF: number;           // VAL_ICMS (base)
  valIcmsAuxOutros: number;    // VALOR_ICMS_AUX_OUTROS (total ICMS c/ ST)
  valFrete: number;
  valPisNF: number;
  valCofinsNF: number;
  totIpi: number;
  // ─── Item (peça) ──────────────────────────────────────────────────────────
  codItem: string;
  descricao: string;
  ordem: number;
  liqTotalItem: number;       // LIQ_TOTAL (valor líquido do item)
  valTotalItem: number;
  valUnitario: number;
  qtde: number;
  cfop: string;
  custoMedio: number;
  valDescontoItem: number;
  valIcmsItem: number;        // VAL_ICMS do item
  valIcmsRetidoItem: number;  // VAL_ICMS_RETIDO (ICMS-ST) do item
  valIpiItem: number;
  valPisItem: number;
  valCofinsItem: number;
  valIcmsAuxItem: number;     // VALOR_ICMS_AUX_OUTROS do item
  ncm: string;                // POSICAO_FISCAL (código NCM)
  baseIcms: number;           // BASE_ICMS do item
  aliquotaIcms: number;       // ALIQUOTA_ICMS do item (%)
  cfopOperacao: string;       // DES_CODFISCAL_OPERACAO
  // ─── Período de classificação ─────────────────────────────────────────────
  mes: number;
  ano: number;
}

// ─── Parse helper ─────────────────────────────────────────────────────────────
function n(s: string | undefined): number {
  if (!s || s.trim() === '') return 0;
  return parseFloat(s.replace(',', '.')) || 0;
}

/**
 * Faz o parse do conteúdo TXT (separado por ponto-e-vírgula) e retorna
 * as linhas de item com contexto do cabeçalho da NF.
 *
 * Estrutura do arquivo:
 *  - Linha 1: definição de colunas do cabeçalho (começa com EMPRESA;)
 *  - Linha 2: definição de colunas do item (começa com ;TIPO;)
 *  - Linhas seguintes: cabeçalhos de NF (começa com "1;") e itens (começa com ";P;")
 */
export function parseEntradaPecasTXT(
  content: string,
  mes: number,
  ano: number,
): EntradaPecasRow[] {
  const rows: EntradaPecasRow[] = [];
  const lines = content
    .split(/\r?\n/)
    .filter(l => l.trim());

  let hdr: string[] | null = null;

  for (const line of lines) {
    // Pula linhas de definição de colunas
    if (line.startsWith('EMPRESA;') || line.startsWith(';TIPO;')) continue;

    const f = line.split(';');

    if (f[0] === '1') {
      // Linha de cabeçalho da NF
      hdr = f;
    } else if (f[1] === 'P' && hdr) {
      // Linha de item da NF
      const nf     = hdr[2]  || '';
      const serie  = hdr[3]  || '';
      const cod    = (f[3]   || '').trim();
      const ordem  = parseInt(f[5] || '0') || 0;

      const id = `${hdr[0]}-${hdr[1]}-${nf}-${serie}-${cod}-${ordem}`;

      rows.push({
        id,
        // cabeçalho
        numeroNF:             nf,
        serieNF:              serie,
        tipoTransacao:        hdr[7]  || '',
        nfeChaveAcesso:       hdr[4]  || '',
        dtaEntrada:           hdr[9]  || '',
        dtaDocumento:         (hdr[10] || '').split(' ')[0],
        modalidade:           hdr[11] || '',
        nomeDepartamento:     hdr[18] || '',
        nomeUsuario:          hdr[27] || '',
        nomeFonte:            hdr[20] || '',
        nomeCliente:          hdr[84] || '',
        cgccpf:               hdr[87] || '',
        cidade:               hdr[88] || '',
        estado:               hdr[89] || '',
        status:               hdr[90] || '',
        nomeCategoriaCliente: hdr[78] || '',
        totNotaFiscal:        n(hdr[34]),
        liqNotaFiscal:        n(hdr[35]),
        totMercadoria:        n(hdr[37]),
        valDescontoNF:        n(hdr[38]),
        valIcmsNF:            n(hdr[43]),
        valIcmsAuxOutros:     n(hdr[44]),
        valFrete:             n(hdr[45]),
        valPisNF:             n(hdr[51]),
        valCofinsNF:          n(hdr[52]),
        totIpi:               n(hdr[58]),
        // item
        codItem:              cod,
        descricao:            f[4]  || '',
        ordem,
        liqTotalItem:         n(f[9]),
        valTotalItem:         n(f[8]),
        valUnitario:          n(f[10]),
        qtde:                 n(f[11]),
        cfop:                 f[12] || '',
        custoMedio:           n(f[13]),
        valDescontoItem:      n(f[14]),
        valIcmsItem:          n(f[17]),
        valIcmsRetidoItem:    n(f[18]),
        valIpiItem:           n(f[28]),
        valPisItem:           n(f[20]),
        valCofinsItem:        n(f[21]),
        valIcmsAuxItem:       n(f[37]),
        ncm:                  f[38] || '',
        baseIcms:             n(f[53]),
        aliquotaIcms:         n(f[52]),
        cfopOperacao:         f[35] || '',
        // período
        mes,
        ano,
      });
    }
  }

  return rows;
}

// ─── Storage CRUD ─────────────────────────────────────────────────────────────

function normalize(r: Record<string, unknown> & { id: string }): EntradaPecasRow {
  const num = (k: string) => Number(r[k] ?? 0);
  return {
    id:                   String(r.id),
    numeroNF:             String(r.numeroNF             ?? ''),
    serieNF:              String(r.serieNF              ?? ''),
    tipoTransacao:        String(r.tipoTransacao        ?? ''),
    nfeChaveAcesso:       String(r.nfeChaveAcesso       ?? ''),
    dtaEntrada:           String(r.dtaEntrada           ?? ''),
    dtaDocumento:         String(r.dtaDocumento         ?? ''),
    modalidade:           String(r.modalidade           ?? ''),
    nomeDepartamento:     String(r.nomeDepartamento     ?? ''),
    nomeUsuario:          String(r.nomeUsuario          ?? ''),
    nomeFonte:            String(r.nomeFonte            ?? ''),
    nomeCliente:          String(r.nomeCliente          ?? ''),
    cgccpf:               String(r.cgccpf               ?? ''),
    cidade:               String(r.cidade               ?? ''),
    estado:               String(r.estado               ?? ''),
    status:               String(r.status               ?? ''),
    nomeCategoriaCliente: String(r.nomeCategoriaCliente ?? ''),
    totNotaFiscal:        num('totNotaFiscal'),
    liqNotaFiscal:        num('liqNotaFiscal'),
    totMercadoria:        num('totMercadoria'),
    valDescontoNF:        num('valDescontoNF'),
    valIcmsNF:            num('valIcmsNF'),
    valIcmsAuxOutros:     num('valIcmsAuxOutros'),
    valFrete:             num('valFrete'),
    valPisNF:             num('valPisNF'),
    valCofinsNF:          num('valCofinsNF'),
    totIpi:               num('totIpi'),
    codItem:              String(r.codItem              ?? ''),
    descricao:            String(r.descricao            ?? ''),
    ordem:                num('ordem'),
    liqTotalItem:         num('liqTotalItem'),
    valTotalItem:         num('valTotalItem'),
    valUnitario:          num('valUnitario'),
    qtde:                 num('qtde'),
    cfop:                 String(r.cfop                 ?? ''),
    custoMedio:           num('custoMedio'),
    valDescontoItem:      num('valDescontoItem'),
    valIcmsItem:          num('valIcmsItem'),
    valIcmsRetidoItem:    num('valIcmsRetidoItem'),
    valIpiItem:           num('valIpiItem'),
    valPisItem:           num('valPisItem'),
    valCofinsItem:        num('valCofinsItem'),
    valIcmsAuxItem:       num('valIcmsAuxItem'),
    ncm:                  String(r.ncm                  ?? ''),
    baseIcms:             num('baseIcms'),
    aliquotaIcms:         num('aliquotaIcms'),
    cfopOperacao:         String(r.cfopOperacao         ?? ''),
    mes:                  num('mes'),
    ano:                  num('ano'),
  };
}

export async function loadEntradaPecasRows(): Promise<EntradaPecasRow[]> {
  try {
    const data = await kvGet(KEY);
    if (Array.isArray(data))
      return (data as (Record<string, unknown> & { id: string })[]).map(normalize);
    return [];
  } catch {
    return [];
  }
}

export async function saveEntradaPecasRows(rows: EntradaPecasRow[]): Promise<boolean> {
  try {
    await kvSet(KEY, rows);
    return true;
  } catch {
    return false;
  }
}

/**
 * Acumula os novos itens, substituindo apenas os que pertencem ao mesmo
 * mês/ano de classificação. Itens de outros períodos são preservados.
 */
export async function mergeEntradaPecasByPeriod(
  newRows: EntradaPecasRow[],
): Promise<{ added: number; replaced: number }> {
  const existing = await loadEntradaPecasRows();

  if (newRows.length === 0) return { added: 0, replaced: 0 };

  const { mes, ano } = newRows[0];

  const kept     = existing.filter(r => !(r.mes === mes && r.ano === ano));
  const replaced = existing.length - kept.length;

  await saveEntradaPecasRows([...kept, ...newRows]);
  return { added: newRows.length, replaced };
}

export async function clearEntradaPecasByPeriod(mes: number, ano: number): Promise<void> {
  const existing = await loadEntradaPecasRows();
  await saveEntradaPecasRows(existing.filter(r => !(r.mes === mes && r.ano === ano)));
}
