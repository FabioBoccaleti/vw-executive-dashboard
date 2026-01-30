/**
 * Módulo de persistência de dados - Redis Database (Nuvem)
 * 
 * Este módulo fornece funções que:
 * 1. Carregam/salvam dados EXCLUSIVAMENTE no Redis (banco de dados)
 * 2. Usam cache de sessão (em memória) para performance
 * 3. NÃO usam localStorage para dados de negócio
 * 
 * IMPORTANTE: Dados são compartilhados entre todos os usuários via Redis.
 * O localStorage NÃO é usado para dados de métricas/DRE - apenas para 
 * preferências locais do usuário (como marca selecionada).
 */

import { kvGet, kvSet, kvBulkSet, kvBulkGet, kvKeys, kvClearPattern, kvHasData } from './kvClient'
import type { MetricsData, DREData, Department, FatosRelevantesData } from './dataStorage'
import type { Brand } from './brands'
import { getSavedBrand } from './brands'

// Cache local para sessão (evita múltiplas chamadas à API)
const sessionCache: Map<string, unknown> = new Map()

// Flag para indicar se estamos em modo cloud ou local
let cloudModeEnabled = true
let cloudModeChecked = false

/**
 * Verifica se o modo cloud está disponível
 */
async function checkCloudMode(): Promise<boolean> {
  if (cloudModeChecked) {
    return cloudModeEnabled
  }
  
  try {
    const response = await fetch('/api/kv/keys?pattern=test_connection', {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // Timeout de 3 segundos
    })
    cloudModeEnabled = response.ok
    cloudModeChecked = true
    console.log(`☁️ Modo cloud: ${cloudModeEnabled ? 'ATIVADO' : 'DESATIVADO'}`)
    return cloudModeEnabled
  } catch (error) {
    cloudModeEnabled = false
    cloudModeChecked = true
    console.log('☁️ Modo cloud: DESATIVADO (API não disponível)')
    return false
  }
}

/**
 * Obtém a marca atual
 */
function getCurrentBrand(brand?: Brand): Brand {
  return brand || getSavedBrand()
}

// ============== FUNÇÕES DE CARREGAMENTO (REDIS ONLY) ==============

/**
 * Carrega dados de métricas - EXCLUSIVAMENTE do Redis (banco de dados)
 * NÃO usa localStorage para dados de negócio
 */
export async function loadMetricsFromCloudFirst(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<MetricsData | null> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_metrics_${fiscalYear}_${department}`
  
  // Verifica cache de sessão (memória)
  if (sessionCache.has(key)) {
    return sessionCache.get(key) as MetricsData
  }
  
  const isCloud = await checkCloudMode()
  
  if (isCloud) {
    try {
      const cloudData = await kvGet<MetricsData>(key)
      if (cloudData) {
        sessionCache.set(key, cloudData)
        console.log(`☁️ Métricas carregadas do Redis: ${key}`)
        return cloudData
      }
    } catch (error) {
      console.error(`❌ Erro ao carregar métricas do Redis: ${key}`, error)
    }
  } else {
    console.warn(`⚠️ Redis não disponível - não foi possível carregar: ${key}`)
  }
  
  // SEM fallback para localStorage - dados devem vir do Redis
  return null
}

/**
 * Carrega dados de DRE - EXCLUSIVAMENTE do Redis (banco de dados)
 * NÃO usa localStorage para dados de negócio
 */
export async function loadDREFromCloudFirst(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<DREData | null> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_dre_${fiscalYear}_${department}`
  
  // Verifica cache de sessão (memória)
  if (sessionCache.has(key)) {
    return sessionCache.get(key) as DREData
  }
  
  const isCloud = await checkCloudMode()
  
  if (isCloud) {
    try {
      const cloudData = await kvGet<DREData>(key)
      if (cloudData) {
        sessionCache.set(key, cloudData)
        console.log(`☁️ DRE carregado do Redis: ${key}`)
        return cloudData
      }
    } catch (error) {
      console.error(`❌ Erro ao carregar DRE do Redis: ${key}`, error)
    }
  } else {
    console.warn(`⚠️ Redis não disponível - não foi possível carregar DRE: ${key}`)
  }
  
  // SEM fallback para localStorage - dados devem vir do Redis
  return null
}

/**
 * Carrega dados compartilhados - EXCLUSIVAMENTE do Redis (banco de dados)
 * NÃO usa localStorage para dados de negócio
 */
export async function loadSharedMetricsFromCloudFirst(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  brand?: Brand
): Promise<MetricsData | null> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_metrics_shared_${fiscalYear}`
  
  if (sessionCache.has(key)) {
    return sessionCache.get(key) as MetricsData
  }
  
  const isCloud = await checkCloudMode()
  
  if (isCloud) {
    try {
      const cloudData = await kvGet<MetricsData>(key)
      if (cloudData) {
        sessionCache.set(key, cloudData)
        console.log(`☁️ Métricas compartilhadas carregadas do Redis: ${key}`)
        return cloudData
      }
    } catch (error) {
      console.error(`❌ Erro ao carregar métricas compartilhadas do Redis: ${key}`, error)
    }
  } else {
    console.warn(`⚠️ Redis não disponível - não foi possível carregar compartilhados: ${key}`)
  }
  
  // SEM fallback para localStorage - dados devem vir do Redis
  return null
}

// ============== FUNÇÕES DE SALVAMENTO (REDIS ONLY) ==============

/**
 * Salva dados de métricas - EXCLUSIVAMENTE no Redis (banco de dados)
 * NÃO salva no localStorage para dados de negócio
 */
export async function saveMetricsToCloudAndLocal(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  data: MetricsData,
  department: Department,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_metrics_${fiscalYear}_${department}`
  
  // Atualiza cache de sessão (memória)
  sessionCache.set(key, data)
  
  // Tenta salvar no Redis
  const isCloud = await checkCloudMode()
  if (isCloud) {
    try {
      const success = await kvSet(key, data)
      if (success) {
        console.log(`☁️ Métricas salvas no Redis: ${key}`)
        return true
      } else {
        console.error(`❌ Falha ao salvar métricas no Redis: ${key}`)
        return false
      }
    } catch (error) {
      console.error(`❌ Erro ao salvar métricas no Redis: ${key}`, error)
      return false
    }
  }
  
  console.error(`❌ Redis não disponível - não foi possível salvar: ${key}`)
  return false
}

/**
 * Salva dados de DRE - EXCLUSIVAMENTE no Redis (banco de dados)
 * NÃO salva no localStorage para dados de negócio
 */
export async function saveDREToCloudAndLocal(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  data: DREData,
  department: Department,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_dre_${fiscalYear}_${department}`
  
  // Atualiza cache de sessão (memória)
  sessionCache.set(key, data)
  
  // Tenta salvar no Redis
  const isCloud = await checkCloudMode()
  if (isCloud) {
    try {
      const success = await kvSet(key, data)
      if (success) {
        console.log(`☁️ DRE salvo no Redis: ${key}`)
        return true
      } else {
        console.error(`❌ Falha ao salvar DRE no Redis: ${key}`)
        return false
      }
    } catch (error) {
      console.error(`❌ Erro ao salvar DRE no Redis: ${key}`, error)
      return false
    }
  }
  
  console.error(`❌ Redis não disponível - não foi possível salvar DRE: ${key}`)
  return false
}

/**
 * Salva dados compartilhados - EXCLUSIVAMENTE no Redis (banco de dados)
 * NÃO salva no localStorage para dados de negócio
 */
export async function saveSharedMetricsToCloudAndLocal(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  data: MetricsData,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_metrics_shared_${fiscalYear}`
  
  // Atualiza cache de sessão (memória)
  sessionCache.set(key, data)
  
  // Tenta salvar no Redis
  const isCloud = await checkCloudMode()
  if (isCloud) {
    try {
      const success = await kvSet(key, data)
      if (success) {
        console.log(`☁️ Métricas compartilhadas salvas no Redis: ${key}`)
        return true
      } else {
        console.error(`❌ Falha ao salvar métricas compartilhadas no Redis: ${key}`)
        return false
      }
    } catch (error) {
      console.error(`❌ Erro ao salvar métricas compartilhadas no Redis: ${key}`, error)
      return false
    }
  }
  
  console.error(`❌ Redis não disponível - não foi possível salvar compartilhados: ${key}`)
  return false
}

// ============== IMPORTAÇÃO EM LOTE ==============

/**
 * Importa todos os dados - EXCLUSIVAMENTE no Redis (banco de dados)
 * NÃO salva no localStorage para dados de negócio
 */
export async function importAllDataToCloudAndLocal(
  jsonString: string, 
  brand?: Brand
): Promise<{ success: boolean; cloudSaved: boolean; localSaved: boolean }> {
  const currentBrand = getCurrentBrand(brand)
  
  try {
    console.log(`📥 Iniciando importação de dados para ${currentBrand}...`)
    const backup = JSON.parse(jsonString)
    
    if (!backup.data) {
      console.error('❌ Formato de backup inválido')
      return { success: false, cloudSaved: false, localSaved: false }
    }
    
    const cloudItems: Array<{ key: string; value: unknown }> = []
    
    // Processar dados por departamento
    Object.entries(backup.data).forEach(([year, depts]: [string, any]) => {
      const fiscalYear = parseInt(year) as 2024 | 2025 | 2026 | 2027
      
      if (![2024, 2025, 2026, 2027].includes(fiscalYear)) return
      
      Object.entries(depts).forEach(([dept, data]: [string, any]) => {
        const department = dept as Department
        
        if (data.metrics) {
          const key = `${currentBrand}_metrics_${fiscalYear}_${department}`
          
          // Atualiza cache de sessão (memória)
          sessionCache.set(key, data.metrics)
          
          // Prepara para Redis
          cloudItems.push({ key, value: data.metrics })
        }
        
        if (data.dre) {
          const key = `${currentBrand}_dre_${fiscalYear}_${department}`
          
          // Atualiza cache de sessão (memória)
          sessionCache.set(key, data.dre)
          
          // Prepara para Redis
          cloudItems.push({ key, value: data.dre })
        }
      })
    })
    
    // Processar dados compartilhados
    if (backup.sharedData) {
      Object.entries(backup.sharedData).forEach(([year, data]: [string, any]) => {
        const fiscalYear = parseInt(year) as 2024 | 2025 | 2026 | 2027
        
        if (![2024, 2025, 2026, 2027].includes(fiscalYear)) return
        
        if (data.metrics) {
          const key = `${currentBrand}_metrics_shared_${fiscalYear}`
          
          // Atualiza cache de sessão (memória)
          sessionCache.set(key, data.metrics)
          
          // Prepara para Redis
          cloudItems.push({ key, value: data.metrics })
        }
      })
    }
    
    // Salvar EXCLUSIVAMENTE no Redis
    let cloudSaveSuccess = false
    const isCloud = await checkCloudMode()
    
    if (isCloud && cloudItems.length > 0) {
      try {
        cloudSaveSuccess = await kvBulkSet(cloudItems)
        if (cloudSaveSuccess) {
          console.log(`☁️ ${cloudItems.length} itens salvos no Redis`)
        } else {
          console.error('❌ Falha ao salvar itens no Redis')
        }
      } catch (error) {
        console.error('❌ Erro ao salvar no Redis:', error)
      }
    } else if (!isCloud) {
      console.error('❌ Redis não disponível - importação não foi salva no banco de dados')
    }
    
    console.log(`📊 Importação concluída:`)
    console.log(`  - Redis: ${cloudSaveSuccess ? '✅' : '❌ FALHOU'}`)
    console.log(`  - Cache de sessão: ✅`)
    
    return {
      success: cloudSaveSuccess,
      cloudSaved: cloudSaveSuccess,
      localSaved: true // Cache de sessão sempre funciona
    }
  } catch (error) {
    console.error('❌ Erro crítico na importação:', error)
    return { success: false, cloudSaved: false, localSaved: false }
  }
}

// ============== VERIFICAÇÃO DE DADOS ==============

/**
 * Verifica se existem dados no Redis para uma marca
 */
export async function hasCloudData(brand?: Brand): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  
  const isCloud = await checkCloudMode()
  if (!isCloud) return false
  
  try {
    return await kvHasData(`${currentBrand}_*`)
  } catch {
    return false
  }
}

/**
 * Verifica se existem dados (SOMENTE no Redis) para uma marca
 * NÃO verifica localStorage para dados de negócio
 */
export async function hasAnyData(brand?: Brand): Promise<boolean> {
  return await hasCloudData(brand)
}

// ============== LIMPEZA ==============

/**
 * Limpa todos os dados de uma marca (Redis + cache de sessão)
 * NÃO gerencia dados no localStorage (não usamos para dados de negócio)
 */
export async function clearAllDataCloudAndLocal(brand?: Brand): Promise<void> {
  const currentBrand = getCurrentBrand(brand)
  
  // Limpa cache de sessão
  for (const key of sessionCache.keys()) {
    if (key.startsWith(`${currentBrand}_`)) {
      sessionCache.delete(key)
    }
  }
  
  // Limpa Redis
  const isCloud = await checkCloudMode()
  if (isCloud) {
    try {
      await kvClearPattern(`${currentBrand}_*`)
      console.log(`☁️ Dados limpos do Redis para ${currentBrand}`)
    } catch (error) {
      console.error('❌ Erro ao limpar Redis:', error)
    }
  }
  
  console.log(`✅ Dados de ${currentBrand} limpos`)
}

// ============== PRÉ-CARREGAMENTO ==============

/**
 * Pré-carrega todos os dados do Redis para o cache de sessão
 * Chamado no início da aplicação
 */
export async function preloadFromCloud(brand?: Brand): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  
  const isCloud = await checkCloudMode()
  if (!isCloud) {
    console.warn('⚠️ Redis não disponível - dados não serão carregados')
    return false
  }
  
  try {
    console.log(`☁️ Pré-carregando dados do Redis para ${currentBrand}...`)
    
    // Busca todas as chaves
    const keys = await kvKeys(`${currentBrand}_*`)
    
    if (keys.length === 0) {
      console.log(`ℹ️ Nenhum dado no Redis para ${currentBrand}`)
      return true
    }
    
    // Carrega todos os dados
    const data = await kvBulkGet(keys)
    
    // Armazena no cache de sessão
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null) {
        sessionCache.set(key, value)
      }
    })
    
    console.log(`☁️ ${keys.length} itens carregados do Redis`)
    return true
  } catch (error) {
    console.error('❌ Erro ao pré-carregar do Redis:', error)
    return false
  }
}

/**
 * Limpa o cache de sessão
 */
export function clearSessionCache(): void {
  sessionCache.clear()
  console.log('🗑️ Cache de sessão limpo')
}

/**
 * Força rechecagem do modo cloud
 */
export function resetCloudModeCheck(): void {
  cloudModeChecked = false
}

/**
 * Retorna se o modo cloud está ativo
 */
export function isCloudMode(): boolean {
  return cloudModeEnabled
}
