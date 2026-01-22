/**
 * Suíte de Testes - Importação e Exportação
 * Testa funcionalidades de backup e restauração de dados
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
  exportAllData,
  importAllData,
  clearAllData,
  type Department,
  type DREData,
} from '@/lib/dataStorage'

describe('Exportação de Dados', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('deve exportar dados no formato JSON válido', () => {
    const exported = exportAllData()
    
    expect(() => JSON.parse(exported)).not.toThrow()
  })

  it('deve incluir metadados na exportação', () => {
    const exported = exportAllData()
    const parsed = JSON.parse(exported)
    
    expect(parsed).toHaveProperty('selectedYear')
    expect(parsed).toHaveProperty('selectedDepartment')
    expect(parsed).toHaveProperty('exportDate')
    expect(parsed).toHaveProperty('data')
  })

  it('deve incluir data de exportação válida', () => {
    const exported = exportAllData()
    const parsed = JSON.parse(exported)
    
    const exportDate = new Date(parsed.exportDate)
    expect(exportDate).toBeInstanceOf(Date)
    expect(exportDate.getTime()).not.toBeNaN()
  })

  it('deve exportar todos os anos fiscais', () => {
    const exported = exportAllData()
    const parsed = JSON.parse(exported)
    
    expect(parsed.data).toHaveProperty('2024')
    expect(parsed.data).toHaveProperty('2025')
    expect(parsed.data).toHaveProperty('2026')
    expect(parsed.data).toHaveProperty('2027')
  })

  it('deve exportar todos os departamentos para cada ano', () => {
    const exported = exportAllData()
    const parsed = JSON.parse(exported)
    
    const departments = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao']
    
    departments.forEach((dept) => {
      expect(parsed.data['2025']).toHaveProperty(dept)
    })
  })

  it('deve exportar métricas e DRE para cada departamento', () => {
    const exported = exportAllData()
    const parsed = JSON.parse(exported)
    
    expect(parsed.data['2025']['usados']).toHaveProperty('metrics')
    expect(parsed.data['2025']['usados']).toHaveProperty('dre')
  })

  it('deve exportar configurações atuais', () => {
    saveSelectedFiscalYear(2026)
    saveSelectedDepartment('oficina')
    
    const exported = exportAllData()
    const parsed = JSON.parse(exported)
    
    expect(parsed.selectedYear).toBe(2026)
    expect(parsed.selectedDepartment).toBe('oficina')
  })
})

describe('Importação de Dados', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('deve importar dados válidos com sucesso', () => {
    const backup = {
      selectedYear: 2025,
      selectedDepartment: 'usados',
      exportDate: new Date().toISOString(),
      data: {},
    }
    
    const result = importAllData(JSON.stringify(backup))
    expect(result).toBe(true)
  })

  it('deve falhar ao importar JSON inválido', () => {
    const result = importAllData('not valid json')
    expect(result).toBe(false)
  })

  it('deve falhar ao importar string vazia', () => {
    const result = importAllData('')
    expect(result).toBe(false)
  })

  it('deve restaurar ano fiscal selecionado', () => {
    const backup = {
      selectedYear: 2027,
      selectedDepartment: 'usados',
      exportDate: new Date().toISOString(),
      data: {},
    }
    
    importAllData(JSON.stringify(backup))
    expect(loadSelectedFiscalYear()).toBe(2027)
  })

  it('deve restaurar departamento selecionado', () => {
    const backup = {
      selectedYear: 2025,
      selectedDepartment: 'funilaria',
      exportDate: new Date().toISOString(),
      data: {},
    }
    
    importAllData(JSON.stringify(backup))
    expect(loadSelectedDepartment()).toBe('funilaria')
  })

  it('deve restaurar dados de métricas', () => {
    const mockData = loadMetricsData(2025, 'usados')
    const modifiedData = {
      ...mockData,
      vendasNovos: {
        ...mockData.vendasNovos,
        vendas: [111, 222, 333, 444, 555, 666, 777, 888, 999, 1000, 1100, 1200],
      },
    }
    
    const backup = {
      selectedYear: 2025,
      selectedDepartment: 'usados',
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
    
    importAllData(JSON.stringify(backup))
    
    const loaded = loadMetricsData(2025, 'usados')
    expect(loaded.vendasNovos.vendas[0]).toBe(111)
  })

  it('deve restaurar dados de DRE', () => {
    const mockDRE: DREData = [
      { id: 'test1', label: 'Teste 1', values: Array(12).fill(1000) },
      { id: 'test2', label: 'Teste 2', values: Array(12).fill(2000) },
    ]
    
    const backup = {
      selectedYear: 2025,
      selectedDepartment: 'usados',
      exportDate: new Date().toISOString(),
      data: {
        2025: {
          usados: {
            metrics: loadMetricsData(2025, 'usados'),
            dre: mockDRE,
          },
        },
      },
    }
    
    importAllData(JSON.stringify(backup))
    
    const loaded = loadDREData(2025, 'usados')
    expect(loaded).not.toBeNull()
    expect(loaded![0].id).toBe('test1')
  })
})

describe('Ciclo Completo Exportação/Importação', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('deve manter integridade dos dados após ciclo completo', () => {
    // Setup inicial
    saveSelectedFiscalYear(2026)
    saveSelectedDepartment('pecas')
    
    const originalData = loadMetricsData(2026, 'pecas')
    const modifiedData = {
      ...originalData,
      vendasNovos: {
        ...originalData.vendasNovos,
        vendas: [5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000],
      },
    }
    saveMetricsData(2026, modifiedData, 'pecas')
    
    // Exporta
    const exported = exportAllData()
    
    // Limpa tudo
    clearAllData()
    
    // Importa
    const result = importAllData(exported)
    expect(result).toBe(true)
    
    // Verifica restauração
    expect(loadSelectedFiscalYear()).toBe(2026)
    expect(loadSelectedDepartment()).toBe('pecas')
    
    const restoredData = loadMetricsData(2026, 'pecas')
    expect(restoredData.vendasNovos.vendas[0]).toBe(5000)
  })

  it('deve permitir múltiplos ciclos de exportação/importação', () => {
    for (let i = 0; i < 3; i++) {
      saveSelectedFiscalYear(2024 + i as 2024 | 2025 | 2026)
      
      const exported = exportAllData()
      clearAllData()
      importAllData(exported)
      
      expect(loadSelectedFiscalYear()).toBe(2024 + i)
    }
  })
})

describe('Validação de Backup', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deve validar estrutura mínima do backup', () => {
    // Backup sem estrutura data
    const invalidBackup1 = {
      selectedYear: 2025,
      selectedDepartment: 'usados',
      exportDate: new Date().toISOString(),
    }
    
    // Deve ainda funcionar (importa configurações)
    const result = importAllData(JSON.stringify(invalidBackup1))
    expect(result).toBe(true)
  })

  it('deve lidar com dados parciais', () => {
    const partialBackup = {
      selectedYear: 2025,
      selectedDepartment: 'usados',
      exportDate: new Date().toISOString(),
      data: {
        2025: {
          usados: {
            metrics: loadMetricsData(2025, 'usados'),
            // Sem DRE
          },
        },
        // Sem outros anos
      },
    }
    
    const result = importAllData(JSON.stringify(partialBackup))
    expect(result).toBe(true)
  })

  it('deve gerar tamanho de backup razoável', () => {
    const exported = exportAllData()
    
    // Backup não deve exceder 5MB
    const sizeInMB = new Blob([exported]).size / (1024 * 1024)
    expect(sizeInMB).toBeLessThan(5)
  })
})
