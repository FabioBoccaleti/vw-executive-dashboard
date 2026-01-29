/**
 * Cliente de API para comunicação com o Redis via Vercel Functions
 * 
 * Este módulo abstrai as chamadas HTTP para o backend Redis,
 * permitindo que o frontend leia e escreva dados compartilhados.
 */

// Determina a URL base da API
const getApiBaseUrl = (): string => {
  // Em produção, usa a mesma origem
  // Em desenvolvimento, pode usar localhost ou a URL da Vercel
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return ''
}

/**
 * Obtém um valor do Redis
 */
export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/get?key=${encodeURIComponent(key)}`)
    
    if (!response.ok) {
      console.error(`KV GET error: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    return data.value as T | null
  } catch (error) {
    console.error('KV GET error:', error)
    return null
  }
}

/**
 * Define um valor no Redis
 */
export async function kvSet(key: string, value: unknown): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, value }),
    })
    
    if (!response.ok) {
      console.error(`KV SET error: ${response.status}`)
      return false
    }
    
    return true
  } catch (error) {
    console.error('KV SET error:', error)
    return false
  }
}

/**
 * Remove um valor do Redis
 */
export async function kvDelete(key: string): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/delete?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      console.error(`KV DELETE error: ${response.status}`)
      return false
    }
    
    return true
  } catch (error) {
    console.error('KV DELETE error:', error)
    return false
  }
}

/**
 * Lista todas as chaves que correspondem a um padrão
 */
export async function kvKeys(pattern: string = '*'): Promise<string[]> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/keys?pattern=${encodeURIComponent(pattern)}`)
    
    if (!response.ok) {
      console.error(`KV KEYS error: ${response.status}`)
      return []
    }
    
    const data = await response.json()
    return data.keys || []
  } catch (error) {
    console.error('KV KEYS error:', error)
    return []
  }
}

/**
 * Define múltiplos valores de uma vez (otimizado para importação)
 */
export async function kvBulkSet(items: Array<{ key: string; value: unknown }>): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/bulk-set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    })
    
    if (!response.ok) {
      console.error(`KV BULK SET error: ${response.status}`)
      return false
    }
    
    return true
  } catch (error) {
    console.error('KV BULK SET error:', error)
    return false
  }
}

/**
 * Obtém múltiplos valores de uma vez
 */
export async function kvBulkGet<T = unknown>(keys: string[]): Promise<Record<string, T | null>> {
  try {
    if (keys.length === 0) {
      return {}
    }
    
    const response = await fetch(`${getApiBaseUrl()}/api/kv/bulk-get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keys }),
    })
    
    if (!response.ok) {
      console.error(`KV BULK GET error: ${response.status}`)
      return {}
    }
    
    const data = await response.json()
    return data.data || {}
  } catch (error) {
    console.error('KV BULK GET error:', error)
    return {}
  }
}

/**
 * Remove todas as chaves que correspondem a um padrão
 */
export async function kvClearPattern(pattern: string): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/kv/clear-pattern?pattern=${encodeURIComponent(pattern)}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      console.error(`KV CLEAR PATTERN error: ${response.status}`)
      return false
    }
    
    return true
  } catch (error) {
    console.error('KV CLEAR PATTERN error:', error)
    return false
  }
}

/**
 * Verifica se existe dados no Redis
 */
export async function kvHasData(pattern: string = 'vw_*'): Promise<boolean> {
  const keys = await kvKeys(pattern)
  return keys.length > 0
}
