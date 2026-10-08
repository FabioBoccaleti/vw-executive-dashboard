import type { FaixaQtdSignDrive, RegraRemuneracaoSignDrive } from '@/components/CadastrosPage/cadastrosStorage';

/**
 * Regra de remuneração do Sign&Drive.
 *
 * Comissão pode ser:
 *  - Fixa: um único percentual aplicado sobre a base.
 *  - Variável por faixa de quantidade (RETROATIVA): a faixa é escolhida pela
 *    quantidade TOTAL de vendas do vendedor e o percentual dessa faixa é
 *    aplicado sobre TODAS as vendas.
 *
 *    Ex.: faixa 1 → 1 a 5 vendas = 8%; faixa 2 → 6 em diante = 10%.
 *    Com 6 vendas, aplica-se 10% sobre as 6 (e não 8% nas 5 primeiras + 10% na 6ª).
 */

/** Converte texto numérico (aceita vírgula ou ponto) em número; vazio/ inválido → null. */
function parseNum(value: string | undefined | null): number | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (text === '') return null;
  const normalized = text.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Seleciona a faixa correspondente à quantidade total de vendas.
 * `ate` vazio significa "em diante" (sem limite superior).
 * Em caso de sobreposição, vence a faixa de maior `de` (faixa superior).
 */
export function selecionarFaixaPorQuantidade(
  faixas: FaixaQtdSignDrive[],
  quantidade: number,
): FaixaQtdSignDrive | null {
  let selecionada: FaixaQtdSignDrive | null = null;
  let maiorDe = -Infinity;
  for (const faixa of faixas) {
    const de = parseNum(faixa.de);
    if (de == null) continue;
    const ateNum = parseNum(faixa.ate);
    const ate = ateNum == null ? Infinity : ateNum;
    if (quantidade >= de && quantidade <= ate && de > maiorDe) {
      selecionada = faixa;
      maiorDe = de;
    }
  }
  return selecionada;
}

/**
 * Percentual de comissão aplicável, dado o número total de vendas do vendedor.
 * Retorna 0 quando a comissão está inativa ou não há faixa correspondente.
 */
export function percentualComissaoRegra(regra: RegraRemuneracaoSignDrive, quantidade: number): number {
  if (!regra.comissaoAtiva) return 0;
  if (regra.comissaoModo === 'fixa') {
    return parseNum(regra.comissaoPercentual) ?? 0;
  }
  const faixa = selecionarFaixaPorQuantidade(regra.comissaoFaixas, quantidade);
  return faixa ? parseNum(faixa.valor) ?? 0 : 0;
}

/**
 * Valor de comissão da regra.
 * @param quantidade total de vendas do vendedor (define a faixa, de forma retroativa).
 * @param baseTotal  base sobre a qual o percentual incide (ex.: soma do Valor do Contrato das vendas).
 */
export function calcComissaoRegra(
  regra: RegraRemuneracaoSignDrive,
  quantidade: number,
  baseTotal: number,
): number {
  const pct = percentualComissaoRegra(regra, quantidade);
  return baseTotal * pct / 100;
}

/**
 * Valor de prêmio da regra.
 * - Unidade "percentual": o valor é um % aplicado sobre `baseTotal`.
 * - Unidade "valor": o valor é um montante fixo em R$ (independe da base).
 * No modo "faixas", a faixa é escolhida pela quantidade total de vendas (retroativo).
 */
export function valorPremioRegra(
  regra: RegraRemuneracaoSignDrive,
  quantidade: number,
  baseTotal: number,
): number {
  if (!regra.premioAtivo) return 0;
  let valor: number | null;
  if (regra.premioModo === 'fixo') {
    valor = parseNum(regra.premioValor);
  } else {
    const faixa = selecionarFaixaPorQuantidade(regra.premioFaixas, quantidade);
    valor = faixa ? parseNum(faixa.valor) : null;
  }
  if (valor == null) return 0;
  return regra.premioUnidade === 'percentual' ? baseTotal * valor / 100 : valor;
}
