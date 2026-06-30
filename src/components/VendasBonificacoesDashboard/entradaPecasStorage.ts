import { kvGet, kvSet } from '@/lib/kvClient';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Item enxuto — 10 campos por linha (salvo por mês/ano) */
export interface EntradaPecasItemLite {
  nf:    string;   // numeroNF
  cod:   string;   // codItem
  ncm:   string;
  desc:  string;   // descricao
  qtde:  number;
  unit:  number;   // valUnitario
  forn:  string;   // nomeCliente (fornecedor)
  tipo:  string;   // tipoTransacao (ex: P01, P27)
  custo: number;   // custoMedio
  liqNF: number;   // liqNotaFiscal
  mes:   number;
  ano:   number;
}

export interface FornecedorResumoItem {
  nomeCliente:   string;
  nfs:           number;
  totalCusto:    number;
  temDevolucao:  boolean;
}

export interface TipoResumoItem {
  tipo:          string;
  totalCusto:    number;
  nfs:           number;
}

export interface EntradaPecasResumo {
  byFornecedor:  FornecedorResumoItem[];
  byTipo:        TipoResumoItem[];
  totalNFs:      number;
  totalItens:    number;
  totalCusto:    number;  // soma líquida (P27 já descontado)
  mes:           number;
  ano:           number;
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

function keyItens(mes: number, ano: number): string {
  return `ep_itens_${ano}_${String(mes).padStart(2, '0')}`;
}
function keyResumo(mes: number, ano: number): string {
  return `ep_resumo_${ano}_${String(mes).padStart(2, '0')}`;
}

// ─── Backwards-compat placeholder (não usado mais, mas evita erros de import) ─
export interface EntradaPecasRow {
  id: string;
  numeroNF: string; serieNF: string; tipoTransacao: string; nfeChaveAcesso: string;
  dtaEntrada: string; dtaDocumento: string; modalidade: string; nomeDepartamento: string;
  nomeUsuario: string; nomeFonte: string; nomeCliente: string; cgccpf: string;
  cidade: string; estado: string; status: string; nomeCategoriaCliente: string;
  totNotaFiscal: number; liqNotaFiscal: number; totMercadoria: number; valDescontoNF: number;
  valIcmsNF: number; valIcmsAuxOutros: number; valFrete: number; valPisNF: number;
  valCofinsNF: number; totIpi: number; codItem: string; descricao: string; ordem: number;
  liqTotalItem: number; valTotalItem: number; valUnitario: number; qtde: number; cfop: string;
  custoMedio: number; valDescontoItem: number; valIcmsItem: number; valIcmsRetidoItem: number;
  valIpiItem: number; valPisItem: number; valCofinsItem: number; valIcmsAuxItem: number;
  ncm: string; baseIcms: number; aliquotaIcms: number; cfopOperacao: string;
  mes: number; ano: number;
}

// ─── Parse helper ─────────────────────────────────────────────────────────────
function n(s: string | undefined): number {
  if (!s || s.trim() === '') return 0;
  return parseFloat(s.replace(',', '.')) || 0;
}

/**
 * Faz o parse do conteúdo TXT e retorna itens lite + resumo pré-calculado.
 * Estrutura do arquivo:
 *  - Linha 1: definição de colunas do cabeçalho (começa com EMPRESA;)
 *  - Linha 2: definição de colunas do item (começa com ;TIPO;)
 *  - Linhas seguintes: cabeçalhos de NF (começa com "1;") e itens (começa com ";P;")
 */
export function parseEntradaPecasTXT(
  content: string,
  mes: number,
  ano: number,
): { itens: EntradaPecasItemLite[]; resumo: EntradaPecasResumo } {
  const itens: EntradaPecasItemLite[] = [];
  const lines = content.split(/\r?\n/).filter(l => l.trim());

  let hdr: string[] | null = null;

  for (const line of lines) {
    if (line.startsWith('EMPRESA;') || line.startsWith(';TIPO;')) continue;
    const f = line.split(';');
    if (f[0] === '1') {
      hdr = f;
    } else if (f[1] === 'P' && hdr) {
      itens.push({
        nf:    hdr[2]  || '',
        forn:  hdr[84] || '',
        tipo:  hdr[7]  || '',
        cod:   (f[3]   || '').trim(),
        ncm:   f[38]   || '',
        desc:  f[4]    || '',
        qtde:  n(f[11]),
        unit:  n(f[10]),
        custo: n(f[13]),
        liqNF: n(hdr[35]),
        mes,
        ano,
      });
    }
  }

  // ── Resumo pré-calculado ─────────────────────────────────────────────────
  const byFornMap = new Map<string, { nfsSet: Set<string>; total: number; temDev: boolean }>();
  const byTipoMap = new Map<string, { nfsSet: Set<string>; total: number }>();

  for (const item of itens) {
    if (!byFornMap.has(item.forn)) byFornMap.set(item.forn, { nfsSet: new Set(), total: 0, temDev: false });
    const fe = byFornMap.get(item.forn)!;
    fe.nfsSet.add(item.nf);
    if (item.tipo === 'P27') { fe.total -= item.custo; fe.temDev = true; }
    else { fe.total += item.custo; }

    if (!byTipoMap.has(item.tipo)) byTipoMap.set(item.tipo, { nfsSet: new Set(), total: 0 });
    const te = byTipoMap.get(item.tipo)!;
    te.nfsSet.add(item.nf);
    te.total += item.custo;
  }

  const byFornecedor: FornecedorResumoItem[] = Array.from(byFornMap.entries())
    .map(([nome, d]) => ({ nomeCliente: nome, nfs: d.nfsSet.size, totalCusto: d.total, temDevolucao: d.temDev }))
    .sort((a, b) => b.totalCusto - a.totalCusto);

  const byTipo: TipoResumoItem[] = Array.from(byTipoMap.entries())
    .map(([tipo, d]) => ({ tipo, totalCusto: d.total, nfs: d.nfsSet.size }))
    .sort((a, b) => b.totalCusto - a.totalCusto);

  const resumo: EntradaPecasResumo = {
    byFornecedor,
    byTipo,
    totalNFs:   new Set(itens.map(i => i.nf)).size,
    totalItens: itens.length,
    totalCusto: byFornecedor.reduce((s, f) => s + f.totalCusto, 0),
    mes,
    ano,
  };

  return { itens, resumo };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export async function loadEntradaPecasItens(mes: number, ano: number): Promise<EntradaPecasItemLite[]> {
  try {
    const data = await kvGet(keyItens(mes, ano));
    if (Array.isArray(data)) return data as EntradaPecasItemLite[];
    return [];
  } catch { return []; }
}

export async function loadEntradaPecasResumo(mes: number, ano: number): Promise<EntradaPecasResumo | null> {
  try {
    const data = await kvGet(keyResumo(mes, ano));
    if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray((data as EntradaPecasResumo).byFornecedor))
      return data as EntradaPecasResumo;
    return null;
  } catch { return null; }
}

export async function saveEntradaPecasPeriod(
  mes: number,
  ano: number,
  itens: EntradaPecasItemLite[],
  resumo: EntradaPecasResumo,
): Promise<void> {
  await Promise.all([
    kvSet(keyItens(mes, ano), itens),
    kvSet(keyResumo(mes, ano), resumo),
  ]);
}

export async function clearEntradaPecasByPeriod(mes: number, ano: number): Promise<void> {
  await Promise.all([
    kvSet(keyItens(mes, ano), []),
    kvSet(keyResumo(mes, ano), {}),
  ]);
}

// ─── Agregação multi-mês (para a aba Resumo com "Ano todo") ───────────────────

export async function loadAndAggregateResumo(
  mes: number | null,
  ano: number,
): Promise<EntradaPecasResumo> {
  const months = mes !== null ? [mes] : Array.from({ length: 12 }, (_, i) => i + 1);
  const resumos = (
    await Promise.all(months.map(m => loadEntradaPecasResumo(m, ano)))
  ).filter((r): r is EntradaPecasResumo => r !== null);

  if (resumos.length === 0)
    return { byFornecedor: [], byTipo: [], totalNFs: 0, totalItens: 0, totalCusto: 0, mes: mes ?? 0, ano };

  const byFornMap = new Map<string, { nfs: number; total: number; temDev: boolean }>();
  const byTipoMap = new Map<string, { nfs: number; total: number }>();

  for (const r of resumos) {
    for (const f of r.byFornecedor) {
      if (!byFornMap.has(f.nomeCliente)) byFornMap.set(f.nomeCliente, { nfs: 0, total: 0, temDev: false });
      const e = byFornMap.get(f.nomeCliente)!;
      e.nfs   += f.nfs;
      e.total += f.totalCusto;
      if (f.temDevolucao) e.temDev = true;
    }
    for (const t of r.byTipo) {
      if (!byTipoMap.has(t.tipo)) byTipoMap.set(t.tipo, { nfs: 0, total: 0 });
      const e = byTipoMap.get(t.tipo)!;
      e.nfs   += t.nfs;
      e.total += t.totalCusto;
    }
  }

  const byFornecedor = Array.from(byFornMap.entries())
    .map(([nome, d]) => ({ nomeCliente: nome, nfs: d.nfs, totalCusto: d.total, temDevolucao: d.temDev }))
    .sort((a, b) => b.totalCusto - a.totalCusto);

  const byTipo = Array.from(byTipoMap.entries())
    .map(([tipo, d]) => ({ tipo, totalCusto: d.total, nfs: d.nfs }))
    .sort((a, b) => b.totalCusto - a.totalCusto);

  return {
    byFornecedor,
    byTipo,
    totalNFs:   resumos.reduce((s, r) => s + r.totalNFs,   0),
    totalItens: resumos.reduce((s, r) => s + r.totalItens, 0),
    totalCusto: byFornecedor.reduce((s, f) => s + f.totalCusto, 0),
    mes: mes ?? 0,
    ano,
  };
}

// ─── Stubs de compatibilidade (não usados, mas evitam erros de importação) ────
/** @deprecated use saveEntradaPecasPeriod */
export async function mergeEntradaPecasByPeriod(
  _rows: EntradaPecasRow[],
): Promise<{ added: number; replaced: number }> {
  return { added: 0, replaced: 0 };
}
/** @deprecated use loadEntradaPecasItens */
export async function loadEntradaPecasRows(): Promise<EntradaPecasRow[]> { return []; }
/** @deprecated */
export async function saveEntradaPecasRows(_rows: EntradaPecasRow[]): Promise<boolean> { return false; }
