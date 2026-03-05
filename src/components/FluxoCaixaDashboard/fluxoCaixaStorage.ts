// Serviço para persistência dos dados do Fluxo de Caixa no Redis (Vercel KV)
// Persiste o TEXTO BRUTO do balancete — o parse é sempre refeito no carregamento,
// garantindo imunidade a mudanças de schema e tamanho mínimo no Redis.

import { kvGet, kvSet, kvDelete } from '@/lib/kvClient';

const FLUXO_CAIXA_KEYS: Record<number, string> = {
  2025: 'fluxo_caixa_raw_v2',
  2026: 'fluxo_caixa_2026_raw_v1',
};

const FLUXO_CAIXA_KEY = FLUXO_CAIXA_KEYS[2025];

function getKey(year: number): string {
  return FLUXO_CAIXA_KEYS[year] ?? `fluxo_caixa_${year}_raw_v1`;
}

export interface FluxoCaixaRaw {
  rawText: string;
  fileName?: string;
  timestamp?: number;
}

/**
 * Salva o texto bruto do balancete no Redis.
 * @param rawText  Conteúdo original do arquivo .txt
 * @param fileName Nome do arquivo (opcional, para exibição)
 * @param year     Ano do balancete (default: 2025)
 */
export async function saveFluxoCaixaData(rawText: string, fileName?: string, year = 2025): Promise<boolean> {
  try {
    const payload: FluxoCaixaRaw = { rawText, fileName, timestamp: Date.now() };
    return await kvSet(getKey(year), payload);
  } catch (error) {
    console.error('Erro ao salvar balancete no Redis:', error);
    return false;
  }
}

/**
 * Carrega o texto bruto do balancete do Redis.
 * Retorna null se não houver dados ou se ocorrer erro.
 * @param year Ano do balancete (default: 2025)
 */
export async function loadFluxoCaixaRaw(year = 2025): Promise<FluxoCaixaRaw | null> {
  try {
    return await kvGet<FluxoCaixaRaw>(getKey(year));
  } catch (error) {
    console.error('Erro ao carregar balancete do Redis:', error);
    return null;
  }
}

/**
 * Limpa os dados do Fluxo de Caixa do Redis.
 * @param year Ano do balancete (default: 2025)
 */
export async function clearFluxoCaixaData(year = 2025): Promise<boolean> {
  try {
    return await kvDelete(getKey(year));
  } catch (error) {
    console.error('Erro ao limpar dados do Fluxo de Caixa:', error);
    return false;
  }
}

// Alias mantido para compatibilidade de imports existentes
export { loadFluxoCaixaRaw as loadFluxoCaixaData };

