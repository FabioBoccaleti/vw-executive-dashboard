import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'financiamento_remuneracao_produto_regras';

export type TipoPremio = 'fixo' | 'percentual';

export interface RemuneracaoProdutoRegra {
  id: string;
  produto: string;
  tipoPremio: TipoPremio;
  valorPremio: string; // R$ ou %
}

export async function loadRemuneracaoRegras(): Promise<RemuneracaoProdutoRegra[]> {
  try {
    const data = await kvGet(KEY);
    if (Array.isArray(data)) return data as RemuneracaoProdutoRegra[];
    return [];
  } catch { return []; }
}

export async function saveRemuneracaoRegras(regras: RemuneracaoProdutoRegra[]): Promise<void> {
  await kvSet(KEY, regras);
}
