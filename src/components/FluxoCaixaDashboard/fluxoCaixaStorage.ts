// Serviço para persistência dos dados do Fluxo de Caixa no Redis (Vercel KV)
// Persiste o TEXTO BRUTO do balancete — o parse é sempre refeito no carregamento,
// garantindo imunidade a mudanças de schema e tamanho mínimo no Redis.

import { kvGet, kvSet, kvDelete } from '@/lib/kvClient';

const FLUXO_CAIXA_KEY = 'fluxo_caixa_raw_v2';

export interface FluxoCaixaRaw {
  rawText: string;
  fileName?: string;
  timestamp?: number;
}

/**
 * Salva o texto bruto do balancete no Redis.
 * @param rawText  Conteúdo original do arquivo .txt
 * @param fileName Nome do arquivo (opcional, para exibição)
 */
export async function saveFluxoCaixaData(rawText: string, fileName?: string): Promise<boolean> {
  try {
    const payload: FluxoCaixaRaw = { rawText, fileName, timestamp: Date.now() };
    return await kvSet(FLUXO_CAIXA_KEY, payload);
  } catch (error) {
    console.error('Erro ao salvar balancete no Redis:', error);
    return false;
  }
}

/**
 * Carrega o texto bruto do balancete do Redis.
 * Retorna null se não houver dados ou se ocorrer erro.
 */
export async function loadFluxoCaixaRaw(): Promise<FluxoCaixaRaw | null> {
  try {
    return await kvGet<FluxoCaixaRaw>(FLUXO_CAIXA_KEY);
  } catch (error) {
    console.error('Erro ao carregar balancete do Redis:', error);
    return null;
  }
}

/**
 * Limpa os dados do Fluxo de Caixa do Redis.
 */
export async function clearFluxoCaixaData(): Promise<boolean> {
  try {
    return await kvDelete(FLUXO_CAIXA_KEY);
  } catch (error) {
    console.error('Erro ao limpar dados do Fluxo de Caixa:', error);
    return false;
  }
}

// Alias mantido para compatibilidade de imports existentes
export { loadFluxoCaixaRaw as loadFluxoCaixaData };

