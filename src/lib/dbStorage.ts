/**
 * Camada de persistência de dados - Redis Database (Produção) / localStorage (Desenvolvimento)
 * 
 * Em PRODUÇÃO: dados vêm exclusivamente do banco de dados Redis (Vercel KV)
 * Em DESENVOLVIMENTO: usa localStorage para testes locais
 */

import { kvGet, kvSet, kvBulkGet, kvKeys } from './kvClient';
import { type Brand, getSavedBrand } from './brands';
import { type MetricsData, type DREData, type Department, createEmptyMetricsData } from './dataStorage';

// Cache local para evitar múltiplas requisições ao banco
const dataCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Verifica se está em ambiente de produção
 */
export function isProduction(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.includes('vercel.app') || 
         hostname.includes('.vercel.app') ||
         !hostname.includes('localhost');
}

/**
 * Obtém dados do cache ou do banco
 */
async function getCachedData<T>(key: string): Promise<T | null> {
  const cached = dataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  
  const data = await kvGet<T>(key);
  if (data) {
    dataCache.set(key, { data, timestamp: Date.now() });
  }
  return data;
}

/**
 * Salva dados no banco e atualiza cache
 */
async function setCachedData(key: string, value: any): Promise<boolean> {
  const success = await kvSet(key, value);
  if (success) {
    dataCache.set(key, { data: value, timestamp: Date.now() });
  }
  return success;
}

/**
 * Limpa o cache local
 */
export function clearCache(): void {
  dataCache.clear();
}

/**
 * Obtém a marca atual
 */
function getCurrentBrand(brand?: Brand): Brand {
  return brand || getSavedBrand();
}

// =====================================================
// FUNÇÕES ASSÍNCRONAS PARA CARREGAR DO BANCO DE DADOS
// =====================================================

/**
 * Carrega os dados de métricas do banco de dados
 */
export async function loadMetricsDataAsync(
  fiscalYear: 2024 | 2025 | 2026 | 2027, 
  department: Department = 'usados', 
  brand?: Brand
): Promise<MetricsData | null> {
  const currentBrand = getCurrentBrand(brand);
  
  // Se for consolidado, calcula dinamicamente
  if (department === 'consolidado') {
    return calculateConsolidatedDataAsync(fiscalYear, currentBrand);
  }
  
  const key = `${currentBrand}_metrics_${fiscalYear}_${department}`;
  console.log(`📥 [DB] Carregando métricas: ${key}`);
  
  const data = await getCachedData<MetricsData>(key);
  
  if (data) {
    console.log(`✅ [DB] Métricas carregadas: ${key}`);
    return data;
  }
  
  console.log(`⚠️ [DB] Métricas não encontradas: ${key}`);
  return null;
}

/**
 * Carrega os dados de métricas compartilhadas do banco de dados
 */
export async function loadSharedMetricsDataAsync(
  fiscalYear: 2024 | 2025 | 2026 | 2027, 
  brand?: Brand
): Promise<MetricsData | null> {
  const currentBrand = getCurrentBrand(brand);
  const key = `${currentBrand}_metrics_shared_${fiscalYear}`;
  
  console.log(`📥 [DB] Carregando dados compartilhados: ${key}`);
  
  const data = await getCachedData<MetricsData>(key);
  
  if (data) {
    console.log(`✅ [DB] Dados compartilhados carregados: ${key}`);
    return data;
  }
  
  console.log(`⚠️ [DB] Dados compartilhados não encontrados: ${key}`);
  return null;
}

/**
 * Carrega os dados de DRE do banco de dados
 */
export async function loadDREDataAsync(
  fiscalYear: 2024 | 2025 | 2026 | 2027, 
  department: Department = 'usados', 
  brand?: Brand
): Promise<DREData | null> {
  const currentBrand = getCurrentBrand(brand);
  
  // Se for consolidado, calcula dinamicamente
  if (department === 'consolidado') {
    return calculateConsolidatedDREAsync(fiscalYear, currentBrand);
  }
  
  const key = `${currentBrand}_dre_${fiscalYear}_${department}`;
  console.log(`📥 [DB] Carregando DRE: ${key}`);
  
  const data = await getCachedData<DREData>(key);
  
  if (data) {
    console.log(`✅ [DB] DRE carregada: ${key}`);
    return data;
  }
  
  console.log(`⚠️ [DB] DRE não encontrada: ${key}`);
  return null;
}

/**
 * Salva os dados de métricas no banco de dados
 */
export async function saveMetricsDataAsync(
  fiscalYear: 2024 | 2025 | 2026 | 2027, 
  data: MetricsData, 
  department: Department = 'usados', 
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand);
  
  if (department === 'consolidado') {
    console.warn('Não é possível salvar dados do consolidado diretamente');
    return false;
  }
  
  const key = `${currentBrand}_metrics_${fiscalYear}_${department}`;
  console.log(`💾 [DB] Salvando métricas: ${key}`);
  
  const success = await setCachedData(key, data);
  
  if (success) {
    console.log(`✅ [DB] Métricas salvas: ${key}`);
  } else {
    console.error(`❌ [DB] Erro ao salvar métricas: ${key}`);
  }
  
  return success;
}

/**
 * Salva os dados de métricas compartilhadas no banco de dados
 */
export async function saveSharedMetricsDataAsync(
  fiscalYear: 2024 | 2025 | 2026 | 2027, 
  data: MetricsData, 
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand);
  const key = `${currentBrand}_metrics_shared_${fiscalYear}`;
  
  console.log(`💾 [DB] Salvando dados compartilhados: ${key}`);
  
  const success = await setCachedData(key, data);
  
  if (success) {
    console.log(`✅ [DB] Dados compartilhados salvos: ${key}`);
  } else {
    console.error(`❌ [DB] Erro ao salvar dados compartilhados: ${key}`);
  }
  
  return success;
}

/**
 * Salva os dados de DRE no banco de dados
 */
export async function saveDREDataAsync(
  fiscalYear: 2024 | 2025 | 2026 | 2027, 
  data: DREData, 
  department: Department = 'usados', 
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand);
  const key = `${currentBrand}_dre_${fiscalYear}_${department}`;
  
  console.log(`💾 [DB] Salvando DRE: ${key}`);
  
  const success = await setCachedData(key, data);
  
  if (success) {
    console.log(`✅ [DB] DRE salva: ${key}`);
  } else {
    console.error(`❌ [DB] Erro ao salvar DRE: ${key}`);
  }
  
  return success;
}

/**
 * Calcula dados consolidados de todos os departamentos
 */
async function calculateConsolidatedDataAsync(
  fiscalYear: 2024 | 2025 | 2026 | 2027, 
  brand: Brand
): Promise<MetricsData | null> {
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
  
  // Carrega todos os departamentos em paralelo
  const allData = await Promise.all(
    departments.map(dept => loadMetricsDataAsync(fiscalYear, dept, brand))
  );
  
  const validData = allData.filter(d => d !== null) as MetricsData[];
  
  if (validData.length === 0) {
    console.log(`⚠️ [DB] Nenhum dado encontrado para consolidar: ${fiscalYear}`);
    return null;
  }
  
  // Consolida os dados somando os arrays
  // (implementação simplificada - pode precisar de ajustes)
  return validData[0]; // Por enquanto retorna o primeiro
}

/**
 * Calcula DRE consolidada de todos os departamentos
 */
async function calculateConsolidatedDREAsync(
  fiscalYear: 2024 | 2025 | 2026 | 2027, 
  brand: Brand
): Promise<DREData | null> {
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
  
  // Carrega todos os departamentos em paralelo
  const allDREs = await Promise.all(
    departments.map(dept => loadDREDataAsync(fiscalYear, dept, brand))
  );
  
  const validDREs = allDREs.filter(d => d !== null) as DREData[];
  
  if (validDREs.length === 0) {
    return null;
  }
  
  // Pega a estrutura da primeira DRE
  const firstDRE = validDREs[0];
  
  // Soma os valores de cada linha
  const consolidated: DREData = firstDRE.map((line, index) => {
    const meses = line.meses || [];
    const summedMeses = meses.map((_, monthIndex) => {
      return validDREs.reduce((sum, dre) => {
        const dreValue = dre[index]?.meses?.[monthIndex] || 0;
        return sum + dreValue;
      }, 0);
    });
    
    return {
      ...line,
      meses: summedMeses
    };
  });
  
  return consolidated;
}

/**
 * Verifica se há dados no banco de dados
 */
export async function hasStoredDataAsync(
  fiscalYear: 2024 | 2025 | 2026 | 2027, 
  department: Department = 'usados', 
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand);
  const keys = await kvKeys(`${currentBrand}_*_${fiscalYear}_${department}`);
  return keys.length > 0;
}

/**
 * Lista todas as chaves disponíveis no banco
 */
export async function listAllKeysAsync(brand?: Brand): Promise<string[]> {
  const currentBrand = getCurrentBrand(brand);
  return kvKeys(`${currentBrand}_*`);
}

/**
 * Pré-carrega todos os dados para cache
 */
export async function preloadAllDataAsync(brand?: Brand): Promise<void> {
  const currentBrand = getCurrentBrand(brand);
  const years: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027];
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
  
  console.log(`📥 [DB] Pré-carregando todos os dados para ${currentBrand}...`);
  
  // Carrega todas as métricas em paralelo
  const metricsPromises = years.flatMap(year => 
    departments.map(dept => loadMetricsDataAsync(year, dept, currentBrand))
  );
  
  // Carrega todos os dados compartilhados em paralelo
  const sharedPromises = years.map(year => 
    loadSharedMetricsDataAsync(year, currentBrand)
  );
  
  await Promise.all([...metricsPromises, ...sharedPromises]);
  
  console.log(`✅ [DB] Pré-carregamento concluído para ${currentBrand}`);
}
