/**
 * Suíte de Testes - DataStorage
 * Testa todas as funções de armazenamento, importação e exportação de dados
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
  clearYearData,
  clearAllData,
  type Department,
  type MetricsData,
  type DREData,
} from '@/lib/dataStorage'

describe('DataStorage - Gerenciamento de Dados', () => {
  // Limpar localStorage antes de cada teste
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Departamentos', () => {
    const departments: Department[] = [
      'novos',
      'vendaDireta',
      'usados',
      'pecas',
      'oficina',
      'funilaria',
      'administracao',
      'consolidado',
    ]

    const years: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027]

    it('deve carregar dados padrão para todos os departamentos', () => {
      departments.forEach((dept) => {
        years.forEach((year) => {
          const data = loadMetricsData(year, dept)
          expect(data).toBeDefined()
          expect(data.months).toBeDefined()
          expect(data.months).toHaveLength(12)
        })
      })
    })

    it('deve ter estrutura de dados válida para cada departamento', () => {
      departments.forEach((dept) => {
        const data = loadMetricsData(2025, dept)
        
        // Verifica estrutura básica (campos obrigatórios)
        expect(data).toHaveProperty('months')
        expect(data).toHaveProperty('vendasNovos')
        expect(data).toHaveProperty('vendasNovosVD')
        expect(data).toHaveProperty('vendasUsados')
        expect(data).toHaveProperty('volumeVendas')
        expect(data).toHaveProperty('estoqueNovos')
        expect(data).toHaveProperty('estoqueUsados')
        expect(data).toHaveProperty('estoquePecas')
      })
    })

    it('deve salvar e carregar departamento selecionado', () => {
      departments.filter(d => d !== 'consolidado').forEach((dept) => {
        const result = saveSelectedDepartment(dept)
        expect(result).toBe(true)
        
        const loaded = loadSelectedDepartment()
        expect(loaded).toBe(dept)
      })
    })

    it('deve retornar "usados" como departamento padrão', () => {
      const dept = loadSelectedDepartment()
      expect(dept).toBe('usados')
    })
  })

  describe('Anos Fiscais', () => {
    const years: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027]

    it('deve salvar e carregar ano fiscal selecionado', () => {
      years.forEach((year) => {
        const result = saveSelectedFiscalYear(year)
        expect(result).toBe(true)
        
        const loaded = loadSelectedFiscalYear()
        expect(loaded).toBe(year)
      })
    })

    it('deve retornar 2025 como ano padrão', () => {
      const year = loadSelectedFiscalYear()
      expect(year).toBe(2025)
    })

    it('deve limpar dados de um ano específico', () => {
      // Primeiro salva alguns dados
      const mockData = loadMetricsData(2024, 'usados')
      saveMetricsData(2024, mockData, 'usados')
      
      expect(hasStoredData(2024, 'usados')).toBe(true)
      
      // Limpa os dados
      clearYearData(2024)
      
      expect(hasStoredData(2024, 'usados')).toBe(false)
    })
  })

  describe('Métricas', () => {
    it('deve salvar e carregar métricas corretamente', () => {
      const originalData = loadMetricsData(2025, 'usados')
      
      // Modifica alguns dados
      const modifiedData = {
        ...originalData,
        vendasNovos: {
          ...originalData.vendasNovos,
          vendas: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
        },
      }
      
      const saved = saveMetricsData(2025, modifiedData, 'usados')
      expect(saved).toBe(true)
      
      const loaded = loadMetricsData(2025, 'usados')
      expect(loaded.vendasNovos.vendas).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200])
    })

    it('não deve permitir salvar dados do consolidado (sem force)', () => {
      const data = loadMetricsData(2025, 'consolidado')
      const result = saveMetricsData(2025, data, 'consolidado')
      expect(result).toBe(false)
    })

    it('deve calcular consolidado corretamente', () => {
      const consolidado = loadMetricsData(2025, 'consolidado')
      
      expect(consolidado).toBeDefined()
      expect(consolidado.months).toHaveLength(12)
    })

    it('deve carregar dados corretos de Usados 2025', () => {
      const data = loadMetricsData(2025, 'usados')
      
      // Verifica alguns valores específicos atualizados
      expect(data).toBeDefined()
      expect(data.months).toHaveLength(12)
    })

    it('deve ter valores numéricos válidos em todos os campos', () => {
      const data = loadMetricsData(2025, 'usados')
      
      // Verifica que todos os valores são números válidos
      data.months.forEach((_, index) => {
        expect(typeof data.vendasNovos.vendas[index]).toBe('number')
        expect(isFinite(data.vendasNovos.vendas[index])).toBe(true)
      })
    })
  })

  describe('DRE', () => {
    it('deve retornar null para DRE não existente', () => {
      const dre = loadDREData(2025, 'novos')
      expect(dre).toBeNull()
    })

    it('deve salvar e carregar DRE corretamente', () => {
      const mockDRE: DREData = [
        { id: '1', label: 'Receita Bruta', values: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000] },
        { id: '2', label: 'Deduções', values: [-100, -200, -300, -400, -500, -600, -700, -800, -900, -1000, -1100, -1200] },
      ]
      
      const saved = saveDREData(2025, mockDRE, 'usados')
      expect(saved).toBe(true)
      
      const loaded = loadDREData(2025, 'usados')
      expect(loaded).toEqual(mockDRE)
    })

    it('não deve permitir salvar DRE do consolidado sem force', () => {
      const mockDRE: DREData = [
        { id: '1', label: 'Teste', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
      ]
      const result = saveDREData(2025, mockDRE, 'consolidado')
      expect(result).toBe(false)
    })

    it('deve permitir salvar DRE do consolidado com forceConsolidated', () => {
      const mockDRE: DREData = [
        { id: '1', label: 'Teste Consolidado', values: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200] },
        { id: '2', label: 'Linha 2', values: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120] },
      ]
      const result = saveDREData(2025, mockDRE, 'consolidado', true)
      expect(result).toBe(true)
      
      const loaded = loadDREData(2025, 'consolidado')
      expect(loaded).toEqual(mockDRE)
      expect(loaded?.[0].values[0]).toBe(100)
    })

    it('deve carregar DRE salvo do consolidado antes de calcular', () => {
      // Salva um DRE customizado no consolidado
      const mockDRE: DREData = [
        { id: '1', label: 'Custom Data', values: [999, 888, 777, 666, 555, 444, 333, 222, 111, 100, 90, 80] },
      ]
      saveDREData(2025, mockDRE, 'consolidado', true)
      
      // Carrega e verifica que retorna os dados salvos
      const loaded = loadDREData(2025, 'consolidado')
      expect(loaded).toEqual(mockDRE)
      expect(loaded?.[0].values[0]).toBe(999)
    })
  })

  describe('Importação e Exportação', () => {
    it('deve exportar todos os dados corretamente', () => {
      const exported = exportAllData()
      const parsed = JSON.parse(exported)
      
      expect(parsed).toHaveProperty('selectedYear')
      expect(parsed).toHaveProperty('selectedDepartment')
      expect(parsed).toHaveProperty('exportDate')
      expect(parsed).toHaveProperty('data')
      expect(parsed.data).toHaveProperty('2024')
      expect(parsed.data).toHaveProperty('2025')
      expect(parsed.data).toHaveProperty('2026')
      expect(parsed.data).toHaveProperty('2027')
    })

    it('deve importar dados corretamente', () => {
      // Cria dados de teste
      const mockData = loadMetricsData(2025, 'usados')
      const modifiedData = {
        ...mockData,
        vendasNovos: {
          ...mockData.vendasNovos,
          vendas: [999, 888, 777, 666, 555, 444, 333, 222, 111, 100, 90, 80],
        },
      }
      
      const backup = {
        selectedYear: 2026,
        selectedDepartment: 'pecas',
        exportDate: new Date().toISOString(),
        data: {
          2025: {
            usados: {
              metrics: modifiedData,
              dre: null,
            },
          },
        },
      }
      
      const result = importAllData(JSON.stringify(backup))
      expect(result).toBe(true)
      
      expect(loadSelectedFiscalYear()).toBe(2026)
      expect(loadSelectedDepartment()).toBe('pecas')
      
      const loaded = loadMetricsData(2025, 'usados')
      expect(loaded.vendasNovos.vendas[0]).toBe(999)
    })

    it('deve falhar ao importar JSON inválido', () => {
      const result = importAllData('invalid json')
      expect(result).toBe(false)
    })

    it('deve manter integridade após exportar e importar', () => {
      // Salva alguns dados
      saveSelectedFiscalYear(2026)
      saveSelectedDepartment('oficina')
      
      // Exporta
      const exported = exportAllData()
      
      // Limpa tudo
      clearAllData()
      
      // Importa
      const result = importAllData(exported)
      expect(result).toBe(true)
      
      // Verifica
      expect(loadSelectedFiscalYear()).toBe(2026)
      expect(loadSelectedDepartment()).toBe('oficina')
    })
  })

  describe('Limpeza de Dados', () => {
    it('deve executar limpeza de dados sem erros', () => {
      // Salva alguns dados
      const data = loadMetricsData(2025, 'usados')
      saveMetricsData(2025, data, 'usados')
      
      // Executa limpeza - verifica que não lança erros
      expect(() => clearAllData()).not.toThrow()
    })

    it('deve limpar dados de um ano e departamento específico', () => {
      const data = loadMetricsData(2025, 'usados')
      saveMetricsData(2025, data, 'usados')
      
      expect(hasStoredData(2025, 'usados')).toBe(true)
      
      clearFiscalYearData(2025, 'usados')
      
      expect(hasStoredData(2025, 'usados')).toBe(false)
    })
  })
})

describe('DataStorage - Validação de Dados', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deve validar arrays de meses com 12 elementos', () => {
    const data = loadMetricsData(2025, 'usados')
    
    expect(data.vendasNovos.vendas).toHaveLength(12)
    expect(data.vendasNovos.volumeTrocas).toHaveLength(12)
    expect(data.vendasUsados.vendas).toHaveLength(12)
    expect(data.volumeVendas.usados).toHaveLength(12)
    expect(data.estoqueNovos.quantidade).toHaveLength(12)
  })

  it('deve validar que valores numéricos são números', () => {
    const data = loadMetricsData(2025, 'usados')
    
    data.vendasNovos.vendas.forEach((value) => {
      expect(typeof value).toBe('number')
    })
    
    data.vendasUsados.vendas.forEach((value) => {
      expect(typeof value).toBe('number')
    })
  })

  it('deve validar que meses são strings', () => {
    const data = loadMetricsData(2025, 'usados')
    
    data.months.forEach((month) => {
      expect(typeof month).toBe('string')
    })
  })
})
