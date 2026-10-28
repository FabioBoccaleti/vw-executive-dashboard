import { kvGet, kvSet } from '@/lib/kvClient';

export type BaseAnoColuna = 'fab' | 'mod';

export interface ControleVeiculosRegras {
  /** Situações (Sit) que devem aparecer em Veículos Disponíveis. */
  situacoes: string[];
  /** Títulos de coluna (do arquivo importado) que devem aparecer. */
  colunas: string[];
  /** Ano a partir do qual os veículos ficam disponíveis — Banco Itau. */
  anoItau: number | null;
  /** Ano a partir do qual os veículos ficam disponíveis — Banco Volks. */
  anoVolks: number | null;
  /** Coluna base para o ano — Banco Itau (Fabricação ou Modelo). */
  baseAnoItau: BaseAnoColuna;
  /** Coluna base para o ano — Banco Volks (Fabricação ou Modelo). */
  baseAnoVolks: BaseAnoColuna;
  /** Dias de vencimento — Banco Itau. */
  diasVencimentoItau: number | null;
  /** Dias de vencimento — Banco Volks. */
  diasVencimentoVolks: number | null;
  /** Dias de estoque máximo — Banco Itau. Veículo com dias de estoque ≥ este valor fica indisponível. Em branco (null) = regra inativa. */
  diasEstoqueItau: number | null;
  /** Dias de estoque máximo — Banco Volks. Veículo com dias de estoque ≥ este valor fica indisponível. Em branco (null) = regra inativa. */
  diasEstoqueVolks: number | null;
  /** Taxa de juros praticada (%) — Banco Itau. */
  taxaJurosItau: number | null;
  /** Taxa de juros praticada (%) — Banco Volks. */
  taxaJurosVolks: number | null;
  /** Considerar a coluna "Prop" como regra: veículo com Prop = "Sim" fica em negociação (bloqueado). Vale para ambos os bancos. */
  considerarProp: boolean;
  /** Considerar a coluna "Res" como regra: veículo com Res = "Sim" fica em negociação (bloqueado). Vale para ambos os bancos. */
  considerarRes: boolean;
  /** Linhas de crédito (DN) cadastradas — exclusivo do Banco Volks. */
  linhasCreditoDNVolks: string[];
}

const KEY = 'estoque-usados-controle-veiculos-regras';

export const EMPTY_REGRAS: ControleVeiculosRegras = {
  situacoes: [],
  colunas: [],
  anoItau: null,
  anoVolks: null,
  baseAnoItau: 'mod',
  baseAnoVolks: 'mod',
  diasVencimentoItau: null,
  diasVencimentoVolks: null,
  diasEstoqueItau: null,
  diasEstoqueVolks: null,
  taxaJurosItau: null,
  taxaJurosVolks: null,
  considerarProp: false,
  considerarRes: false,
  linhasCreditoDNVolks: [],
};

export async function getRegras(): Promise<ControleVeiculosRegras> {
  const loaded = await kvGet<Partial<ControleVeiculosRegras>>(KEY);
  return { ...EMPTY_REGRAS, ...(loaded ?? {}) };
}

export async function setRegras(regras: ControleVeiculosRegras) {
  return kvSet(KEY, regras);
}
