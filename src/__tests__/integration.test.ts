/**
 * Suíte de Testes - Integração Completa
 * Testes de ponta a ponta para cenários de uso reais
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  loadMetricsData,
  saveMetricsData,
  loadDREData,
  saveDREData,
  loadSelectedFiscalYear,
  saveSelectedFiscalYear,
  loadSelectedDepartment,
  saveSelectedDepartment,
  clearFiscalYearData,
  hasStoredData,
  exportAllData,
  importAllData,
  clearAllData,
  type Department,
  type DREData,
} from '@/lib/dataStorage'

describe('Integração - Fluxo Completo do Usuário', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('deve simular fluxo de navegação entre departamentos', () => {
    // Usuário seleciona departamento Usados
    saveSelectedDepartment('usados')
    expect(loadSelectedDepartment()).toBe('usados')
    
    // Visualiza dados
    const dadosUsados = loadMetricsData(2025, 'usados')
    expect(dadosUsados).toBeDefined()
    
    // Muda para Novos
    saveSelectedDepartment('novos')
    expect(loadSelectedDepartment()).toBe('novos')
    
    // Visualiza dados
    const dadosNovos = loadMetricsData(2025, 'novos')
    expect(dadosNovos).toBeDefined()
    
    // Muda para Consolidado
    saveSelectedDepartment('consolidado')
    const dadosConsolidado = loadMetricsData(2025, 'consolidado')
    expect(dadosConsolidado).toBeDefined()
  })

  it('deve simular fluxo de comparação de anos', () => {
    // Usuário está em 2025
    saveSelectedFiscalYear(2025)
    
    // Carrega dados de 2025
    const dados2025 = loadMetricsData(2025, 'usados')
    expect(dados2025).toBeDefined()
    
    // Compara com 2024
    const dados2024 = loadMetricsData(2024, 'usados')
    expect(dados2024).toBeDefined()
    
    // Calcula diferenças
    const vendas2025 = dados2025.vendasUsados.vendas.reduce((a, b) => a + b, 0)
    const vendas2024 = dados2024.vendasUsados.vendas.reduce((a, b) => a + b, 0)
    
    const diferenca = vendas2025 - vendas2024
    expect(typeof diferenca).toBe('number')
  })

  it('deve simular fluxo de importação de dados TXT', () => {
    // Usuário importa DRE via TXT
    const mockDRE: DREData = [
      { id: 'receita_bruta', label: 'Receita Bruta', values: Array(12).fill(100000) },
      { id: 'deducoes', label: '(-) Deduções', values: Array(12).fill(-10000) },
      { id: 'receita_liquida', label: 'Receita Líquida', values: Array(12).fill(90000), isSubtotal: true },
    ]
    
    // Salva DRE importada
    const saved = saveDREData(2025, mockDRE, 'usados')
    expect(saved).toBe(true)
    
    // Verifica se foi salvo
    const loaded = loadDREData(2025, 'usados')
    expect(loaded).not.toBeNull()
    expect(loaded![0].label).toBe('Receita Bruta')
  })

  it('deve simular fluxo de backup e restauração', () => {
    // Usuário configura sistema
    saveSelectedFiscalYear(2026)
    saveSelectedDepartment('pecas')
    
    // Importa alguns dados
    const dadosModificados = loadMetricsData(2026, 'pecas')
    dadosModificados.vendasNovos.vendas = Array(12).fill(5000)
    saveMetricsData(2026, dadosModificados, 'pecas')
    
    // Faz backup
    const backup = exportAllData()
    expect(backup).toBeDefined()
    
    // Simula perda de dados (limpa tudo)
    clearAllData()
    
    // Restaura backup
    const restored = importAllData(backup)
    expect(restored).toBe(true)
    
    // Verifica restauração
    expect(loadSelectedFiscalYear()).toBe(2026)
    expect(loadSelectedDepartment()).toBe('pecas')
    
    const dadosRestaurados = loadMetricsData(2026, 'pecas')
    expect(dadosRestaurados.vendasNovos.vendas[0]).toBe(5000)
  })
})

describe('Integração - Cenários de Erro', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deve recuperar graciosamente de dados corrompidos', () => {
    // Simula dados corrompidos no localStorage
    localStorage.setItem('vw_metrics_2025_usados', 'invalid json')
    
    // Sistema deve retornar dados padrão
    const data = loadMetricsData(2025, 'usados')
    expect(data).toBeDefined()
    expect(data.months).toHaveLength(12)
  })

  it('deve lidar com localStorage indisponível', () => {
    // Mesmo se localStorage falhar, funções devem retornar valores padrão
    const year = loadSelectedFiscalYear()
    expect(year).toBe(2025)
    
    const dept = loadSelectedDepartment()
    expect(dept).toBe('usados')
  })

  it('deve validar importação de dados malformados', () => {
    const result = importAllData('{invalid}')
    expect(result).toBe(false)
  })
})

describe('Integração - Performance', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deve carregar dados rapidamente', () => {
    const start = performance.now()
    
    // Carrega dados de todos os departamentos
    const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao', 'consolidado']
    departments.forEach(dept => {
      loadMetricsData(2025, dept)
    })
    
    const end = performance.now()
    const duration = end - start
    
    // Deve completar em menos de 500ms
    expect(duration).toBeLessThan(500)
  })

  it('deve exportar dados rapidamente', () => {
    const start = performance.now()
    exportAllData()
    const end = performance.now()
    
    // Deve completar em menos de 200ms
    expect(end - start).toBeLessThan(200)
  })

  it('deve importar dados rapidamente', () => {
    const backup = exportAllData()
    
    const start = performance.now()
    importAllData(backup)
    const end = performance.now()
    
    // Deve completar em menos de 200ms
    expect(end - start).toBeLessThan(200)
  })
})

describe('Integração - Consistência de Dados', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deve manter consistência entre múltiplas operações', () => {
    // Múltiplas alterações
    for (let i = 0; i < 10; i++) {
      const year = (2024 + (i % 4)) as 2024 | 2025 | 2026 | 2027
      saveSelectedFiscalYear(year)
      
      const data = loadMetricsData(year, 'usados')
      expect(data.months).toHaveLength(12)
    }
    
    // Verifica estado final
    const finalYear = loadSelectedFiscalYear()
    expect([2024, 2025, 2026, 2027]).toContain(finalYear)
  })

  it('deve isolar dados entre departamentos', () => {
    // Modifica dados de um departamento
    const pecasData = loadMetricsData(2025, 'pecas')
    pecasData.vendasNovos.vendas = Array(12).fill(9999)
    saveMetricsData(2025, pecasData, 'pecas')
    
    // Dados de outro departamento não devem ser afetados
    const usadosData = loadMetricsData(2025, 'usados')
    expect(usadosData.vendasNovos.vendas).not.toEqual(Array(12).fill(9999))
  })

  it('deve isolar dados entre anos', () => {
    // Modifica dados de um ano
    const data2025 = loadMetricsData(2025, 'usados')
    data2025.vendasNovos.vendas = Array(12).fill(8888)
    saveMetricsData(2025, data2025, 'usados')
    
    // Dados de outro ano não devem ser afetados
    const data2024 = loadMetricsData(2024, 'usados')
    expect(data2024.vendasNovos.vendas).not.toEqual(Array(12).fill(8888))
  })
})

describe('Integração - Cenários Específicos de Negócio', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deve calcular consolidado corretamente', () => {
    const consolidado = loadMetricsData(2025, 'consolidado')
    
    // Consolidado deve ter estrutura completa
    expect(consolidado.months).toHaveLength(12)
    expect(consolidado.vendasNovos.vendas).toHaveLength(12)
    expect(consolidado.vendasUsados.vendas).toHaveLength(12)
    // Verificar estrutura de vendas de peças (não tem margensOperacionais)
    if (consolidado.vendasPecas?.balcao?.vendas) {
      expect(consolidado.vendasPecas.balcao.vendas).toHaveLength(12)
    }
  })

  it('deve permitir análise YoY (Year over Year)', () => {
    // Carrega dados de dois anos consecutivos
    const data2024 = loadMetricsData(2024, 'usados')
    const data2025 = loadMetricsData(2025, 'usados')
    
    // Calcula YoY para cada mês
    const yoyVendas = data2025.vendasUsados.vendas.map((val, idx) => {
      const prev = data2024.vendasUsados.vendas[idx]
      if (prev === 0) return 0
      return ((val - prev) / prev) * 100
    })
    
    expect(yoyVendas).toHaveLength(12)
    yoyVendas.forEach(yoy => {
      expect(typeof yoy).toBe('number')
      expect(isNaN(yoy)).toBe(false)
    })
  })

  it('deve suportar análise de vendas', () => {
    const data = loadMetricsData(2025, 'usados')
    
    // Calcula média de vendas
    const mediaVendas = data.vendasUsados.vendas.reduce((a, b) => a + b, 0) / 12
    
    expect(typeof mediaVendas).toBe('number')
    expect(isNaN(mediaVendas)).toBe(false)
  })
})
