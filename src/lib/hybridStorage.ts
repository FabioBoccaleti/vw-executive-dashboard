/**
 * Módulo de integração entre localStorage e Redis (nuvem)
 * 
 * Este módulo fornece funções que:
 * 1. Tentam carregar dados do Redis primeiro
 * 2. Caem para localStorage se Redis não estiver disponível
 * 3. Na importação, salvam em ambos (Redis + localStorage)
 * 
 * Isso garante compatibilidade com o código existente enquanto
 * adiciona suporte a dados compartilhados na nuvem.
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

// ============== FUNÇÕES DE CARREGAMENTO (CLOUD-FIRST) ==============

/**
 * Carrega dados de métricas - tenta Redis primeiro, depois localStorage
 */
export async function loadMetricsFromCloudFirst(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<MetricsData | null> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_metrics_${fiscalYear}_${department}`
  
  // Verifica cache de sessão
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
      console.warn(`⚠️ Erro ao carregar do Redis, tentando localStorage: ${key}`)
    }
  }
  
  // Fallback para localStorage
  const localData = localStorage.getItem(key)
  if (localData) {
    try {
      const parsed = JSON.parse(localData)
      sessionCache.set(key, parsed)
      console.log(`💾 Métricas carregadas do localStorage: ${key}`)
      return parsed
    } catch (e) {
      console.error(`Erro ao parsear métricas do localStorage: ${key}`)
    }
  }
  
  return null
}

/**
 * Carrega dados de DRE - tenta Redis primeiro, depois localStorage
 */
export async function loadDREFromCloudFirst(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  department: Department,
  brand?: Brand
): Promise<DREData | null> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_dre_${fiscalYear}_${department}`
  
  // Verifica cache de sessão
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
      console.warn(`⚠️ Erro ao carregar DRE do Redis, tentando localStorage: ${key}`)
    }
  }
  
  // Fallback para localStorage
  const localData = localStorage.getItem(key)
  if (localData) {
    try {
      const parsed = JSON.parse(localData)
      sessionCache.set(key, parsed)
      console.log(`💾 DRE carregado do localStorage: ${key}`)
      return parsed
    } catch (e) {
      console.error(`Erro ao parsear DRE do localStorage: ${key}`)
    }
  }
  
  return null
}

/**
 * Carrega dados compartilhados - tenta Redis primeiro, depois localStorage
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
      console.warn(`⚠️ Erro ao carregar métricas compartilhadas do Redis`)
    }
  }
  
  // Fallback para localStorage
  const localData = localStorage.getItem(key)
  if (localData) {
    try {
      const parsed = JSON.parse(localData)
      sessionCache.set(key, parsed)
      return parsed
    } catch (e) {
      console.error(`Erro ao parsear métricas compartilhadas do localStorage`)
    }
  }
  
  return null
}

// ============== FUNÇÕES DE SALVAMENTO (CLOUD + LOCAL) ==============

/**
 * Salva dados de métricas - salva no Redis E no localStorage
 */
export async function saveMetricsToCloudAndLocal(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  data: MetricsData,
  department: Department,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_metrics_${fiscalYear}_${department}`
  
  // Salva no localStorage primeiro (garantia)
  try {
    localStorage.setItem(key, JSON.stringify(data))
    sessionCache.set(key, data)
  } catch (e) {
    console.error(`Erro ao salvar métricas no localStorage: ${key}`)
  }
  
  // Tenta salvar no Redis
  const isCloud = await checkCloudMode()
  if (isCloud) {
    try {
      const success = await kvSet(key, data)
      if (success) {
        console.log(`☁️ Métricas salvas no Redis: ${key}`)
        return true
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao salvar métricas no Redis: ${key}`)
    }
  }
  
  return true // localStorage foi salvo com sucesso
}

/**
 * Salva dados de DRE - salva no Redis E no localStorage
 */
export async function saveDREToCloudAndLocal(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  data: DREData,
  department: Department,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_dre_${fiscalYear}_${department}`
  
  // Salva no localStorage primeiro
  try {
    localStorage.setItem(key, JSON.stringify(data))
    sessionCache.set(key, data)
  } catch (e) {
    console.error(`Erro ao salvar DRE no localStorage: ${key}`)
  }
  
  // Tenta salvar no Redis
  const isCloud = await checkCloudMode()
  if (isCloud) {
    try {
      const success = await kvSet(key, data)
      if (success) {
        console.log(`☁️ DRE salvo no Redis: ${key}`)
        return true
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao salvar DRE no Redis: ${key}`)
    }
  }
  
  return true
}

/**
 * Salva dados compartilhados - salva no Redis E no localStorage
 */
export async function saveSharedMetricsToCloudAndLocal(
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  data: MetricsData,
  brand?: Brand
): Promise<boolean> {
  const currentBrand = getCurrentBrand(brand)
  const key = `${currentBrand}_metrics_shared_${fiscalYear}`
  
  // Salva no localStorage primeiro
  try {
    localStorage.setItem(key, JSON.stringify(data))
    sessionCache.set(key, data)
  } catch (e) {
    console.error(`Erro ao salvar métricas compartilhadas no localStorage`)
  }
  
  // Tenta salvar no Redis
  const isCloud = await checkCloudMode()
  if (isCloud) {
    try {
      const success = await kvSet(key, data)
      if (success) {
        console.log(`☁️ Métricas compartilhadas salvas no Redis: ${key}`)
        return true
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao salvar métricas compartilhadas no Redis`)
    }
  }
  
  return true
}

// ============== IMPORTAÇÃO EM LOTE ==============

/**
 * Importa todos os dados - salva no Redis E no localStorage
 * Retorna sucesso mesmo se apenas localStorage funcionar
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
    let localSaveSuccess = true
    
    // Processar dados por departamento
    Object.entries(backup.data).forEach(([year, depts]: [string, any]) => {
      const fiscalYear = parseInt(year) as 2024 | 2025 | 2026 | 2027
      
      if (![2024, 2025, 2026, 2027].includes(fiscalYear)) return
      
      Object.entries(depts).forEach(([dept, data]: [string, any]) => {
        const department = dept as Department
        
        if (data.metrics) {
          const key = `${currentBrand}_metrics_${fiscalYear}_${department}`
          
          // Salva no localStorage
          try {
            localStorage.setItem(key, JSON.stringify(data.metrics))
            sessionCache.set(key, data.metrics)
          } catch (e) {
            localSaveSuccess = false
          }
          
          // Prepara para Redis
          cloudItems.push({ key, value: data.metrics })
        }
        
        if (data.dre) {
          const key = `${currentBrand}_dre_${fiscalYear}_${department}`
          
          // Salva no localStorage
          try {
            localStorage.setItem(key, JSON.stringify(data.dre))
            sessionCache.set(key, data.dre)
          } catch (e) {
            localSaveSuccess = false
          }
          
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
          
          // Salva no localStorage
          try {
            localStorage.setItem(key, JSON.stringify(data.metrics))
            sessionCache.set(key, data.metrics)
          } catch (e) {
            localSaveSuccess = false
          }
          
          // Prepara para Redis
          cloudItems.push({ key, value: data.metrics })
        }
      })
    }
    
    // Tentar salvar no Redis
    let cloudSaveSuccess = false
    const isCloud = await checkCloudMode()
    
    if (isCloud && cloudItems.length > 0) {
      try {
        cloudSaveSuccess = await kvBulkSet(cloudItems)
        if (cloudSaveSuccess) {
          console.log(`☁️ ${cloudItems.length} itens salvos no Redis`)
        }
      } catch (error) {
        console.warn('⚠️ Erro ao salvar no Redis, mas localStorage foi salvo')
      }
    }
    
    console.log(`📊 Importação concluída:`)
    console.log(`  - localStorage: ${localSaveSuccess ? '✅' : '❌'}`)
    console.log(`  - Redis: ${cloudSaveSuccess ? '✅' : '⏭️ (não disponível)'}`)
    
    return {
      success: localSaveSuccess,
      cloudSaved: cloudSaveSuccess,
      localSaved: localSaveSuccess
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
 * Verifica se existem dados no localStorage para uma marca
 */
export function hasLocalData(brand?: Brand): boolean {
  const currentBrand = getCurrentBrand(brand)
  const keys = Object.keys(localStorage).filter(k => k.startsWith(`${currentBrand}_`))
  return keys.length > 0
}

/**
 * Verifica se existem dados (cloud ou local) para uma marca
 */
export async function hasAnyData(brand?: Brand): Promise<boolean> {
  const hasLocal = hasLocalData(brand)
  if (hasLocal) return true
  
  return await hasCloudData(brand)
}

// ============== LIMPEZA ==============

/**
 * Limpa todos os dados de uma marca (cloud + local)
 */
export async function clearAllDataCloudAndLocal(brand?: Brand): Promise<void> {
  const currentBrand = getCurrentBrand(brand)
  
  // Limpa localStorage
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(`${currentBrand}_`)) {
      localStorage.removeItem(key)
    }
  })
  
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
      console.warn('⚠️ Erro ao limpar Redis')
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
    console.log('☁️ Modo cloud não disponível, usando localStorage')
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
