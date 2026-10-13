import type {
  RegraRemuneracaoSignDrive,
  Vendedor,
  TipoVendaSignDrive,
  BaseCalculoSignDrive,
} from '@/components/CadastrosPage/cadastrosStorage';
import type { AssinaturaRow } from './assinaturaStorage';
import { percentualComissaoRegra } from './signDriveRemuneracao';

/** Converte texto monetário BR (aceita vírgula ou ponto) em número. */
export function parseBR(s: string): number {
  if (!s) return 0;
  let clean = s.trim().replace(/R\$\s*/g, '');
  if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

/** Produto "Em Negociação" não gera comissão de vendedor. */
export const isEmNegociacao = (produto: string): boolean =>
  (produto ?? '').trim().toLowerCase().startsWith('em negocia');

/**
 * Uma linha está "congelada" quando a coluna "Sit. Comissão vendedor" está
 * preenchida (ex.: "Pago"). Nesse caso, o valor da estimativa não é recalculado
 * e não entra na contagem das faixas.
 */
export const isComissaoCongelada = (row: AssinaturaRow): boolean =>
  (row.situacaoComissaoVendedor ?? '').trim() !== '';

/** Mapeia a base de cálculo da regra para o campo correspondente na linha. */
export const BASE_FIELD: Record<BaseCalculoSignDrive, keyof AssinaturaRow> = {
  valorContrato:        'valorContrato',
  comissaoEntrega:      'comissaoEntrega',
  comissaoVenda:        'comissaoVenda',
  totalComissoesBruta:  'totalComissoesBruta',
  totalComissaoLiquida: 'totalComissaoLiquida',
};

/**
 * Calcula a Estimativa de Comissão do Vendedor por linha.
 * - A regra aplicável é a de comissão cujo Cargo = cargo do vendedor e cujos
 *   tipos de venda incluem o Produto da linha.
 * - A faixa é definida pela quantidade de vendas NÃO congeladas do mesmo
 *   vendedor dentro da mesma regra (somando todos os tipos da regra).
 * - A base é a soma das colunas marcadas como base na regra.
 * - Linhas anuladas / "Em Negociação" / sem regra ficam de fora.
 *
 * Retorna os valores apenas das linhas não congeladas elegíveis, e o conjunto
 * de ids elegíveis (com regra aplicável, congeladas ou não).
 */
export function computeEstimativas(
  rows: AssinaturaRow[],
  regras: RegraRemuneracaoSignDrive[],
  vendedores: Vendedor[],
  tiposVenda: TipoVendaSignDrive[],
): { values: Map<string, number>; eligibleIds: Set<string> } {
  const cargoByVendedor = new Map(vendedores.map(v => [v.nome, v.cargo] as const));
  const tipoIdByDesc = new Map(tiposVenda.map(t => [t.descricao, t.id] as const));
  const regrasComissao = regras.filter(r => r.comissaoAtiva);

  const ruleFor = (row: AssinaturaRow): RegraRemuneracaoSignDrive | null => {
    if (row.anulada || isEmNegociacao(row.tipoVenda)) return null;
    const cargo = cargoByVendedor.get(row.vendedor);
    const tipoId = tipoIdByDesc.get(row.tipoVenda);
    if (!cargo || !tipoId) return null;
    return regrasComissao.find(r => r.cargo === cargo && (r.tiposVendaIds ?? []).includes(tipoId)) ?? null;
  };

  const eligibleIds = new Set<string>();
  const groups = new Map<string, { rule: RegraRemuneracaoSignDrive; rows: AssinaturaRow[] }>();

  for (const row of rows) {
    const rule = ruleFor(row);
    if (!rule) continue;
    eligibleIds.add(row.id);
    if (isComissaoCongelada(row)) continue; // congelada: não entra na contagem
    const key = `${row.vendedor}||${rule.id}`;
    let g = groups.get(key);
    if (!g) { g = { rule, rows: [] }; groups.set(key, g); }
    g.rows.push(row);
  }

  const values = new Map<string, number>();
  for (const { rule, rows: grp } of groups.values()) {
    const pct = percentualComissaoRegra(rule, grp.length);
    for (const row of grp) {
      const base = (rule.comissaoBases ?? []).reduce(
        (s, b) => s + parseBR(String(row[BASE_FIELD[b]] ?? '')),
        0,
      );
      values.set(row.id, base * pct / 100);
    }
  }

  return { values, eligibleIds };
}

/**
 * Valor efetivo da Comissão do Vendedor para uma linha:
 * - congelada: usa o valor congelado em `estimativaComissaoVendedor`;
 * - não congelada: usa o valor recalculado em `values`.
 */
export function comissaoVendedorValor(
  row: AssinaturaRow,
  values: Map<string, number>,
): number {
  if (isComissaoCongelada(row)) {
    return parseBR(String(row.estimativaComissaoVendedor ?? ''));
  }
  return values.get(row.id) ?? 0;
}
