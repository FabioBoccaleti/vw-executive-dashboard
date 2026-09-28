import { kvGet, kvSet } from '@/lib/kvClient';

const KEY = 'blindagem_declaracao_prestadores';
const PAGAMENTOS_KEY = 'blindagem_declaracao_pagamentos';

export interface PrestadorServico {
  id: string;
  nome: string;
  valor: string;
}

export async function loadPrestadores(): Promise<PrestadorServico[]> {
  try {
    const data = await kvGet<PrestadorServico[]>(KEY);
    if (Array.isArray(data)) return data;
  } catch { /* fallback */ }
  return [];
}

export async function savePrestadores(rows: PrestadorServico[]): Promise<void> {
  try { await kvSet(KEY, rows); } catch { /* ignore */ }
}

// ─── Pagamento do demonstrativo (por linha de venda) ──────────────────────────
export interface DeclaracaoPagamento {
  pago: boolean;
  prestadorId?: string;    // seleção persistida (mesmo pendente)
  prestadorNome?: string;  // congelado ao marcar como pago
  valor?: string;          // congelado ao marcar como pago
  codigoCliente?: string;  // preenchido pelo usuário
  nomeCliente?: string;    // preenchido pelo usuário
  dataPagamento?: string;  // "YYYY-MM-DD"
}

export type PagamentosMap = Record<string, DeclaracaoPagamento>;

export async function loadPagamentos(): Promise<PagamentosMap> {
  try {
    const data = await kvGet<PagamentosMap>(PAGAMENTOS_KEY);
    if (data && typeof data === 'object') return data;
  } catch { /* fallback */ }
  return {};
}

export async function savePagamentos(map: PagamentosMap): Promise<void> {
  try { await kvSet(PAGAMENTOS_KEY, map); } catch { /* ignore */ }
}

