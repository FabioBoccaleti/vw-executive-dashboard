import type { ImportedTable } from './estoquePecasStorage';

// ─── Faixas de aging (dias sem movimentação) ────────────────────────────────────
export interface AgingBucketDef {
  label: string;
  min: number;
  max: number | null; // null = sem limite superior
}

export const AGING_BUCKETS: AgingBucketDef[] = [
  { label: '0–30', min: 0, max: 30 },
  { label: '31–60', min: 31, max: 60 },
  { label: '61–90', min: 61, max: 90 },
  { label: '91–180', min: 91, max: 180 },
  { label: '181–365', min: 181, max: 365 },
  { label: '366–730', min: 366, max: 730 },
  { label: '> 730', min: 731, max: null },
];

export function bucketForDias(dias: number): AgingBucketDef | null {
  for (const b of AGING_BUCKETS) {
    if (dias >= b.min && (b.max === null || dias <= b.max)) return b;
  }
  return null;
}

// ─── Helpers de parsing ─────────────────────────────────────────────────────────

/** Normaliza cabeçalho: maiúsculas, sem acentos e sem caracteres não alfanuméricos. */
function normalizeHeader(h: string): string {
  return h
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/** Encontra o índice de uma coluna pelo nome normalizado (aceita vários candidatos). */
function findColumn(headers: string[], candidates: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const c of candidates) {
    const idx = norm.indexOf(normalizeHeader(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Converte valor bruto pt-BR (ex.: '0001225,89' ou '1.234,56') em número. */
export function parseNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const s = raw.trim();
  if (!s) return 0;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Converte DIAS em inteiro (retorna null se vazio/invalido). */
function parseDias(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.trim();
  if (!s) return null;
  const n = Math.round(parseNumber(s));
  return Number.isFinite(n) ? n : null;
}

/** Remove tudo que não é alfanumérico e deixa em maiúsculas (p/ casar código editado × pub). */
export function normalizeCodigo(raw: string | undefined): string {
  if (!raw) return '';
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Normaliza código interno numérico removendo zeros à esquerda. */
function normalizeInterno(raw: string | undefined): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s.toUpperCase();
}

// ─── Tipos de resultado ─────────────────────────────────────────────────────────

export interface AnaliseItem {
  codigo: string;
  codigoInterno: string;
  descricao: string;
  grupo: string;
  quantidade: number;
  valorUnit: number;
  valorTotal: number;
  dias: number | null; // null = sem informação de dias
  parado: boolean;
  faixa: string | null;
}

export interface AgingBucketResult {
  label: string;
  valor: number;
  skus: number;
}

export interface AbcResult {
  classe: 'A' | 'B' | 'C';
  skus: number;
  valor: number;
  pctValor: number;
}

export interface GrupoResult {
  grupo: string;
  valor: number;
  skus: number;
}

export interface AnaliseResult {
  threshold: number;
  totalValor: number;
  totalSkus: number;
  totalPecas: number;
  valorParado: number;
  skusParados: number;
  pecasParadas: number;
  pctValorParado: number;
  pctSkusParados: number;
  valorMovimentando: number;
  skusMovimentando: number;
  semInfoValor: number;
  semInfoSkus: number;
  maiorValorParado: AnaliseItem | null;
  maisAntigo: AnaliseItem | null;
  buckets: AgingBucketResult[];
  topParados: AnaliseItem[];
  abc: AbcResult[];
  gruposParados: GrupoResult[];
  itens: AnaliseItem[];
}

// ─── Construção da análise ──────────────────────────────────────────────────────

export function buildAnalise(
  inventario: ImportedTable,
  movimentacao: ImportedTable,
  threshold: number,
): AnaliseResult {
  // Colunas do inventário
  const invCodigo = findColumn(inventario.headers, ['CÓDIGO EDITADO ÍTEM', 'CODIGO EDITADO ITEM']);
  const invInterno = findColumn(inventario.headers, ['CD.INT', 'CDINT']);
  const invDescricao = findColumn(inventario.headers, ['DESCRIÇÃO DA PEÇA', 'DESCRICAO DA PECA']);
  const invGrupo = findColumn(inventario.headers, ['DESCRIÇÃO DO GRUPO', 'DESCRICAO DO GRUPO']);
  const invQtd = findColumn(inventario.headers, ['QUANTIDADE']);
  const invVlUnit = findColumn(inventario.headers, ['VL.UNIT.', 'VL UNIT', 'VLUNIT']);
  const invVlTotal = findColumn(inventario.headers, ['VL.TOTAL', 'VLTOTAL']);

  // Colunas da movimentação
  const movInterno = findColumn(movimentacao.headers, ['ITEM_ESTOQUE']);
  const movPub = findColumn(movimentacao.headers, ['ITEM_ESTOQUE_PUB']);
  const movDias = findColumn(movimentacao.headers, ['DIAS']);

  // Mapas de dias por código interno e por código público normalizado
  const diasByInterno = new Map<string, number>();
  const diasByPub = new Map<string, number>();
  for (const row of movimentacao.rows) {
    const dias = parseDias(row[movDias]);
    if (dias === null) continue;
    const interno = normalizeInterno(row[movInterno]);
    const pub = normalizeCodigo(row[movPub]);
    if (interno && !diasByInterno.has(interno)) diasByInterno.set(interno, dias);
    if (pub && !diasByPub.has(pub)) diasByPub.set(pub, dias);
  }

  const itens: AnaliseItem[] = inventario.rows.map((row) => {
    const codigo = (row[invCodigo] ?? '').trim();
    const codigoInterno = (row[invInterno] ?? '').trim();
    const descricao = (row[invDescricao] ?? '').trim();
    const grupo = (row[invGrupo] ?? '').trim();
    const quantidade = parseNumber(row[invQtd]);
    const valorUnit = parseNumber(row[invVlUnit]);
    const valorTotal = parseNumber(row[invVlTotal]);

    // Junção: código interno (fallback) → código normalizado
    let dias: number | null = null;
    const internoKey = normalizeInterno(codigoInterno);
    if (internoKey && diasByInterno.has(internoKey)) {
      dias = diasByInterno.get(internoKey)!;
    } else {
      const pubKey = normalizeCodigo(codigo);
      if (pubKey && diasByPub.has(pubKey)) dias = diasByPub.get(pubKey)!;
    }

    const parado = dias !== null && dias >= threshold;
    const faixa = dias !== null ? bucketForDias(dias)?.label ?? null : null;

    return { codigo, codigoInterno, descricao, grupo, quantidade, valorUnit, valorTotal, dias, parado, faixa };
  });

  // Totais
  const totalValor = itens.reduce((s, it) => s + it.valorTotal, 0);
  const totalSkus = itens.length;
  const totalPecas = itens.reduce((s, it) => s + it.quantidade, 0);

  const parados = itens.filter((it) => it.parado);
  const valorParado = parados.reduce((s, it) => s + it.valorTotal, 0);
  const skusParados = parados.length;
  const pecasParadas = parados.reduce((s, it) => s + it.quantidade, 0);

  const semInfo = itens.filter((it) => it.dias === null);
  const semInfoValor = semInfo.reduce((s, it) => s + it.valorTotal, 0);
  const semInfoSkus = semInfo.length;

  const comInfo = itens.filter((it) => it.dias !== null);
  const movimentando = comInfo.filter((it) => !it.parado);
  const valorMovimentando = movimentando.reduce((s, it) => s + it.valorTotal, 0);
  const skusMovimentando = movimentando.length;

  // Faixas de aging (apenas itens com informação de dias)
  const buckets: AgingBucketResult[] = AGING_BUCKETS.map((b) => {
    const inBucket = comInfo.filter((it) => it.faixa === b.label);
    return {
      label: b.label,
      valor: inBucket.reduce((s, it) => s + it.valorTotal, 0),
      skus: inBucket.length,
    };
  });

  // Top 10 parados por valor
  const topParados = [...parados].sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 10);

  const maiorValorParado = topParados[0] ?? null;
  const maisAntigo =
    comInfo.length > 0
      ? comInfo.reduce((max, it) => ((it.dias ?? 0) > (max.dias ?? 0) ? it : max))
      : null;

  // Curva ABC (por valor em estoque, todos os itens)
  const abc = computeAbc(itens, totalValor);

  // Valor parado por grupo (top 8)
  const grupoMap = new Map<string, GrupoResult>();
  for (const it of parados) {
    const key = it.grupo || '(sem grupo)';
    const g = grupoMap.get(key) ?? { grupo: key, valor: 0, skus: 0 };
    g.valor += it.valorTotal;
    g.skus += 1;
    grupoMap.set(key, g);
  }
  const gruposParados = [...grupoMap.values()].sort((a, b) => b.valor - a.valor).slice(0, 8);

  return {
    threshold,
    totalValor,
    totalSkus,
    totalPecas,
    valorParado,
    skusParados,
    pecasParadas,
    pctValorParado: totalValor > 0 ? (valorParado / totalValor) * 100 : 0,
    pctSkusParados: totalSkus > 0 ? (skusParados / totalSkus) * 100 : 0,
    valorMovimentando,
    skusMovimentando,
    semInfoValor,
    semInfoSkus,
    maiorValorParado,
    maisAntigo,
    buckets,
    topParados,
    abc,
    gruposParados,
    itens,
  };
}

function computeAbc(itens: AnaliseItem[], totalValor: number): AbcResult[] {
  const sorted = [...itens].sort((a, b) => b.valorTotal - a.valorTotal);
  const acc: Record<'A' | 'B' | 'C', { skus: number; valor: number }> = {
    A: { skus: 0, valor: 0 },
    B: { skus: 0, valor: 0 },
    C: { skus: 0, valor: 0 },
  };
  let cumulative = 0;
  for (const it of sorted) {
    const pctAcum = totalValor > 0 ? (cumulative / totalValor) * 100 : 0;
    let classe: 'A' | 'B' | 'C';
    if (pctAcum < 80) classe = 'A';
    else if (pctAcum < 95) classe = 'B';
    else classe = 'C';
    acc[classe].skus += 1;
    acc[classe].valor += it.valorTotal;
    cumulative += it.valorTotal;
  }
  return (['A', 'B', 'C'] as const).map((classe) => ({
    classe,
    skus: acc[classe].skus,
    valor: acc[classe].valor,
    pctValor: totalValor > 0 ? (acc[classe].valor / totalValor) * 100 : 0,
  }));
}
