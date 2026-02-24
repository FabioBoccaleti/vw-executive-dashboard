// Serviço para persistência dos dados do Fluxo de Caixa no Redis (Vercel KV)
// Usa kvClient.ts para consistência com o restante do sistema.

import { kvGet, kvSet, kvDelete } from '@/lib/kvClient';

const FLUXO_CAIXA_KEY = 'fluxo_caixa_data';

export interface FluxoCaixaData {
  accounts: Record<string, any>;
  [key: string]: any;
  timestamp?: number;
}

/**
 * Salva os dados do Fluxo de Caixa no Redis
 */
export async function saveFluxoCaixaData(data: FluxoCaixaData): Promise<boolean> {
  try {
    return await kvSet(FLUXO_CAIXA_KEY, { ...data, timestamp: Date.now() });
  } catch (error) {
    console.error('Erro ao salvar dados do Fluxo de Caixa:', error);
    return false;
  }
}

/**
 * Carrega os dados do Fluxo de Caixa do Redis
 */
export async function loadFluxoCaixaData(): Promise<FluxoCaixaData | null> {
  try {
    return await kvGet<FluxoCaixaData>(FLUXO_CAIXA_KEY);
  } catch (error) {
    console.error('Erro ao carregar dados do Fluxo de Caixa:', error);
    return null;
  }
}

/**
 * Limpa os dados do Fluxo de Caixa do Redis
 */
export async function clearFluxoCaixaData(): Promise<boolean> {
  try {
    return await kvDelete(FLUXO_CAIXA_KEY);
  } catch (error) {
    console.error('Erro ao limpar dados do Fluxo de Caixa:', error);
    return false;
  }
}

