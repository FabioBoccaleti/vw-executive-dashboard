/**
 * Suíte de Testes - Comparação de Anos
 * Testa funcionalidades de comparação entre anos fiscais
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { loadMetricsData, loadDREData, type Department } from '@/lib/dataStorage'

describe('Comparativo de Anos - Cálculos', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const calculateDifference = (value1: number, value2: number) => {
    const absolute = value1 - value2
    const percentage = value2 !== 0 ? ((value1 - value2) / Math.abs(value2)) * 100 : 0
    return { absolute, percentage }
  }

  it('deve calcular diferença absoluta corretamente', () => {
    const diff = calculateDifference(1000, 800)
    expect(diff.absolute).toBe(200)
  })

  it('deve calcular diferença percentual corretamente', () => {
    const diff = calculateDifference(1000, 800)
    expect(diff.percentage).toBe(25) // 200/800 * 100 = 25%
  })

  it('deve lidar com valor base zero', () => {
    const diff = calculateDifference(1000, 0)
    expect(diff.percentage).toBe(0) // Evita divisão por zero
  })

  it('deve calcular diferença negativa corretamente', () => {
    const diff = calculateDifference(800, 1000)
    expect(diff.absolute).toBe(-200)
    expect(diff.percentage).toBe(-20) // -200/1000 * 100 = -20%
  })
})

describe('Comparativo de Anos - Carregamento de Dados', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const years: [2024 | 2025 | 2026 | 2027, 2024 | 2025 | 2026 | 2027][] = [
    [2024, 2025],
    [2025, 2026],
    [2026, 2027],
    [2024, 2027],
  ]

  const departments: Department[] = ['usados', 'novos', 'pecas', 'oficina']

  it('deve carregar dados de dois anos diferentes', () => {
    years.forEach(([year1, year2]) => {
      const data1 = loadMetricsData(year1, 'usados')
      const data2 = loadMetricsData(year2, 'usados')
      
      expect(data1).toBeDefined()
      expect(data2).toBeDefined()
      expect(data1.months).not.toEqual(data2.months) // Anos diferentes
    })
  })

  it('deve carregar dados comparativos para todos os departamentos', () => {
    departments.forEach((dept) => {
      const data2025 = loadMetricsData(2025, dept)
      const data2024 = loadMetricsData(2024, dept)
      
      expect(data2025).toBeDefined()
      expect(data2024).toBeDefined()
    })
  })
})

describe('Comparativo de Anos - Métricas Comparadas', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deve comparar vendas entre anos', () => {
    const data2025 = loadMetricsData(2025, 'usados')
    const data2024 = loadMetricsData(2024, 'usados')
    
    const vendas2025 = data2025.vendasUsados.vendas.reduce((a, b) => a + b, 0)
    const vendas2024 = data2024.vendasUsados.vendas.reduce((a, b) => a + b, 0)
    
    const diferenca = vendas2025 - vendas2024
    
    expect(typeof diferenca).toBe('number')
    expect(isNaN(diferenca)).toBe(false)
  })

  it('deve comparar margens de vendas entre anos', () => {
    const data2025 = loadMetricsData(2025, 'usados')
    const data2024 = loadMetricsData(2024, 'usados')
    
    const media2025 = data2025.vendasUsados.vendas.reduce((a, b) => a + b, 0) / 12
    const media2024 = data2024.vendasUsados.vendas.reduce((a, b) => a + b, 0) / 12
    
    expect(typeof media2025).toBe('number')
    expect(typeof media2024).toBe('number')
  })

  it('deve comparar estoque entre anos', () => {
    const data2025 = loadMetricsData(2025, 'usados')
    const data2024 = loadMetricsData(2024, 'usados')
    
    const estoque2025 = data2025.estoqueUsados.quantidade
    const estoque2024 = data2024.estoqueUsados.quantidade
    
    expect(estoque2025).toHaveLength(12)
    expect(estoque2024).toHaveLength(12)
  })
})

describe('Comparativo de Anos - Modos de Visualização', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  type ViewMode = 'mensal' | 'bimestral' | 'trimestral' | 'semestral'
  
  const aggregateData = (data: number[], mode: ViewMode): number[] => {
    switch (mode) {
      case 'mensal':
        return data
      case 'bimestral':
        const bimestral: number[] = []
        for (let i = 0; i < 12; i += 2) {
          bimestral.push(data[i] + data[i + 1])
        }
        return bimestral
      case 'trimestral':
        const trimestral: number[] = []
        for (let i = 0; i < 12; i += 3) {
          trimestral.push(data[i] + data[i + 1] + data[i + 2])
        }
        return trimestral
      case 'semestral':
        const semestral: number[] = []
        semestral.push(data.slice(0, 6).reduce((a, b) => a + b, 0))
        semestral.push(data.slice(6, 12).reduce((a, b) => a + b, 0))
        return semestral
      default:
        return data
    }
  }

  it('deve agregar dados mensalmente (12 pontos)', () => {
    const data = loadMetricsData(2025, 'usados')
    const agregado = aggregateData(data.vendasNovos.vendas, 'mensal')
    expect(agregado).toHaveLength(12)
  })

  it('deve agregar dados bimestralmente (6 pontos)', () => {
    const data = loadMetricsData(2025, 'usados')
    const agregado = aggregateData(data.vendasNovos.vendas, 'bimestral')
    expect(agregado).toHaveLength(6)
  })

  it('deve agregar dados trimestralmente (4 pontos)', () => {
    const data = loadMetricsData(2025, 'usados')
    const agregado = aggregateData(data.vendasNovos.vendas, 'trimestral')
    expect(agregado).toHaveLength(4)
  })

  it('deve agregar dados semestralmente (2 pontos)', () => {
    const data = loadMetricsData(2025, 'usados')
    const agregado = aggregateData(data.vendasNovos.vendas, 'semestral')
    expect(agregado).toHaveLength(2)
  })

  it('soma das agregações deve ser igual ao total', () => {
    const data = loadMetricsData(2025, 'usados')
    const mensal = data.vendasNovos.vendas
    const totalMensal = mensal.reduce((a, b) => a + b, 0)
    
    const trimestral = aggregateData(mensal, 'trimestral')
    const totalTrimestral = trimestral.reduce((a, b) => a + b, 0)
    
    expect(totalTrimestral).toBe(totalMensal)
  })
})

describe('Comparativo de Anos - Labels', () => {
  const getComparisonLabels = (mode: 'mensal' | 'bimestral' | 'trimestral' | 'semestral', year: string) => {
    switch (mode) {
      case 'mensal':
        return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(m => `${m}/${year}`)
      case 'bimestral':
        return ['Jan-Fev', 'Mar-Abr', 'Mai-Jun', 'Jul-Ago', 'Set-Out', 'Nov-Dez'].map(m => `${m}/${year}`)
      case 'trimestral':
        return ['1º Tri', '2º Tri', '3º Tri', '4º Tri'].map(m => `${m}/${year}`)
      case 'semestral':
        return ['1º Sem', '2º Sem'].map(m => `${m}/${year}`)
      default:
        return []
    }
  }

  it('deve gerar labels mensais corretamente', () => {
    const labels = getComparisonLabels('mensal', '25')
    expect(labels).toHaveLength(12)
    expect(labels[0]).toBe('Jan/25')
    expect(labels[11]).toBe('Dez/25')
  })

  it('deve gerar labels bimestrais corretamente', () => {
    const labels = getComparisonLabels('bimestral', '25')
    expect(labels).toHaveLength(6)
    expect(labels[0]).toBe('Jan-Fev/25')
  })

  it('deve gerar labels trimestrais corretamente', () => {
    const labels = getComparisonLabels('trimestral', '25')
    expect(labels).toHaveLength(4)
    expect(labels[0]).toBe('1º Tri/25')
    expect(labels[3]).toBe('4º Tri/25')
  })

  it('deve gerar labels semestrais corretamente', () => {
    const labels = getComparisonLabels('semestral', '25')
    expect(labels).toHaveLength(2)
    expect(labels[0]).toBe('1º Sem/25')
    expect(labels[1]).toBe('2º Sem/25')
  })
})

describe('Comparativo de Anos - Indicadores de Tendência', () => {
  const getTrend = (current: number, previous: number): 'up' | 'down' | 'stable' => {
    const diff = current - previous
    const threshold = Math.abs(previous) * 0.01 // 1% threshold
    
    if (diff > threshold) return 'up'
    if (diff < -threshold) return 'down'
    return 'stable'
  }

  it('deve identificar tendência de alta', () => {
    expect(getTrend(1100, 1000)).toBe('up')
  })

  it('deve identificar tendência de baixa', () => {
    expect(getTrend(900, 1000)).toBe('down')
  })

  it('deve identificar tendência estável', () => {
    expect(getTrend(1005, 1000)).toBe('stable')
  })
})

describe('Comparativo de Anos - Departamento Contextual', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const departmentNames: Record<Department, string> = {
    'novos': 'Veículos Novos',
    'vendaDireta': 'Venda Direta',
    'usados': 'Veículos Usados',
    'pecas': 'Peças',
    'oficina': 'Oficina',
    'funilaria': 'Funilaria',
    'administracao': 'Administração',
    'consolidado': 'Consolidado',
  }

  it('deve ter nome contextual para cada departamento', () => {
    const departments: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao', 'consolidado']
    
    departments.forEach((dept) => {
      expect(departmentNames[dept]).toBeDefined()
      expect(departmentNames[dept].length).toBeGreaterThan(0)
    })
  })

  it('deve gerar título contextual para comparação', () => {
    const getComparisonTitle = (dept: Department): string => {
      return `Análise Comparativa • ${departmentNames[dept]}`
    }

    expect(getComparisonTitle('usados')).toBe('Análise Comparativa • Veículos Usados')
    expect(getComparisonTitle('novos')).toBe('Análise Comparativa • Veículos Novos')
    expect(getComparisonTitle('pecas')).toBe('Análise Comparativa • Peças')
    expect(getComparisonTitle('consolidado')).toBe('Análise Comparativa • Consolidado')
  })
})
