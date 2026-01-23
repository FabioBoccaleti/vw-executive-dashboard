/**
 * Testes de Persistência de Dados Importados
 * 
 * Este arquivo testa se os dados importados são realmente salvos no localStorage
 * e se permanecem após reiniciar o "servidor" (simular reload da aplicação)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  importAllData,
  exportAllData,
  loadMetricsData,
  loadDREData,
  saveMetricsData,
  saveDREData,
  type MetricsData,
  type DREData
} from '../lib/dataStorage'

describe('Persistência de Dados Importados', () => {
  // Backup do localStorage antes de cada teste
  let localStorageBackup: { [key: string]: string } = {}

  beforeEach(() => {
    // Fazer backup do localStorage atual
    localStorageBackup = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        localStorageBackup[key] = localStorage.getItem(key) || ''
      }
    }
    
    // Limpar localStorage para começar testes com estado limpo
    localStorage.clear()
  })

  afterEach(() => {
    // Restaurar localStorage original
    localStorage.clear()
    Object.entries(localStorageBackup).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  })

  it('deve salvar dados importados no localStorage', () => {
    // Criar dados de teste
    const testMetrics: MetricsData = {
      months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      vendasNovos: { vendas: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200], volumeTrocas: [], percentualTrocas: [] },
      vendasNovosVD: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
      vendasUsados: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
      volumeVendas: { usados: [], repasse: [], percentualRepasse: [] },
      estoqueNovos: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      estoqueUsados: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      estoquePecas: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      margensOperacionais: { novos: [], usados: [], oficina: [], pecas: [] },
      receitaVendas: { novos: [], usados: [] },
      resultadoFinanceiro: { receitas: [], despesas: [], resultado: [] }
    }

    const testDRE: DREData = [
      { id: '1', label: 'Receita', values: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000] }
    ]

    // Salvar dados
    saveMetricsData(2025, testMetrics, 'usados')
    saveDREData(2025, testDRE, 'usados')

    // Verificar que foram salvos no localStorage
    const metricsKey = 'vw_metrics_2025_usados'
    const dreKey = 'vw_dre_2025_usados'
    
    expect(localStorage.getItem(metricsKey)).not.toBeNull()
    expect(localStorage.getItem(dreKey)).not.toBeNull()

    // Verificar conteúdo
    const savedMetrics = JSON.parse(localStorage.getItem(metricsKey)!)
    expect(savedMetrics.vendasNovos.vendas[0]).toBe(100)
    expect(savedMetrics.vendasNovos.vendas[11]).toBe(1200)
  })

  it('deve manter dados importados após "reload" simulado', () => {
    // 1. Criar e salvar dados
    const testMetrics: MetricsData = {
      months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      vendasNovos: { vendas: [999, 888, 777, 666, 555, 444, 333, 222, 111, 100, 90, 80], volumeTrocas: [], percentualTrocas: [] },
      vendasNovosVD: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
      vendasUsados: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
      volumeVendas: { usados: [], repasse: [], percentualRepasse: [] },
      estoqueNovos: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      estoqueUsados: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      estoquePecas: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      margensOperacionais: { novos: [], usados: [], oficina: [], pecas: [] },
      receitaVendas: { novos: [], usados: [] },
      resultadoFinanceiro: { receitas: [], despesas: [], resultado: [] }
    }

    saveMetricsData(2026, testMetrics, 'pecas')

    // 2. Simular "reload" - simplesmente carregar novamente
    const reloadedData = loadMetricsData(2026, 'pecas')

    // 3. Verificar que os dados foram mantidos
    expect(reloadedData.vendasNovos.vendas[0]).toBe(999)
    expect(reloadedData.vendasNovos.vendas[1]).toBe(888)
    expect(reloadedData.vendasNovos.vendas[11]).toBe(80)
  })

  it('deve importar arquivo JSON completo e manter dados após reload', () => {
    // 1. Criar dados de teste com estrutura completa de backup
    const backupData = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        appName: 'VW Financial Dashboard'
      },
      selectedYear: 2025,
      selectedDepartment: 'novos',
      data: {
        2025: {
          novos: {
            metrics: {
              months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
              vendasNovos: { vendas: [5000, 5100, 5200, 5300, 5400, 5500, 5600, 5700, 5800, 5900, 6000, 6100], volumeTrocas: [], percentualTrocas: [] },
              vendasNovosVD: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
              vendasUsados: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
              volumeVendas: { usados: [], repasse: [], percentualRepasse: [] },
              estoqueNovos: { quantidade: [], valor: [], aPagar: [], pagos: [] },
              estoqueUsados: { quantidade: [], valor: [], aPagar: [], pagos: [] },
              estoquePecas: { quantidade: [], valor: [], aPagar: [], pagos: [] },
              margensOperacionais: { novos: [], usados: [], oficina: [], pecas: [] },
              receitaVendas: { novos: [], usados: [] },
              resultadoFinanceiro: { receitas: [], despesas: [], resultado: [] }
            },
            dre: [
              { id: '1', label: 'Receita Total', values: [10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000, 21000] }
            ]
          }
        }
      }
    }

    // 2. Importar dados
    const jsonString = JSON.stringify(backupData)
    const importSuccess = importAllData(jsonString)
    
    expect(importSuccess).toBe(true)

    // 3. Verificar que os dados estão no localStorage
    const metricsKey = 'vw_metrics_2025_novos'
    const dreKey = 'vw_dre_2025_novos'
    
    expect(localStorage.getItem(metricsKey)).not.toBeNull()
    expect(localStorage.getItem(dreKey)).not.toBeNull()

    // 4. Simular "reload" - carregar dados do localStorage
    const reloadedMetrics = loadMetricsData(2025, 'novos')
    const reloadedDRE = loadDREData(2025, 'novos')

    // 5. Verificar que os dados importados foram mantidos
    expect(reloadedMetrics.vendasNovos.vendas[0]).toBe(5000)
    expect(reloadedMetrics.vendasNovos.vendas[11]).toBe(6100)
    expect(reloadedDRE).not.toBeNull()
    expect(reloadedDRE![0].values[0]).toBe(10000)
    expect(reloadedDRE![0].values[11]).toBe(21000)
  })

  it('deve importar dados consolidados e manter após reload', () => {
    // Criar backup com dados consolidados
    const backupData = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        appName: 'VW Financial Dashboard'
      },
      selectedYear: 2026,
      selectedDepartment: 'consolidado',
      data: {
        2026: {
          consolidado: {
            metrics: {
              months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
              vendasNovos: { vendas: [9999, 8888, 7777, 6666, 5555, 4444, 3333, 2222, 1111, 1000, 900, 800], volumeTrocas: [], percentualTrocas: [] },
              vendasNovosVD: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
              vendasUsados: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
              volumeVendas: { usados: [], repasse: [], percentualRepasse: [] },
              estoqueNovos: { quantidade: [], valor: [], aPagar: [], pagos: [] },
              estoqueUsados: { quantidade: [], valor: [], aPagar: [], pagos: [] },
              estoquePecas: { quantidade: [], valor: [], aPagar: [], pagos: [] },
              margensOperacionais: { novos: [], usados: [], oficina: [], pecas: [] },
              receitaVendas: { novos: [], usados: [] },
              resultadoFinanceiro: { receitas: [], despesas: [], resultado: [] }
            },
            dre: [
              { id: '1', label: 'Total Consolidado', values: [99999, 88888, 77777, 66666, 55555, 44444, 33333, 22222, 11111, 10000, 9000, 8000] }
            ]
          }
        }
      }
    }

    // Importar
    const importSuccess = importAllData(JSON.stringify(backupData))
    expect(importSuccess).toBe(true)

    // Verificar localStorage
    const metricsKey = 'vw_metrics_2026_consolidado'
    const dreKey = 'vw_dre_2026_consolidado'
    
    expect(localStorage.getItem(metricsKey)).not.toBeNull()
    expect(localStorage.getItem(dreKey)).not.toBeNull()

    // Simular reload
    const storedMetrics = localStorage.getItem(metricsKey)
    const storedDRE = localStorage.getItem(dreKey)
    
    expect(storedMetrics).not.toBeNull()
    expect(storedDRE).not.toBeNull()

    // Parse e verificar dados
    const parsedMetrics = JSON.parse(storedMetrics!)
    const parsedDRE = JSON.parse(storedDRE!)

    expect(parsedMetrics.vendasNovos.vendas[0]).toBe(9999)
    expect(parsedDRE[0].values[0]).toBe(99999)
  })

  it('deve fazer ciclo completo: exportar -> importar -> verificar persistência', () => {
    // 1. Criar e salvar dados iniciais
    const originalMetrics: MetricsData = {
      months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      vendasNovos: { vendas: [1111, 2222, 3333, 4444, 5555, 6666, 7777, 8888, 9999, 10000, 11000, 12000], volumeTrocas: [], percentualTrocas: [] },
      vendasNovosVD: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
      vendasUsados: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
      volumeVendas: { usados: [], repasse: [], percentualRepasse: [] },
      estoqueNovos: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      estoqueUsados: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      estoquePecas: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      margensOperacionais: { novos: [], usados: [], oficina: [], pecas: [] },
      receitaVendas: { novos: [], usados: [] },
      resultadoFinanceiro: { receitas: [], despesas: [], resultado: [] }
    }

    saveMetricsData(2027, originalMetrics, 'oficina')

    // 2. Exportar todos os dados
    const exported = exportAllData()
    expect(exported).toBeTruthy()
    expect(typeof exported).toBe('string')

    // 3. Limpar localStorage (simular perda de dados)
    localStorage.clear()
    expect(localStorage.length).toBe(0)

    // 4. Importar dados exportados
    const importSuccess = importAllData(exported)
    expect(importSuccess).toBe(true)

    // 5. Verificar que dados foram restaurados no localStorage
    expect(localStorage.getItem('vw_metrics_2027_oficina')).not.toBeNull()

    // 6. Carregar e verificar integridade
    const restoredMetrics = loadMetricsData(2027, 'oficina')
    expect(restoredMetrics.vendasNovos.vendas[0]).toBe(1111)
    expect(restoredMetrics.vendasNovos.vendas[11]).toBe(12000)
  })

  it('deve verificar que dados permanecem após múltiplos reloads simulados', () => {
    const testData: MetricsData = {
      months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      vendasNovos: { vendas: [7777, 7777, 7777, 7777, 7777, 7777, 7777, 7777, 7777, 7777, 7777, 7777], volumeTrocas: [], percentualTrocas: [] },
      vendasNovosVD: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
      vendasUsados: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
      volumeVendas: { usados: [], repasse: [], percentualRepasse: [] },
      estoqueNovos: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      estoqueUsados: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      estoquePecas: { quantidade: [], valor: [], aPagar: [], pagos: [] },
      margensOperacionais: { novos: [], usados: [], oficina: [], pecas: [] },
      receitaVendas: { novos: [], usados: [] },
      resultadoFinanceiro: { receitas: [], despesas: [], resultado: [] }
    }

    // Salvar
    saveMetricsData(2024, testData, 'funilaria')

    // Simular múltiplos reloads
    for (let i = 0; i < 5; i++) {
      const reloaded = loadMetricsData(2024, 'funilaria')
      expect(reloaded.vendasNovos.vendas[0]).toBe(7777)
      expect(reloaded.vendasNovos.vendas.every(v => v === 7777)).toBe(true)
    }

    // Verificar que localStorage ainda tem os dados
    const stored = localStorage.getItem('vw_metrics_2024_funilaria')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.vendasNovos.vendas[0]).toBe(7777)
  })
})
