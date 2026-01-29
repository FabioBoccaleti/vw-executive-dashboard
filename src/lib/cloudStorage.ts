/**
 * Camada de persistência compartilhada - Redis via Vercel KV
 * 
 * Este módulo gerencia o armazenamento de dados compartilhados entre todos os usuários.
 * Usa Redis (Upstash) através das Vercel Functions para persistência na nuvem.
 * 
 * Fluxo:
 * 1. Frontend carrega dados do Redis via API
 * 2. Dados são cacheados localmente durante a sessão
 * 3. Ao importar, dados são salvos no Redis E no cache local
 * 4. Outros usuários veem os dados ao recarregar a página
 */

import { kvGet, kvSet, kvBulkSet, kvBulkGet, kvKeys, kvClearPattern, kvHasData } from './kvClient'
import type { MetricsData, DREData, Department, FatosRelevantesData } from './dataStorage'
import type { Brand } from './brands'
import { getSavedBrand } from './brands'

// Cache local para evitar múltiplas chamadas à API durante uma sessão
const localCache: Map<string, unknown> = new Map()

// Flag para indicar se está em modo online (Redis) ou offline (localStorage)
let isOnlineMode = true

/**
 * Verifica se a API está disponível
 */
export async function checkApiAvailability(): Promise<boolean> {
  try {
    const response = await fetch('/api/kv/keys?pattern=test')
    isOnlineMode = response.ok
    return isOnlineMode
  } catch {
    isOnlineMode = false
    return false
  }
}

/**
 * Obtém a marca atual
 */
function getCurrentBrand(brand?: Brand): Brand {
  return brand || getSavedBrand()
}

/**
 * Gera chave para métricas
 */
function getMetricsKey(fiscalYear: number, department: Department, brand: Brand): string {
  return `${brand}_metrics_${fiscalYear}_${department}`
}

/**
 * Gera chave para DRE
 */
function getDREKey(fiscalYear: number, department: Department, brand: Brand): string {
  return `${brand}_dre_${fiscalYear}_${department}`
}

/**
 * Gera chave para métricas compartilhadas
 */
function getSharedMetricsKey(fiscalYear: number, brand: Brand): string {
  return `${brand}_metrics_shared_${fiscalYear}`
}

/**
 * Gera chave para fatos relevantes
 */
function getFatosRelevantesKey(fiscalYear: number, department: Department, brand: Brand): string {
  return `${brand}_fatos_relevantes_${fiscalYear}_${department}`
}

// ============== FUNÇÕES DE LEITURA ==============

/**
 * Carrega dados de métricas do Redis
 */
export async function loadMetricsFromCloud(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<MetricsData | null> {
  const currentBrand = getCurrentBrand(brand)
  const key = getMetricsKey(fiscalYear, department, currentBrand)
  
  // Verifica cache local primeiro
  if (localCache.has(key)) {
    return localCache.get(key) as MetricsData
  }
  
  try {
    const data = await kvGet<MetricsData>(key)
    if (data) {
      localCache.set(key, data)
    }
    return data
  } catch (error) {
    console.error(`Erro ao carregar métricas do Redis: ${key}`, error)
    return null
  }
}

/**
 * Carrega dados de DRE do Redis
 */
export async function loadDREFromCloud(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<DREData | null> {
  const currentBrand = getCurrentBrand(brand)
  const key = getDREKey(fiscalYear, department, currentBrand)
  
  // Verifica cache local primeiro
  if (localCache.has(key)) {
    return localCache.get(key) as DREData
  }
  
  try {
    const data = await kvGet<DREData>(key)
    if (data) {
      localCache.set(key, data)
    }
    return data
  } catch (error) {
    console.error(`Erro ao carregar DRE do Redis: ${key}`, error)
    return null
  }
}

/**
 * Carrega dados compartilhados do Redis
 */
export async function loadSharedMetricsFromCloud(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  brand?: Brand
): Promise<MetricsData | null> {
  const currentBrand = getCurrentBrand(brand)
  const key = getSharedMetricsKey(fiscalYear, currentBrand)
  
  if (localCache.has(key)) {
    return localCache.get(key) as MetricsData
  }
  
  try {
    const data = await kvGet<MetricsData>(key)
    if (data) {
      localCache.set(key, data)
    }
    return data
  } catch (error) {
    console.error(`Erro ao carregar métricas compartilhadas do Redis: ${key}`, error)
    return null
  }
}

/**
 * Carrega fatos relevantes do Redis
 */
export async function loadFatosRelevantesFromCloud(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<FatosRelevantesData> {
  const currentBrand = getCurrentBrand(brand)
  const key = getFatosRelevantesKey(fiscalYear, department, currentBrand)
  
  if (localCache.has(key)) {
    return localCache.get(key) as FatosRelevantesData
  }
  
  try {
    const data = await kvGet<FatosRelevantesData>(key)
    if (data) {
      localCache.set(key, data)
      return data
    }
    return []
  } catch (error) {
    console.error(`Erro ao carregar fatos relevantes do Redis: ${key}`, error)
    return []
  }
}

// ============== FUNÇÕES DE ESCRITA ==============

/**
 * Salva dados de métricas no Redis
 */
export async function saveMetricsToCloud(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  data: MetricsData,
  department: Department,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  const key = getMetricsKey(fiscalYear, department, currentBrand)
  
  try {
    const success = await kvSet(key, data)
    if (success) {
      localCache.set(key, data)
      console.log(`✅ Métricas salvas no Redis: ${key}`)
    }
    return success
  } catch (error) {
    console.error(`Erro ao salvar métricas no Redis: ${key}`, error)
    return false
  }
}

/**
 * Salva dados de DRE no Redis
 */
export async function saveDREToCloud(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  data: DREData,
  department: Department,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  const key = getDREKey(fiscalYear, department, currentBrand)
  
  try {
    const success = await kvSet(key, data)
    if (success) {
      localCache.set(key, data)
      console.log(`✅ DRE salva no Redis: ${key}`)
    }
    return success
  } catch (error) {
    console.error(`Erro ao salvar DRE no Redis: ${key}`, error)
    return false
  }
}

/**
 * Salva dados compartilhados no Redis
 */
export async function saveSharedMetricsToCloud(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  data: MetricsData,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  const key = getSharedMetricsKey(fiscalYear, currentBrand)
  
  try {
    const success = await kvSet(key, data)
    if (success) {
      localCache.set(key, data)
      console.log(`✅ Métricas compartilhadas salvas no Redis: ${key}`)
    }
    return success
  } catch (error) {
    console.error(`Erro ao salvar métricas compartilhadas no Redis: ${key}`, error)
    return false
  }
}

/**
 * Salva fatos relevantes no Redis
 */
export async function saveFatosRelevantesToCloud(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  data: FatosRelevantesData,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  const key = getFatosRelevantesKey(fiscalYear, department, currentBrand)
  
  try {
    const success = await kvSet(key, data)
    if (success) {
      localCache.set(key, data)
      console.log(`✅ Fatos relevantes salvos no Redis: ${key}`)
    }
    return success
  } catch (error) {
    console.error(`Erro ao salvar fatos relevantes no Redis: ${key}`, error)
    return false
  }
}

// ============== IMPORTAÇÃO EM LOTE ==============

/**
 * Importa todos os dados para o Redis (usado na função de importação)
 */
export async function importAllDataToCloud(jsonString: string, brand?: Brand): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  
  try {
    console.log(`📥 Iniciando importação de dados para Redis - marca: ${currentBrand}...`)
    const backup = JSON.parse(jsonString)
    
    if (!backup.data) {
      console.error('❌ Formato de backup inválido: propriedade "data" não encontrada')
      return false
    }
    
    const items: Array<{ key: string; value: unknown }> = []
    
    // Preparar dados por departamento
    Object.entries(backup.data).forEach(([year, depts]: [string, any]) => {
      const fiscalYear = parseInt(year) as 2024 | 2025 | 2026 | 2027
      
      if (![2024, 2025, 2026, 2027].includes(fiscalYear)) {
        console.warn(`⚠️ Ano fiscal inválido ignorado: ${year}`)
        return
      }
      
      Object.entries(depts).forEach(([dept, data]: [string, any]) => {
        const department = dept as Department
        
        if (data.metrics) {
          const key = getMetricsKey(fiscalYear, department, currentBrand)
          items.push({ key, value: data.metrics })
          localCache.set(key, data.metrics)
        }
        
        if (data.dre) {
          const key = getDREKey(fiscalYear, department, currentBrand)
          items.push({ key, value: data.dre })
          localCache.set(key, data.dre)
        }
      })
    })
    
    // Preparar dados compartilhados
    if (backup.sharedData) {
      Object.entries(backup.sharedData).forEach(([year, data]: [string, any]) => {
        const fiscalYear = parseInt(year) as 2024 | 2025 | 2026 | 2027
        
        if (![2024, 2025, 2026, 2027].includes(fiscalYear)) return
        
        if (data.metrics) {
          const key = getSharedMetricsKey(fiscalYear, currentBrand)
          items.push({ key, value: data.metrics })
          localCache.set(key, data.metrics)
        }
      })
    }
    
    // Enviar todos os dados em uma única operação
    if (items.length > 0) {
      console.log(`📤 Enviando ${items.length} itens para o Redis...`)
      const success = await kvBulkSet(items)
      
      if (success) {
        console.log(`✅ Importação concluída: ${items.length} itens salvos no Redis`)
        return true
      } else {
        console.error('❌ Falha ao salvar dados no Redis')
        return false
      }
    }
    
    console.warn('⚠️ Nenhum dado encontrado para importar')
    return false
  } catch (error) {
    console.error('❌ Erro crítico ao importar dados para Redis:', error)
    return false
  }
}

// ============== UTILIDADES ==============

/**
 * Limpa o cache local
 */
export function clearLocalCache(): void {
  localCache.clear()
  console.log('🗑️ Cache local limpo')
}

/**
 * Limpa todos os dados de uma marca no Redis
 */
export async function clearAllCloudData(brand?: Brand): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  
  try {
    const success = await kvClearPattern(`${currentBrand}_*`)
    if (success) {
      // Limpa cache local também
      for (const key of localCache.keys()) {
        if (key.startsWith(`${currentBrand}_`)) {
          localCache.delete(key)
        }
      }
      console.log(`✅ Dados da marca ${currentBrand} limpos do Redis`)
    }
    return success
  } catch (error) {
    console.error(`Erro ao limpar dados do Redis: ${currentBrand}`, error)
    return false
  }
}

/**
 * Limpa dados de um ano específico no Redis
 */
export async function clearYearCloudData(fiscalYear: 2024 | 2025 | 2026 | 2027, brand?: Brand): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  
  try {
    const success = await kvClearPattern(`${currentBrand}_*_${fiscalYear}_*`)
    if (success) {
      // Limpa cache local também
      for (const key of localCache.keys()) {
        if (key.includes(`_${fiscalYear}_`)) {
          localCache.delete(key)
        }
      }
      console.log(`✅ Dados do ano ${fiscalYear} da marca ${currentBrand} limpos do Redis`)
    }
    return success
  } catch (error) {
    console.error(`Erro ao limpar dados do Redis: ${fiscalYear} - ${currentBrand}`, error)
    return false
  }
}

/**
 * Verifica se existem dados no Redis para uma marca
 */
export async function hasCloudData(brand?: Brand): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  return kvHasData(`${currentBrand}_*`)
}

/**
 * Pré-carrega todos os dados do Redis para o cache local
 * Útil para carregar tudo no início da sessão
 */
export async function preloadAllData(brand?: Brand): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  
  try {
    console.log(`📥 Pré-carregando dados do Redis para marca: ${currentBrand}...`)
    
    // Busca todas as chaves da marca
    const keys = await kvKeys(`${currentBrand}_*`)
    
    if (keys.length === 0) {
      console.log(`ℹ️ Nenhum dado encontrado no Redis para ${currentBrand}`)
      return true
    }
    
    // Carrega todos os dados de uma vez
    const data = await kvBulkGet(keys)
    
    // Armazena no cache local
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null) {
        localCache.set(key, value)
      }
    })
    
    console.log(`✅ ${keys.length} itens carregados do Redis para o cache local`)
    return true
  } catch (error) {
    console.error('Erro ao pré-carregar dados do Redis:', error)
    return false
  }
}

/**
 * Retorna o estado atual do modo online/offline
 */
export function isOnline(): boolean {
  return isOnlineMode
}

/**
 * Define o modo manualmente (útil para testes)
 */
export function setOnlineMode(online: boolean): void {
  isOnlineMode = online
}
