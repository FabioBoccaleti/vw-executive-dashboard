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
};

export async function getRegras(): Promise<ControleVeiculosRegras> {
  const loaded = await kvGet<Partial<ControleVeiculosRegras>>(KEY);
  return { ...EMPTY_REGRAS, ...(loaded ?? {}) };
}

export async function setRegras(regras: ControleVeiculosRegras) {
  return kvSet(KEY, regras);
}
