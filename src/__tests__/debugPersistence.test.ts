/**
 * Teste de Debug - Verificar exatamente o que está acontecendo na persistência
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  importAllData,
  exportAllData,
  loadDREData,
  saveMetricsData,
  saveDREData,
  type DREData
} from '../lib/dataStorage'

describe('Debug Persistência - Simulando Comportamento Real', () => {
  beforeEach(() => {
    localStorage.clear()
    console.log('🧹 localStorage limpo para teste')
  })

  it('TESTE 1: Verificar se importAllData realmente salva no localStorage', () => {
    console.log('\n📋 TESTE 1: Importar e verificar salvamento imediato')
    
    // Criar backup de teste
    const testBackup = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        appName: 'VW Financial Dashboard'
      },
      selectedYear: 2025,
      selectedDepartment: 'usados',
      data: {
        2025: {
          usados: {
            dre: [
              {
                descricao: 'RECEITA OPERACIONAL LIQUIDA',
                total: 103924692,
                percentTotal: 100.00,
                meses: [8328316, 8483342, 7902231, 7138470, 7226733, 8336360, 10485005, 10826922, 8927513, 9761159, 8538082, 7970559]
              },
              {
                descricao: 'CUSTO OPERACIONAL DA RECEITA',
                total: -93362263,
                percentTotal: -89.84,
                meses: [-7522040, -7678110, -7045472, -6372037, -6449322, -7476002, -9519413, -9749142, -7996935, -8757551, -8038680, -7757559]
              }
            ]
          }
        }
      }
    }

    // Importar
    console.log('📥 Importando dados...')
    const success = importAllData(JSON.stringify(testBackup))
    
    console.log(`✅ importAllData retornou: ${success}`)
    expect(success).toBe(true)

    // VERIFICAR IMEDIATAMENTE NO LOCALSTORAGE
    console.log('\n🔍 Verificando localStorage IMEDIATAMENTE após importação:')
    const allKeys = Object.keys(localStorage)
    const vwKeys = allKeys.filter(k => k.startsWith('vw_'))
    
    console.log(`  Total de chaves: ${allKeys.length}`)
    console.log(`  Chaves VW: ${vwKeys.length}`)
    console.log(`  Chaves VW encontradas:`, vwKeys)

    // Verificar chave específica
    const dreKey = 'vw_dre_2025_usados'
    const dreInStorage = localStorage.getItem(dreKey)
    
    console.log(`\n🎯 Verificando chave específica: ${dreKey}`)
    console.log(`  Existe no localStorage: ${dreInStorage !== null ? '✅ SIM' : '❌ NÃO'}`)
    
    if (dreInStorage) {
      const parsed = JSON.parse(dreInStorage)
      console.log(`  Tipo: ${Array.isArray(parsed) ? 'Array' : typeof parsed}`)
      console.log(`  Tamanho: ${parsed.length}`)
      console.log(`  Primeira linha:`, parsed[0])
    } else {
      console.log('  ❌ PROBLEMA: Dados não foram salvos!')
    }

    // Assertions
    expect(dreInStorage).not.toBeNull()
    expect(vwKeys.length).toBeGreaterThan(0)
  })

  it('TESTE 2: Simular reload - Carregar dados após salvar', () => {
    console.log('\n📋 TESTE 2: Ciclo completo - Salvar e Recarregar')
    
    const testDRE: DREData = [
      {
        descricao: 'VOLUME DE VENDAS',
        total: 1356,
        percentTotal: null,
        meses: [116, 100, 94, 98, 83, 117, 137, 141, 126, 126, 124, 94]
      },
      {
        descricao: 'RECEITA OPERACIONAL LIQUIDA',
        total: 103924692,
        percentTotal: 100.00,
        meses: [8328316, 8483342, 7902231, 7138470, 7226733, 8336360, 10485005, 10826922, 8927513, 9761159, 8538082, 7970559]
      }
    ]

    // Salvar diretamente no localStorage (como importAllData faz)
    console.log('💾 Salvando dados no localStorage...')
    const dreKey = 'vw_dre_2025_usados'
    localStorage.setItem(dreKey, JSON.stringify(testDRE))
    
    console.log('✅ Dados salvos')
    console.log(`  Chave: ${dreKey}`)
    console.log(`  Valor salvo: ${localStorage.getItem(dreKey)?.substring(0, 100)}...`)

    // SIMULAR RELOAD - Carregar novamente
    console.log('\n🔄 Simulando reload - Carregando dados do localStorage...')
    const loadedDRE = loadDREData(2025, 'usados')

    console.log(`📥 Dados carregados: ${loadedDRE !== null ? '✅ SIM' : '❌ NÃO'}`)
    
    if (loadedDRE) {
      console.log(`  Tipo: ${Array.isArray(loadedDRE) ? 'Array' : typeof loadedDRE}`)
      console.log(`  Tamanho: ${loadedDRE.length}`)
      console.log(`  Primeira linha:`, loadedDRE[0])
      console.log(`  Segunda linha:`, loadedDRE[1])
    }

    // Verificar que os dados carregados são idênticos aos salvos
    expect(loadedDRE).not.toBeNull()
    expect(loadedDRE?.length).toBe(2)
    expect(loadedDRE?.[0].total).toBe(1356)
    expect(loadedDRE?.[1].total).toBe(103924692)
    
    console.log('\n✅ SUCESSO: Dados persistiram e foram recarregados corretamente!')
  })

  it('TESTE 3: Verificar todo o fluxo de exportação e importação', () => {
    console.log('\n📋 TESTE 3: Fluxo completo - Export → Clear → Import → Verify')
    
    // 1. Criar e salvar dados iniciais
    const dreKey = 'vw_dre_2025_usados'
    const initialDRE: DREData = [
      { descricao: 'RECEITA', total: 999999, percentTotal: 100, meses: [1,2,3,4,5,6,7,8,9,10,11,12] }
    ]
    
    localStorage.setItem(dreKey, JSON.stringify(initialDRE))
    console.log('1️⃣ Dados iniciais salvos')

    // 2. Exportar
    const exported = exportAllData()
    console.log('2️⃣ Dados exportados')
    console.log(`   Tamanho do JSON: ${exported.length} chars`)
    
    expect(exported).toBeTruthy()
    expect(exported.length).toBeGreaterThan(100)

    // 3. Limpar localStorage
    localStorage.clear()
    console.log('3️⃣ localStorage limpo')
    console.log(`   Chaves restantes: ${Object.keys(localStorage).length}`)
    
    expect(localStorage.getItem(dreKey)).toBeNull()

    // 4. Importar
    const importSuccess = importAllData(exported)
    console.log('4️⃣ Dados importados')
    console.log(`   Sucesso: ${importSuccess}`)
    
    expect(importSuccess).toBe(true)

    // 5. Verificar que voltou
    const dreAfterImport = localStorage.getItem(dreKey)
    console.log('5️⃣ Verificando localStorage após importação')
    console.log(`   ${dreKey}: ${dreAfterImport !== null ? '✅ EXISTE' : '❌ NÃO EXISTE'}`)
    
    if (dreAfterImport) {
      const parsed = JSON.parse(dreAfterImport)
      console.log(`   Dados recuperados:`, parsed[0])
    }

    expect(dreAfterImport).not.toBeNull()
    
    // 6. Carregar usando a função
    const loadedDRE = loadDREData(2025, 'usados')
    console.log('6️⃣ Carregado via loadDREData')
    console.log(`   Resultado: ${loadedDRE !== null ? '✅ OK' : '❌ NULL'}`)
    
    expect(loadedDRE).not.toBeNull()
    expect(loadedDRE?.[0].total).toBe(999999)

    console.log('\n✅ FLUXO COMPLETO FUNCIONOU!')
  })

  it('TESTE 4: Diagnosticar estado do localStorage', () => {
    console.log('\n📋 TESTE 4: Diagnóstico completo do localStorage')
    
    // Adicionar alguns dados
    localStorage.setItem('vw_dre_2025_usados', JSON.stringify([{descricao: 'TESTE', total: 123}]))
    localStorage.setItem('vw_metrics_2025_usados', JSON.stringify({months: ['Jan']}))
    localStorage.setItem('vw_selected_fiscal_year', '2025')
    localStorage.setItem('other_key', 'other_value')

    // Diagnóstico
    const allKeys = Object.keys(localStorage)
    const vwKeys = allKeys.filter(k => k.startsWith('vw_'))
    
    console.log('\n🔬 === DIAGNÓSTICO ===')
    console.log(`📦 Total de chaves: ${allKeys.length}`)
    console.log(`📦 Chaves VW: ${vwKeys.length}`)
    console.log('\nChaves VW encontradas:')
    vwKeys.forEach(key => {
      const value = localStorage.getItem(key)
      const size = value?.length || 0
      console.log(`  ✓ ${key} (${size} chars)`)
    })

    console.log('\nVerificando chaves específicas:')
    const checks = [
      'vw_dre_2025_usados',
      'vw_metrics_2025_usados',
      'vw_selected_fiscal_year'
    ]

    checks.forEach(key => {
      const exists = localStorage.getItem(key) !== null
      console.log(`  ${exists ? '✅' : '❌'} ${key}`)
    })

    expect(vwKeys.length).toBe(3)
  })
})
