/**
 * Hook para gerenciar dados na nuvem (Redis)
 * 
 * Este hook fornece uma interface simples para carregar e verificar
 * se existem dados no Redis, além de gerenciar o estado de carregamento.
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  hasCloudData, 
  preloadAllData, 
  checkApiAvailability,
  isOnline,
  clearLocalCache
} from '../lib/cloudStorage'
import { getSavedBrand } from '../lib/brands'

interface UseCloudDataReturn {
  /** Se os dados estão sendo carregados */
  isLoading: boolean
  /** Se existem dados no Redis */
  hasData: boolean
  /** Se a API está disponível */
  isApiAvailable: boolean
  /** Se houve erro ao carregar */
  error: string | null
  /** Recarrega os dados do Redis */
  reload: () => Promise<void>
  /** Verifica se há dados */
  checkData: () => Promise<boolean>
}

export function useCloudData(): UseCloudDataReturn {
  const [isLoading, setIsLoading] = useState(true)
  const [hasData, setHasData] = useState(false)
  const [isApiAvailable, setIsApiAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkData = useCallback(async (): Promise<boolean> => {
    const brand = getSavedBrand()
    const result = await hasCloudData(brand)
    setHasData(result)
    return result
  }, [])

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Limpa cache local antes de recarregar
      clearLocalCache()
      
      const brand = getSavedBrand()
      
      // Verifica se a API está disponível
      const apiOk = await checkApiAvailability()
      setIsApiAvailable(apiOk)
      
      if (!apiOk) {
        console.warn('⚠️ API não disponível, usando modo offline')
        setHasData(false)
        return
      }
      
      // Verifica se há dados
      const hasDataInCloud = await hasCloudData(brand)
      setHasData(hasDataInCloud)
      
      // Se há dados, pré-carrega tudo
      if (hasDataInCloud) {
        await preloadAllData(brand)
        console.log('✅ Dados da nuvem carregados com sucesso')
      }
    } catch (err) {
      console.error('Erro ao carregar dados da nuvem:', err)
      setError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Carrega dados ao montar o componente
  useEffect(() => {
    reload()
  }, [reload])

  return {
    isLoading,
    hasData,
    isApiAvailable,
    error,
    reload,
    checkData
  }
}
