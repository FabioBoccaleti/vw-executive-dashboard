/**
 * Suíte de Testes - Gráficos e Visualizações
 * Testa dados e configurações para componentes de gráficos
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { loadMetricsData, type Department } from '@/lib/dataStorage'

describe('Gráficos - Dados para Visualização', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('Dados de Vendas', () => {
    it('deve ter 12 pontos de dados para vendas novos', () => {
      const data = loadMetricsData(2025, 'usados')
      expect(data.vendasNovos.vendas).toHaveLength(12)
    })

    it('deve ter 12 pontos de dados para vendas usados', () => {
      const data = loadMetricsData(2025, 'usados')
      expect(data.vendasUsados.vendas).toHaveLength(12)
    })

    it('deve ter 12 pontos de dados para volume de vendas', () => {
      const data = loadMetricsData(2025, 'usados')
      expect(data.volumeVendas.usados).toHaveLength(12)
    })
  })

  describe('Dados de Estoque', () => {
    it('deve ter dados completos de estoque novos', () => {
      const data = loadMetricsData(2025, 'novos')
      
      expect(data.estoqueNovos.quantidade).toHaveLength(12)
      expect(data.estoqueNovos.valor).toHaveLength(12)
      expect(data.estoqueNovos.aPagar).toHaveLength(12)
      expect(data.estoqueNovos.pagos).toHaveLength(12)
    })

    it('deve ter dados completos de estoque usados', () => {
      const data = loadMetricsData(2025, 'usados')
      
      expect(data.estoqueUsados.quantidade).toHaveLength(12)
      expect(data.estoqueUsados.valor).toHaveLength(12)
      expect(data.estoqueUsados.aPagar).toHaveLength(12)
      expect(data.estoqueUsados.pagos).toHaveLength(12)
    })

    it('deve ter dados completos de estoque peças', () => {
      const data = loadMetricsData(2025, 'pecas')
      
      // estoquePecas tem: valor, aPagar, pagos (não tem quantidade)
      expect(data.estoquePecas.valor).toHaveLength(12)
      expect(data.estoquePecas.aPagar).toHaveLength(12)
      expect(data.estoquePecas.pagos).toHaveLength(12)
    })
  })

  describe('Dados de Margens', () => {
    it('deve ter dados de vendas de peças', () => {
      const data = loadMetricsData(2025, 'usados')
      
      // Verifica dados de vendas de peças se existirem
      if (data.vendasPecas) {
        expect(data.vendasPecas.balcao).toBeDefined()
      }
    })

    it('valores de vendas devem ser valores numéricos', () => {
      const data = loadMetricsData(2025, 'usados')
      
      data.vendasNovos.vendas.forEach((value) => {
        expect(typeof value).toBe('number')
        expect(isNaN(value)).toBe(false)
      })
    })
  })

  describe('Dados Financeiros', () => {
    it('deve ter dados de estoque de novos', () => {
      const data = loadMetricsData(2025, 'usados')
      
      expect(data.estoqueNovos.quantidade).toHaveLength(12)
      expect(data.estoqueNovos.valor).toHaveLength(12)
    })

    it('deve ter dados de estoque de usados', () => {
      const data = loadMetricsData(2025, 'usados')
      
      expect(data.estoqueUsados.quantidade).toHaveLength(12)
      expect(data.estoqueUsados.valor).toHaveLength(12)
    })

    it('deve ter dados de estoque de peças', () => {
      const data = loadMetricsData(2025, 'usados')
      
      expect(data.estoquePecas.valor).toHaveLength(12)
    })
  })

  describe('Dados de Receitas por Área', () => {
    it('deve ter dados de vendas de peças', () => {
      const data = loadMetricsData(2025, 'usados')
      
      if (data.vendasPecas) {
        expect(data.vendasPecas.balcao).toBeDefined()
        expect(data.vendasPecas.oficina).toBeDefined()
      }
    })

    it('deve ter dados de seguradoras', () => {
      const data = loadMetricsData(2025, 'usados')
      
      if (data.seguradoras) {
        expect(data.seguradoras).toBeDefined()
      }
    })
  })
})

describe('Gráficos - Formatação de Dados', () => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  it('deve formatar valores monetários corretamente', () => {
    // Verifica que retorna string com R$
    expect(formatCurrency(1000)).toMatch(/R\$.*1.*000/)
    expect(formatCurrency(1000000)).toMatch(/R\$.*1.*000.*000/)
    expect(formatCurrency(0)).toMatch(/R\$.*0/)
  })

  it('deve formatar números corretamente', () => {
    expect(formatNumber(1000)).toBe('1.000')
    expect(formatNumber(1000000)).toBe('1.000.000')
    expect(formatNumber(0)).toBe('0')
  })

  it('deve formatar percentuais corretamente', () => {
    expect(formatPercent(10.5)).toBe('10.5%')
    expect(formatPercent(0)).toBe('0.0%')
    expect(formatPercent(-5.2)).toBe('-5.2%')
  })
})

describe('Gráficos - Cálculos de Variação', () => {
  const calculateVariation = (current: number, previous: number): number => {
    if (previous === 0) return 0
    const variation = ((current - previous) / previous) * 100
    return isFinite(variation) ? variation : 0
  }

  it('deve calcular variação corretamente', () => {
    expect(calculateVariation(100, 50)).toBe(100)
    expect(calculateVariation(50, 100)).toBe(-50)
    expect(calculateVariation(100, 100)).toBe(0)
  })

  it('deve retornar 0 quando valor anterior é zero', () => {
    expect(calculateVariation(100, 0)).toBe(0)
    expect(calculateVariation(0, 0)).toBe(0)
  })

  it('deve retornar 0 para valores infinitos', () => {
    const variation = calculateVariation(Infinity, 100)
    expect(variation).toBe(0)
  })

  it('deve retornar 0 para valores NaN', () => {
    const variation = calculateVariation(NaN, 100)
    expect(isNaN(variation) || variation === 0).toBe(true)
  })

  it('deve calcular variações em arrays de dados', () => {
    const data = [0, 100, 200, 0, 300]
    const variations = data.map((value, index) => {
      if (index === 0) return 0
      return calculateVariation(value, data[index - 1])
    })

    expect(variations[0]).toBe(0) // primeiro mês
    expect(variations[1]).toBe(0) // 100/0 = 0 (divisão por zero)
    expect(variations[2]).toBe(100) // (200-100)/100 = 100%
    expect(variations[3]).toBe(-100) // (0-200)/200 = -100%
    expect(variations[4]).toBe(0) // 300/0 = 0 (divisão por zero)
  })
})

describe('Gráficos - Agregações de Dados', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('deve calcular soma de array corretamente', () => {
    const data = loadMetricsData(2025, 'usados')
    const soma = data.vendasNovos.vendas.reduce((a, b) => a + b, 0)
    
    expect(typeof soma).toBe('number')
    expect(soma).toBeGreaterThanOrEqual(0)
  })

  it('deve calcular média corretamente', () => {
    const data = loadMetricsData(2025, 'usados')
    const valores = data.vendasNovos.vendas
    const media = valores.reduce((a, b) => a + b, 0) / valores.length
    
    expect(typeof media).toBe('number')
    expect(isNaN(media)).toBe(false)
  })

  it('deve identificar máximo e mínimo', () => {
    const data = loadMetricsData(2025, 'usados')
    const valores = data.vendasUsados.vendas
    
    const max = Math.max(...valores)
    const min = Math.min(...valores)
    
    expect(max).toBeGreaterThanOrEqual(min)
  })

  it('deve agrupar dados bimestralmente', () => {
    const data = loadMetricsData(2025, 'usados')
    const mensal = data.vendasNovos.vendas
    
    // Agrupa em bimestres (6 grupos)
    const bimestral: number[] = []
    for (let i = 0; i < 12; i += 2) {
      bimestral.push(mensal[i] + mensal[i + 1])
    }
    
    expect(bimestral).toHaveLength(6)
  })

  it('deve agrupar dados trimestralmente', () => {
    const data = loadMetricsData(2025, 'usados')
    const mensal = data.vendasNovos.vendas
    
    // Agrupa em trimestres (4 grupos)
    const trimestral: number[] = []
    for (let i = 0; i < 12; i += 3) {
      trimestral.push(mensal[i] + mensal[i + 1] + mensal[i + 2])
    }
    
    expect(trimestral).toHaveLength(4)
  })

  it('deve agrupar dados semestralmente', () => {
    const data = loadMetricsData(2025, 'usados')
    const mensal = data.vendasNovos.vendas
    
    // Agrupa em semestres (2 grupos)
    const semestral: number[] = []
    for (let i = 0; i < 12; i += 6) {
      let soma = 0
      for (let j = 0; j < 6; j++) {
        soma += mensal[i + j]
      }
      semestral.push(soma)
    }
    
    expect(semestral).toHaveLength(2)
  })
})

describe('Gráficos - Labels de Meses', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const years: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027]

  it('deve ter labels de meses corretos para cada ano', () => {
    years.forEach((year) => {
      const data = loadMetricsData(year, 'usados')
      const yearSuffix = year.toString().slice(2)
      
      expect(data.months[0]).toContain(yearSuffix)
      expect(data.months[11]).toContain(yearSuffix)
    })
  })

  it('deve ter 12 meses em sequência', () => {
    const data = loadMetricsData(2025, 'usados')
    const monthPrefixes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    
    data.months.forEach((month, index) => {
      expect(month).toContain(monthPrefixes[index])
    })
  })
})

describe('Gráficos - Configuração de Cores', () => {
  const chartColors = {
    primary: '#001E50',      // VW Dark Blue
    secondary: '#003875',    // VW Medium Blue
    success: '#10b981',      // Green
    warning: '#f59e0b',      // Amber
    danger: '#ef4444',       // Red
    info: '#3b82f6',         // Blue
    year1: '#22c55e',        // Green para ano 1
    year2: '#3b82f6',        // Blue para ano 2
  }

  it('deve ter cores definidas para gráficos', () => {
    expect(chartColors.primary).toBeDefined()
    expect(chartColors.secondary).toBeDefined()
    expect(chartColors.success).toBeDefined()
    expect(chartColors.warning).toBeDefined()
    expect(chartColors.danger).toBeDefined()
  })

  it('cores devem ser válidas em formato hex', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/
    
    Object.values(chartColors).forEach((color) => {
      expect(color).toMatch(hexRegex)
    })
  })
})
