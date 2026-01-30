/**
 * Hook para carregar dados do banco de dados em produção
 * 
 * Este hook gerencia o carregamento de dados do Redis em produção
 * e fornece estados de loading/error para a UI.
 */

import { useState, useEffect, useCallback } from 'react';
import { kvGet, kvSet, kvKeys } from './kvClient';
import { type Brand, getSavedBrand } from './brands';
import { type MetricsData, type DREData, type Department } from './dataStorage';

// =====================================================
// CONFIGURAÇÃO
// =====================================================

/**
 * Verifica se está em ambiente de produção (Vercel)
 */
export function isProduction(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.includes('vercel.app') || 
         (!hostname.includes('localhost') && !hostname.includes('127.0.0.1'));
}

// Cache global para dados do banco
const globalCache: Map<string, any> = new Map();

// =====================================================
// FUNÇÕES DE ACESSO AO BANCO
// =====================================================

/**
 * Carrega métricas do banco de dados
 */
export async function fetchMetricsFromDb(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<MetricsData | null> {
  const currentBrand = brand || getSavedBrand();
  const key = `${currentBrand}_metrics_${fiscalYear}_${department}`;
  
  // Verifica cache primeiro
  if (globalCache.has(key)) {
    return globalCache.get(key);
  }
  
  console.log(`📥 [DB] Buscando: ${key}`);
  const data = await kvGet<MetricsData>(key);
  
  if (data) {
    globalCache.set(key, data);
    console.log(`✅ [DB] Encontrado: ${key}`);
  } else {
    console.log(`⚠️ [DB] Não encontrado: ${key}`);
  }
  
  return data;
}

/**
 * Carrega métricas compartilhadas do banco de dados
 */
export async function fetchSharedMetricsFromDb(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  brand?: Brand
): Promise<MetricsData | null> {
  const currentBrand = brand || getSavedBrand();
  const key = `${currentBrand}_metrics_shared_${fiscalYear}`;
  
  if (globalCache.has(key)) {
    return globalCache.get(key);
  }
  
  console.log(`📥 [DB] Buscando compartilhados: ${key}`);
  const data = await kvGet<MetricsData>(key);
  
  if (data) {
    globalCache.set(key, data);
    console.log(`✅ [DB] Encontrado compartilhados: ${key}`);
  }
  
  return data;
}

/**
 * Carrega DRE do banco de dados
 */
export async function fetchDREFromDb(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<DREData | null> {
  const currentBrand = brand || getSavedBrand();
  const key = `${currentBrand}_dre_${fiscalYear}_${department}`;
  
  if (globalCache.has(key)) {
    return globalCache.get(key);
  }
  
  console.log(`📥 [DB] Buscando DRE: ${key}`);
  const data = await kvGet<DREData>(key);
  
  if (data) {
    globalCache.set(key, data);
    console.log(`✅ [DB] Encontrado DRE: ${key}`);
  }
  
  return data;
}

/**
 * Salva métricas no banco de dados
 */
export async function saveMetricsToDb(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  data: MetricsData,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = brand || getSavedBrand();
  const key = `${currentBrand}_metrics_${fiscalYear}_${department}`;
  
  console.log(`💾 [DB] Salvando: ${key}`);
  const success = await kvSet(key, data);
  
  if (success) {
    globalCache.set(key, data);
    console.log(`✅ [DB] Salvo: ${key}`);
  } else {
    console.error(`❌ [DB] Erro ao salvar: ${key}`);
  }
  
  return success;
}

/**
 * Salva métricas compartilhadas no banco de dados
 */
export async function saveSharedMetricsToDb(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  data: MetricsData,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = brand || getSavedBrand();
  const key = `${currentBrand}_metrics_shared_${fiscalYear}`;
  
  console.log(`💾 [DB] Salvando compartilhados: ${key}`);
  const success = await kvSet(key, data);
  
  if (success) {
    globalCache.set(key, data);
    console.log(`✅ [DB] Salvo compartilhados: ${key}`);
  }
  
  return success;
}

/**
 * Salva DRE no banco de dados
 */
export async function saveDREToDb(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  data: DREData,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = brand || getSavedBrand();
  const key = `${currentBrand}_dre_${fiscalYear}_${department}`;
  
  console.log(`💾 [DB] Salvando DRE: ${key}`);
  const success = await kvSet(key, data);
  
  if (success) {
    globalCache.set(key, data);
    console.log(`✅ [DB] Salvo DRE: ${key}`);
  }
  
  return success;
}

/**
 * Limpa o cache global
 */
export function clearGlobalCache(): void {
  globalCache.clear();
  console.log('🗑️ [DB] Cache limpo');
}

/**
 * Pré-carrega todos os dados do banco
 */
export async function preloadAllData(brand?: Brand): Promise<void> {
  const currentBrand = brand || getSavedBrand();
  const years: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027];
  const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao'];
  
  console.log(`📥 [DB] Pré-carregando dados para ${currentBrand}...`);
  
  const promises: Promise<any>[] = [];
  
  for (const year of years) {
    for (const dept of departments) {
      promises.push(fetchMetricsFromDb(year, dept, currentBrand));
    }
    promises.push(fetchSharedMetricsFromDb(year, currentBrand));
  }
  
  await Promise.all(promises);
  console.log(`✅ [DB] Pré-carregamento concluído`);
}

// =====================================================
// HOOK REACT
// =====================================================

interface UseDbDataOptions {
  fiscalYear: 2024 | 2025 | 2026 | 2027;
  department: Department;
  brand?: Brand;
  autoLoad?: boolean;
}

interface UseDbDataResult {
  metrics: MetricsData | null;
  sharedMetrics: MetricsData | null;
  dre: DREData | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  saveMetrics: (data: MetricsData) => Promise<boolean>;
  saveSharedMetrics: (data: MetricsData) => Promise<boolean>;
  saveDRE: (data: DREData) => Promise<boolean>;
}

/**
 * Hook para carregar e gerenciar dados do banco
 */
export function useDbData(options: UseDbDataOptions): UseDbDataResult {
  const { fiscalYear, department, brand, autoLoad = true } = options;
  
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [sharedMetrics, setSharedMetrics] = useState<MetricsData | null>(null);
  const [dre, setDRE] = useState<DREData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const currentBrand = brand || getSavedBrand();
  
  const reload = useCallback(async () => {
    if (!isProduction()) {
      console.log('⚠️ [DB] Modo desenvolvimento - usando localStorage');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const [metricsData, sharedData, dreData] = await Promise.all([
        fetchMetricsFromDb(fiscalYear, department, currentBrand),
        fetchSharedMetricsFromDb(fiscalYear, currentBrand),
        fetchDREFromDb(fiscalYear, department, currentBrand)
      ]);
      
      setMetrics(metricsData);
      setSharedMetrics(sharedData);
      setDRE(dreData);
    } catch (err) {
      console.error('❌ [DB] Erro ao carregar dados:', err);
      setError(err instanceof Error ? err : new Error('Erro ao carregar dados'));
    } finally {
      setLoading(false);
    }
  }, [fiscalYear, department, currentBrand]);
  
  useEffect(() => {
    if (autoLoad) {
      reload();
    }
  }, [autoLoad, reload]);
  
  const saveMetrics = useCallback(async (data: MetricsData): Promise<boolean> => {
    const success = await saveMetricsToDb(fiscalYear, department, data, currentBrand);
    if (success) {
      setMetrics(data);
    }
    return success;
  }, [fiscalYear, department, currentBrand]);
  
  const saveSharedMetrics = useCallback(async (data: MetricsData): Promise<boolean> => {
    const success = await saveSharedMetricsToDb(fiscalYear, data, currentBrand);
    if (success) {
      setSharedMetrics(data);
    }
    return success;
  }, [fiscalYear, currentBrand]);
  
  const saveDRE = useCallback(async (data: DREData): Promise<boolean> => {
    const success = await saveDREToDb(fiscalYear, department, data, currentBrand);
    if (success) {
      setDRE(data);
    }
    return success;
  }, [fiscalYear, department, currentBrand]);
  
  return {
    metrics,
    sharedMetrics,
    dre,
    loading,
    error,
    reload,
    saveMetrics,
    saveSharedMetrics,
    saveDRE
  };
}
