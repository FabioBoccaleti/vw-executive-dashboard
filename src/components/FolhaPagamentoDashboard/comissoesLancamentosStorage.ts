import { kvGet, kvSet } from '@/lib/kvClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface LinhaComissao {
  comVenda: number;
  comLB:    number;
}

export interface LancamentoComissao {
  linhas:         Record<string, LinhaComissao>; // key = chassi (ou índice da linha)
  pago:           boolean;
  dataPagamento?: string; // ISO date "YYYY-MM-DD"
}

// { "2026-5": { "NOME VENDEDOR": LancamentoComissao } }
export type LancamentosMap = Record<string, Record<string, LancamentoComissao>>;

// ─── KV ───────────────────────────────────────────────────────────────────────
const kvKey = (tab: 'novos' | 'usados') => `comissoes_lancamentos_${tab}`;

export async function loadLancamentos(tab: 'novos' | 'usados'): Promise<LancamentosMap> {
  const data = await kvGet(kvKey(tab));
  return (data as LancamentosMap) ?? {};
}

export async function saveLancamento(
  tab:       'novos' | 'usados',
  year:      number,
  month:     number,
  vendedor:  string,
  lancamento: LancamentoComissao,
): Promise<void> {
  const pk  = `${year}-${month}`;
  const all = await loadLancamentos(tab);
  await kvSet(kvKey(tab), {
    ...all,
    [pk]: { ...(all[pk] ?? {}), [vendedor]: lancamento },
  });
}

/** Salva o mapa completo de uma vez (usado em operações em massa). */
export async function bulkSaveLancamentos(
  tab: 'novos' | 'usados',
  map: LancamentosMap,
): Promise<void> {
  await kvSet(kvKey(tab), map);
}
