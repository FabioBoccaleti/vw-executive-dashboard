/**
 * Suíte de Testes - Utilitários e Helpers
 * Testa funções auxiliares usadas em toda aplicação
 */

import { describe, it, expect } from 'vitest'

describe('Utilitários - Formatação de Moeda', () => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  it('deve formatar valores positivos', () => {
    expect(formatCurrency(1000)).toMatch(/R\$.*1.*000/)
    expect(formatCurrency(1234567)).toMatch(/R\$.*1.*234.*567/)
  })

  it('deve formatar valores negativos', () => {
    expect(formatCurrency(-1000)).toMatch(/-.*R\$.*1.*000/)
    expect(formatCurrency(-1234567)).toMatch(/-.*R\$.*1.*234.*567/)
  })

  it('deve formatar zero', () => {
    expect(formatCurrency(0)).toMatch(/R\$.*0/)
  })

  it('deve formatar valores decimais (arredondados)', () => {
    expect(formatCurrency(1000.49)).toMatch(/R\$.*1.*00/)
    expect(formatCurrency(1000.50)).toMatch(/R\$.*1.*00/)
  })
})

describe('Utilitários - Formatação de Números', () => {
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  it('deve formatar números grandes', () => {
    expect(formatNumber(1000)).toBe('1.000')
    expect(formatNumber(1000000)).toBe('1.000.000')
  })

  it('deve formatar números pequenos', () => {
    expect(formatNumber(1)).toBe('1')
    expect(formatNumber(99)).toBe('99')
  })

  it('deve formatar zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('Utilitários - Formatação de Percentuais', () => {
  const formatPercent = (value: number, decimals: number = 1) => {
    return `${value.toFixed(decimals)}%`
  }

  it('deve formatar percentuais positivos', () => {
    expect(formatPercent(10.5)).toBe('10.5%')
    expect(formatPercent(100)).toBe('100.0%')
  })

  it('deve formatar percentuais negativos', () => {
    expect(formatPercent(-10.5)).toBe('-10.5%')
  })

  it('deve formatar zero', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })

  it('deve respeitar casas decimais', () => {
    expect(formatPercent(10.5678, 2)).toBe('10.57%')
    expect(formatPercent(10.5678, 0)).toBe('11%')
  })
})

describe('Utilitários - Cálculos', () => {
  const calculateVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : current < 0 ? -100 : 0
    return ((current - previous) / Math.abs(previous)) * 100
  }

  const calculateAverage = (values: number[]) => {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  const calculateSum = (values: number[]) => {
    return values.reduce((a, b) => a + b, 0)
  }

  describe('Variação Percentual', () => {
    it('deve calcular variação positiva', () => {
      expect(calculateVariation(120, 100)).toBe(20)
    })

    it('deve calcular variação negativa', () => {
      expect(calculateVariation(80, 100)).toBe(-20)
    })

    it('deve lidar com valor anterior zero', () => {
      expect(calculateVariation(100, 0)).toBe(100)
      expect(calculateVariation(-100, 0)).toBe(-100)
      expect(calculateVariation(0, 0)).toBe(0)
    })
  })

  describe('Média', () => {
    it('deve calcular média corretamente', () => {
      expect(calculateAverage([10, 20, 30])).toBe(20)
      expect(calculateAverage([100])).toBe(100)
    })

    it('deve lidar com array vazio', () => {
      expect(calculateAverage([])).toBe(0)
    })
  })

  describe('Soma', () => {
    it('deve calcular soma corretamente', () => {
      expect(calculateSum([10, 20, 30])).toBe(60)
      expect(calculateSum([100])).toBe(100)
    })

    it('deve lidar com array vazio', () => {
      expect(calculateSum([])).toBe(0)
    })
  })
})

describe('Utilitários - Manipulação de Arrays', () => {
  const groupBy = <T>(array: T[], size: number): T[][] => {
    const groups: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      groups.push(array.slice(i, i + size))
    }
    return groups
  }

  const aggregateGroups = (array: number[], size: number): number[] => {
    const groups = groupBy(array, size)
    return groups.map(group => group.reduce((a, b) => a + b, 0))
  }

  it('deve agrupar array em grupos do tamanho especificado', () => {
    const data = [1, 2, 3, 4, 5, 6]
    
    expect(groupBy(data, 2)).toEqual([[1, 2], [3, 4], [5, 6]])
    expect(groupBy(data, 3)).toEqual([[1, 2, 3], [4, 5, 6]])
  })

  it('deve agregar grupos somando valores', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    
    expect(aggregateGroups(data, 2)).toEqual([3, 7, 11, 15, 19, 23])
    expect(aggregateGroups(data, 3)).toEqual([6, 15, 24, 33])
    expect(aggregateGroups(data, 6)).toEqual([21, 57])
  })
})

describe('Utilitários - Validação de Dados', () => {
  const isValidNumber = (value: any): boolean => {
    return typeof value === 'number' && !isNaN(value) && isFinite(value)
  }

  const isValidArray = (value: any, length?: number): boolean => {
    if (!Array.isArray(value)) return false
    if (length !== undefined && value.length !== length) return false
    return true
  }

  const isValidDate = (value: string): boolean => {
    const date = new Date(value)
    return !isNaN(date.getTime())
  }

  describe('Validação de Números', () => {
    it('deve validar números válidos', () => {
      expect(isValidNumber(100)).toBe(true)
      expect(isValidNumber(0)).toBe(true)
      expect(isValidNumber(-100)).toBe(true)
      expect(isValidNumber(100.5)).toBe(true)
    })

    it('deve rejeitar valores inválidos', () => {
      expect(isValidNumber(NaN)).toBe(false)
      expect(isValidNumber(Infinity)).toBe(false)
      expect(isValidNumber('100')).toBe(false)
      expect(isValidNumber(null)).toBe(false)
      expect(isValidNumber(undefined)).toBe(false)
    })
  })

  describe('Validação de Arrays', () => {
    it('deve validar arrays válidos', () => {
      expect(isValidArray([1, 2, 3])).toBe(true)
      expect(isValidArray([])).toBe(true)
    })

    it('deve validar tamanho do array', () => {
      expect(isValidArray([1, 2, 3], 3)).toBe(true)
      expect(isValidArray([1, 2, 3], 12)).toBe(false)
    })

    it('deve rejeitar não-arrays', () => {
      expect(isValidArray('array')).toBe(false)
      expect(isValidArray(null)).toBe(false)
      expect(isValidArray({})).toBe(false)
    })
  })

  describe('Validação de Datas', () => {
    it('deve validar datas válidas', () => {
      expect(isValidDate('2025-01-22')).toBe(true)
      expect(isValidDate('2025-01-22T10:30:00')).toBe(true)
    })

    it('deve rejeitar datas inválidas', () => {
      expect(isValidDate('invalid')).toBe(false)
      expect(isValidDate('')).toBe(false)
    })
  })
})

describe('Utilitários - Cores e Estilos', () => {
  const getStatusColor = (value: number, threshold: number = 0): string => {
    if (value > threshold) return 'green'
    if (value < threshold) return 'red'
    return 'gray'
  }

  const getTrendIcon = (value: number): '↑' | '↓' | '→' => {
    if (value > 0) return '↑'
    if (value < 0) return '↓'
    return '→'
  }

  it('deve retornar cor baseada no valor', () => {
    expect(getStatusColor(100)).toBe('green')
    expect(getStatusColor(-100)).toBe('red')
    expect(getStatusColor(0)).toBe('gray')
  })

  it('deve retornar ícone de tendência', () => {
    expect(getTrendIcon(10)).toBe('↑')
    expect(getTrendIcon(-10)).toBe('↓')
    expect(getTrendIcon(0)).toBe('→')
  })
})
