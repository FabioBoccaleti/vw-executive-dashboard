import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'remuneracao_produtos';

export type TipoRemuneracao = 'premio' | 'comissao';

export interface RemuneracaoProduto {
  // Tipo de remuneração cadastrado para o produto.
  tipo: TipoRemuneracao;
  // Prêmio = valor fixo em R$ (ex: "150,00"); Comissão = percentual (ex: "5,00").
  valor: string;
}

// Mapa de código do produto → remuneração cadastrada.
export type RemuneracaoProdutosMap = Record<string, RemuneracaoProduto>;

function isValidEntry(v: unknown): v is RemuneracaoProduto {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (o.tipo === 'premio' || o.tipo === 'comissao') && typeof o.valor === 'string';
}

export async function loadRemuneracaoProdutos(): Promise<RemuneracaoProdutosMap> {
  try {
    const data = await kvGet(KEY);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const entries = Object.entries(data as Record<string, unknown>).filter(([, v]) => isValidEntry(v));
      return Object.fromEntries(entries) as RemuneracaoProdutosMap;
    }
    return {};
  } catch {
    return {};
  }
}

export async function saveRemuneracaoProdutos(map: RemuneracaoProdutosMap): Promise<void> {
  await kvSet(KEY, map);
}
