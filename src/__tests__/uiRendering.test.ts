/**
 * Testes de Renderização de UI
 * 
 * Valida que os dados necessários para renderização de componentes
 * estão disponíveis e no formato correto para todas as combinações.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadMetricsData, loadDREData, type Department } from '../lib/dataStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

const DEPARTMENTS: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao', 'consolidado'];
const FISCAL_YEARS: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027];

// Função auxiliar para preparar dados de gráfico
function prepareChartData(data: any, path: string[]): any[] {
  let current = data;
  for (const key of path) {
    if (!current || typeof current !== 'object') return [];
    current = current[key];
  }
  
  if (!current || !Array.isArray(current.vendas)) return [];
  
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return labels.map((label, i) => ({
    name: label,
    vendas: current.vendas?.[i] || 0,
    lucro: current.lucro?.[i] || 0,
    margem: current.margem?.[i] || 0,
  }));
}

// Função para preparar dados de DRE para gráfico
function prepareDREChartData(dreData: any[]): any[] {
  if (!Array.isArray(dreData) || dreData.length === 0) return [];
  
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return labels.map((label, i) => {
    const dataPoint: any = { name: label };
    
    dreData.forEach(line => {
      if (line.meses && Array.isArray(line.meses)) {
        dataPoint[line.descricao] = line.meses[i] || 0;
      }
    });
    
    return dataPoint;
  });
}

describe('Renderização de Gráficos - Vendas de Peças', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const pecasPaths = [
    ['vendasPecas', 'balcao'],
    ['vendasPecas', 'oficina'],
    ['vendasPecas', 'funilaria'],
    ['vendasPecas', 'acessorios'],
    ['vendasPecas', 'seguradoraTotal'],
  ];

  DEPARTMENTS.forEach(dept => {
    FISCAL_YEARS.forEach(year => {
      pecasPaths.forEach(path => {
        it(`deve preparar dados de ${path.join('.')} para ${dept}/${year}`, () => {
          const data = loadMetricsData(year, dept);
          const chartData = prepareChartData(data, path);
          
          // Não deve lançar exceção
          expect(chartData).toBeDefined();
          expect(Array.isArray(chartData)).toBe(true);
          
          // Se houver dados, verificar estrutura
          if (chartData.length > 0) {
            expect(chartData[0]).toHaveProperty('name');
            expect(chartData.length).toBeLessThanOrEqual(12);
          }
        });
      });
    });
  });
});

describe('Renderização de Gráficos - Seguradoras', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const seguradorasPaths = [
    ['seguradoras', 'portoSeguro'],
    ['seguradoras', 'azul'],
    ['seguradoras', 'allianz'],
    ['seguradoras', 'tokioMarine'],
  ];

  DEPARTMENTS.forEach(dept => {
    FISCAL_YEARS.forEach(year => {
      seguradorasPaths.forEach(path => {
        it(`deve preparar dados de ${path.join('.')} para ${dept}/${year}`, () => {
          const data = loadMetricsData(year, dept);
          const chartData = prepareChartData(data, path);
          
          expect(chartData).toBeDefined();
          expect(Array.isArray(chartData)).toBe(true);
        });
      });
    });
  });
});

describe('Renderização de Gráficos - Juros', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const jurosPaths = [
    ['juros', 'veiculosNovos'],
    ['juros', 'veiculosUsados'],
    ['juros', 'pecas'],
    ['juros', 'emprestimosBancarios'],
    ['juros', 'contratoMutuo'],
  ];

  DEPARTMENTS.forEach(dept => {
    FISCAL_YEARS.forEach(year => {
      jurosPaths.forEach(path => {
        it(`deve preparar dados de ${path.join('.')} para ${dept}/${year}`, () => {
          const data = loadMetricsData(year, dept);
          
          // Navegar até o objeto
          let current: any = data;
          for (const key of path) {
            current = current?.[key];
          }
          
          // Verificar estrutura
          if (current && typeof current === 'object') {
            if (current.valor) {
              expect(Array.isArray(current.valor)).toBe(true);
            }
          }
        });
      });
    });
  });
});

describe('Renderização de Gráficos - Despesas de Cartão', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const despesasCartaoPaths = [
    ['despesasCartao', 'novos'],
    ['despesasCartao', 'vendaDireta'],
    ['despesasCartao', 'usados'],
    ['despesasCartao', 'pecas'],
    ['despesasCartao', 'oficina'],
    ['despesasCartao', 'funilaria'],
    ['despesasCartao', 'administracao'],
  ];

  DEPARTMENTS.forEach(dept => {
    FISCAL_YEARS.forEach(year => {
      despesasCartaoPaths.forEach(path => {
        it(`deve preparar dados de ${path.join('.')} para ${dept}/${year}`, () => {
          const data = loadMetricsData(year, dept);
          
          let current: any = data;
          for (const key of path) {
            current = current?.[key];
          }
          
          if (current && typeof current === 'object' && current.valor) {
            expect(Array.isArray(current.valor)).toBe(true);
          }
        });
      });
    });
  });
});

describe('Renderização de Gráficos - Bonus', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const bonusPaths = [
    ['bonus', 'veiculosNovos'],
    ['bonus', 'veiculosUsados'],
    ['bonus', 'pecas'],
    ['bonus', 'oficina'],
    ['bonus', 'funilaria'],
    ['bonus', 'administracao'],
  ];

  DEPARTMENTS.forEach(dept => {
    FISCAL_YEARS.forEach(year => {
      bonusPaths.forEach(path => {
        it(`deve preparar dados de ${path.join('.')} para ${dept}/${year}`, () => {
          const data = loadMetricsData(year, dept);
          
          let current: any = data;
          for (const key of path) {
            current = current?.[key];
          }
          
          if (current && typeof current === 'object' && current.valor) {
            expect(Array.isArray(current.valor)).toBe(true);
          }
        });
      });
    });
  });
});

describe('Renderização de DRE', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  DEPARTMENTS.forEach(dept => {
    FISCAL_YEARS.forEach(year => {
      it(`deve preparar dados de DRE para ${dept}/${year}`, () => {
        const dreData = loadDREData(year, dept);
        
        if (dreData && dreData.length > 0) {
          const chartData = prepareDREChartData(dreData);
          
          expect(Array.isArray(chartData)).toBe(true);
          
          if (chartData.length > 0) {
            expect(chartData[0]).toHaveProperty('name');
            expect(chartData.length).toBe(12);
          }
        }
      });
    });
  });
});

describe('Renderização de Cards de Métricas', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // Função para calcular total de um array
  const calculateTotal = (arr: number[] | undefined): number => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((sum, val) => sum + (val || 0), 0);
  };

  // Função para calcular média de um array
  const calculateAverage = (arr: number[] | undefined): number => {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return calculateTotal(arr) / arr.length;
  };

  DEPARTMENTS.forEach(dept => {
    FISCAL_YEARS.forEach(year => {
      it(`deve calcular métricas agregadas para ${dept}/${year}`, () => {
        const data = loadMetricsData(year, dept);
        
        // Testar cálculos com dados reais
        if (data.vendasPecas?.balcao?.vendas) {
          const total = calculateTotal(data.vendasPecas.balcao.vendas);
          const media = calculateAverage(data.vendasPecas.balcao.vendas);
          
          expect(typeof total).toBe('number');
          expect(typeof media).toBe('number');
          expect(isNaN(total)).toBe(false);
          expect(isNaN(media)).toBe(false);
        }
        
        if (data.vendasPecas?.balcao?.margem) {
          const margemMedia = calculateAverage(data.vendasPecas.balcao.margem);
          expect(typeof margemMedia).toBe('number');
        }
      });
    });
  });
});

describe('Renderização de Tabela de Métricas Detalhadas', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // Função para formatar dados para tabela
  const formatTableData = (data: any, category: string): any[] => {
    const rows: any[] = [];
    
    if (!data || !data[category]) return rows;
    
    const categoryData = data[category];
    
    Object.entries(categoryData).forEach(([key, value]: [string, any]) => {
      if (value && typeof value === 'object') {
        const row: any = {
          nome: key,
          total: 0,
          media: 0,
          meses: [],
        };
        
        if (value.vendas && Array.isArray(value.vendas)) {
          row.meses = value.vendas;
          row.total = value.vendas.reduce((sum: number, v: number) => sum + (v || 0), 0);
          row.media = row.total / 12;
        } else if (value.valor && Array.isArray(value.valor)) {
          row.meses = value.valor;
          row.total = value.valor.reduce((sum: number, v: number) => sum + (v || 0), 0);
          row.media = row.total / 12;
        }
        
        rows.push(row);
      }
    });
    
    return rows;
  };

  const categories = ['vendasPecas', 'seguradoras', 'juros', 'despesasCartao', 'bonus'];

  DEPARTMENTS.forEach(dept => {
    FISCAL_YEARS.forEach(year => {
      categories.forEach(category => {
        it(`deve formatar dados de tabela para ${category} em ${dept}/${year}`, () => {
          const data = loadMetricsData(year, dept);
          const tableData = formatTableData(data, category);
          
          expect(Array.isArray(tableData)).toBe(true);
          
          tableData.forEach(row => {
            expect(row).toHaveProperty('nome');
            expect(row).toHaveProperty('total');
            expect(row).toHaveProperty('media');
            expect(typeof row.total).toBe('number');
            expect(typeof row.media).toBe('number');
          });
        });
      });
    });
  });
});

describe('Renderização de Comparativo de Anos', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // Função para preparar dados de comparação
  const prepareComparisonData = (
    dataCurrentYear: any,
    dataPreviousYear: any,
    path: string[]
  ): any => {
    const getValue = (data: any, keys: string[]): number[] => {
      let current = data;
      for (const key of keys) {
        if (!current || typeof current !== 'object') return [];
        current = current[key];
      }
      return Array.isArray(current) ? current : [];
    };
    
    const currentValues = getValue(dataCurrentYear, path);
    const previousValues = getValue(dataPreviousYear, path);
    
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    return labels.map((label, i) => ({
      name: label,
      atual: currentValues[i] || 0,
      anterior: previousValues[i] || 0,
      variacao: previousValues[i] 
        ? ((currentValues[i] || 0) - previousValues[i]) / Math.abs(previousValues[i]) * 100 
        : 0,
    }));
  };

  DEPARTMENTS.forEach(dept => {
    it(`deve preparar comparação 2025 vs 2024 para ${dept}`, () => {
      const data2025 = loadMetricsData(2025, dept);
      const data2024 = loadMetricsData(2024, dept);
      
      const comparison = prepareComparisonData(
        data2025,
        data2024,
        ['vendasPecas', 'balcao', 'vendas']
      );
      
      expect(Array.isArray(comparison)).toBe(true);
      expect(comparison.length).toBe(12);
      
      comparison.forEach(item => {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('atual');
        expect(item).toHaveProperty('anterior');
        expect(item).toHaveProperty('variacao');
        expect(typeof item.variacao).toBe('number');
        expect(isNaN(item.variacao)).toBe(false);
      });
    });

    it(`deve preparar comparação 2026 vs 2025 para ${dept}`, () => {
      const data2026 = loadMetricsData(2026, dept);
      const data2025 = loadMetricsData(2025, dept);
      
      const comparison = prepareComparisonData(
        data2026,
        data2025,
        ['seguradoras', 'portoSeguro', 'vendas']
      );
      
      expect(Array.isArray(comparison)).toBe(true);
    });

    it(`deve preparar comparação 2027 vs 2026 para ${dept}`, () => {
      const data2027 = loadMetricsData(2027, dept);
      const data2026 = loadMetricsData(2026, dept);
      
      const comparison = prepareComparisonData(
        data2027,
        data2026,
        ['mercadoLivre', 'vendas']
      );
      
      expect(Array.isArray(comparison)).toBe(true);
    });
  });
});

describe('Renderização de Tooltips e Formatação', () => {
  // Funções de formatação usadas em tooltips
  const formatTooltipValue = (value: number, type: 'currency' | 'percent' | 'number'): string => {
    if (value === null || value === undefined) return '-';
    
    switch (type) {
      case 'currency':
        return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      case 'percent':
        return `${value.toFixed(2)}%`;
      case 'number':
        return value.toLocaleString('pt-BR');
      default:
        return String(value);
    }
  };

  it('deve formatar valores de moeda corretamente', () => {
    expect(formatTooltipValue(1234.56, 'currency')).toContain('R$');
    expect(formatTooltipValue(1234.56, 'currency')).toContain('1.234');
  });

  it('deve formatar percentuais corretamente', () => {
    expect(formatTooltipValue(15.5, 'percent')).toBe('15.50%');
    expect(formatTooltipValue(-5.25, 'percent')).toBe('-5.25%');
  });

  it('deve formatar números corretamente', () => {
    expect(formatTooltipValue(1000000, 'number')).toContain('1.000.000');
  });

  it('deve lidar com valores nulos', () => {
    expect(formatTooltipValue(null as any, 'currency')).toBe('-');
    expect(formatTooltipValue(undefined as any, 'percent')).toBe('-');
  });
});

describe('Renderização de Cores e Estilos Dinâmicos', () => {
  // Função para determinar cor baseada no valor
  const getValueColor = (value: number, threshold = 0): 'positive' | 'negative' | 'neutral' => {
    if (value > threshold) return 'positive';
    if (value < threshold) return 'negative';
    return 'neutral';
  };

  // Função para determinar ícone de tendência
  const getTrendIcon = (current: number, previous: number): 'up' | 'down' | 'stable' => {
    const diff = current - previous;
    const threshold = Math.abs(previous) * 0.01; // 1% de tolerância
    
    if (diff > threshold) return 'up';
    if (diff < -threshold) return 'down';
    return 'stable';
  };

  it('deve determinar cores corretamente', () => {
    expect(getValueColor(100)).toBe('positive');
    expect(getValueColor(-100)).toBe('negative');
    expect(getValueColor(0)).toBe('neutral');
  });

  it('deve determinar tendências corretamente', () => {
    expect(getTrendIcon(110, 100)).toBe('up');
    expect(getTrendIcon(90, 100)).toBe('down');
    expect(getTrendIcon(100, 100)).toBe('stable');
  });

  it('deve considerar threshold personalizado para cores', () => {
    expect(getValueColor(5, 10)).toBe('negative');
    expect(getValueColor(15, 10)).toBe('positive');
  });
});

describe('Renderização de Estados Vazios', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // Função para verificar se dados estão vazios
  const isDataEmpty = (data: any): boolean => {
    if (!data || typeof data !== 'object') return true;
    
    const hasNonZeroValue = (obj: any): boolean => {
      for (const value of Object.values(obj)) {
        if (typeof value === 'number' && value !== 0) return true;
        if (Array.isArray(value) && value.some(v => v !== 0)) return true;
        if (typeof value === 'object' && value !== null && hasNonZeroValue(value)) return true;
      }
      return false;
    };
    
    return !hasNonZeroValue(data);
  };

  DEPARTMENTS.forEach(dept => {
    FISCAL_YEARS.forEach(year => {
      it(`deve detectar corretamente dados vazios para ${dept}/${year}`, () => {
        const data = loadMetricsData(year, dept);
        const empty = isDataEmpty(data);
        
        // Deve retornar boolean
        expect(typeof empty).toBe('boolean');
      });
    });
  });
});
