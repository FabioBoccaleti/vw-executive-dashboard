// Serviço para persistência dos dados do Fluxo de Caixa no Redis (Vercel KV)
// Persiste o TEXTO BRUTO do balancete — o parse é sempre refeito no carregamento,
// garantindo imunidade a mudanças de schema e tamanho mínimo no Redis.
//
// Chaveamento: uma chave por mês/ano → fluxo_caixa_YYYY_MM
// Chave legada do dez/25 (migração automática): fluxo_caixa_raw_v2

import { kvGet, kvSet, kvDelete, kvKeys } from '@/lib/kvClient';

// Chave legada usada antes da separação por mês
const LEGACY_KEY_2025 = 'fluxo_caixa_raw_v2';

function getKey(year: number, month: number): string {
  const mm = String(month).padStart(2, '0');
  return `fluxo_caixa_${year}_${mm}`;
}

export interface FluxoCaixaRaw {
  rawText: string;
  fileName?: string;
  timestamp?: number;
}

/**
 * Salva o texto bruto do balancete no Redis para o mês/ano selecionado.
 */
export async function saveFluxoCaixaData(rawText: string, fileName?: string, year = 2025, month = 12): Promise<boolean> {
  try {
    const payload: FluxoCaixaRaw = { rawText, fileName, timestamp: Date.now() };
    return await kvSet(getKey(year, month), payload);
  } catch (error) {
    console.error('Erro ao salvar balancete no Redis:', error);
    return false;
  }
}

/**
 * Carrega o texto bruto do balancete do Redis para o mês/ano selecionado.
 * Para dez/2025 faz fallback na chave legada para migração automática.
 */
export async function loadFluxoCaixaRaw(year = 2025, month = 12): Promise<FluxoCaixaRaw | null> {
  try {
    const data = await kvGet<FluxoCaixaRaw>(getKey(year, month));
    if (data) return data;

    // Migração automática: dez/2025 pode estar na chave legada
    if (year === 2025 && month === 12) {
      const legacy = await kvGet<FluxoCaixaRaw>(LEGACY_KEY_2025);
      if (legacy) {
        console.log('🔄 Migrando balancete dez/2025 da chave legada...');
        // Salva na nova chave para não precisar migrar de novo
        await kvSet(getKey(2025, 12), legacy);
        return legacy;
      }
    }

    return null;
  } catch (error) {
    console.error('Erro ao carregar balancete do Redis:', error);
    return null;
  }
}

/**
 * Limpa os dados do Fluxo de Caixa do Redis para o mês/ano selecionado.
 */
export async function clearFluxoCaixaData(year = 2025, month = 12): Promise<boolean> {
  try {
    return await kvDelete(getKey(year, month));
  } catch (error) {
    console.error('Erro ao limpar dados do Fluxo de Caixa:', error);
    return false;
  }
}

// Alias mantido para compatibilidade de imports existentes
export { loadFluxoCaixaRaw as loadFluxoCaixaData };

/**
 * Retorna um mapa de quais períodos têm dados no Redis: "YYYY_MM" -> true
 */
export async function loadFluxoCaixaIndex(): Promise<Record<string, boolean>> {
  try {
    const allKeys = await kvKeys('fluxo_caixa_*');
    const index: Record<string, boolean> = {};
    const PREFIX = 'fluxo_caixa_';
    for (const key of allKeys) {
      // Ignorar chaves do Comparativos e legadas
      if (key.includes('comparativo') || key === 'fluxo_caixa_raw_v2') continue;
      const suffix = key.replace(PREFIX, ''); // "2024_01"
      if (/^\d{4}_\d{2}$/.test(suffix)) {
        index[suffix] = true;
      }
    }
    return index;
  } catch (err) {
    console.error('Erro ao carregar índice do FluxoCaixa:', err);
    return {};
  }
}

