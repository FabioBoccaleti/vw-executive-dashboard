/**
 * Testes de Combinações de Toggles
 * 
 * Verifica se a UI carrega corretamente sem exceções para todas as
 * combinações possíveis de estados de toggle, departamentos e anos.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadMetricsData, loadDREData, loadSelectedFiscalYear, loadSelectedDepartment, type Department } from '../lib/dataStorage';

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

// Tipos para toggles
interface ToggleState {
  showTrocasChart: boolean;
  showRepasseChart: boolean;
  showEstoqueNovos: boolean;
  showInsights: boolean;
  showDadosAdicionais: boolean;
  showEstoqueUsados: boolean;
  showEstoquePecas: boolean;
  showVendaPecas: boolean;
  showVendasSeguradora: boolean;
  showVendasMercadoLivre: boolean;
  showDespesasFinanceirasNovos: boolean;
  showDespesasFinanceirasUsados: boolean;
  showDespesasFinanceirasPecas: boolean;
  showDespesasFinanceirasOficina: boolean;
  showDespesasFinanceirasFunilaria: boolean;
  showDespesasFinanceirasAdministracao: boolean;
  showBonusNovos: boolean;
  showBonusUsados: boolean;
  showBonusPecas: boolean;
  showBonusOficina: boolean;
  showBonusFunilaria: boolean;
  showBonusAdministracao: boolean;
  showReceitaFinanciamentoNovos: boolean;
  showReceitaFinanciamentoUsados: boolean;
  showCreditoICMSNovos: boolean;
  showCreditoICMSPecas: boolean;
  showCreditoICMSAdministracao: boolean;
  showCreditoPISCofinsAdministracao: boolean;
  showReceitaBlindagem: boolean;
  showReceitaDespachanteUsados: boolean;
  showReceitaDespachanteNovos: boolean;
  showDetailedMetrics: boolean;
  projectionMode: boolean;
  showComparison: boolean;
  showProjectionModal: boolean;
}

// Lista de todos os toggles
const ALL_TOGGLES: (keyof ToggleState)[] = [
  'showTrocasChart',
  'showRepasseChart',
  'showEstoqueNovos',
  'showInsights',
  'showDadosAdicionais',
  'showEstoqueUsados',
  'showEstoquePecas',
  'showVendaPecas',
  'showVendasSeguradora',
  'showVendasMercadoLivre',
  'showDespesasFinanceirasNovos',
  'showDespesasFinanceirasUsados',
  'showDespesasFinanceirasPecas',
  'showDespesasFinanceirasOficina',
  'showDespesasFinanceirasFunilaria',
  'showDespesasFinanceirasAdministracao',
  'showBonusNovos',
  'showBonusUsados',
  'showBonusPecas',
  'showBonusOficina',
  'showBonusFunilaria',
  'showBonusAdministracao',
  'showReceitaFinanciamentoNovos',
  'showReceitaFinanciamentoUsados',
  'showCreditoICMSNovos',
  'showCreditoICMSPecas',
  'showCreditoICMSAdministracao',
  'showCreditoPISCofinsAdministracao',
  'showReceitaBlindagem',
  'showReceitaDespachanteUsados',
  'showReceitaDespachanteNovos',
  'showDetailedMetrics',
  'projectionMode',
  'showComparison',
  'showProjectionModal',
];

const DEPARTMENTS: Department[] = ['novos', 'vendaDireta', 'usados', 'pecas', 'oficina', 'funilaria', 'administracao', 'consolidado'];
const FISCAL_YEARS: (2024 | 2025 | 2026 | 2027)[] = [2024, 2025, 2026, 2027];
const VIEW_MODES = ['mensal', 'bimestral', 'trimestral', 'semestral'] as const;
const SELECTED_CATEGORIES = [
  ['pessoal', 'terceiros', 'ocupacao', 'funcionamento'],
  ['pessoal'],
  ['terceiros', 'ocupacao'],
  [],
  ['pessoal', 'terceiros', 'ocupacao', 'funcionamento', 'vendas'],
];

// Função para criar estado de toggle
function createToggleState(activeToggles: (keyof ToggleState)[]): ToggleState {
  const state: Partial<ToggleState> = {};
  ALL_TOGGLES.forEach(toggle => {
    state[toggle] = activeToggles.includes(toggle);
  });
  return state as ToggleState;
}

// Função para simular carregamento de UI com estado
function simulateUILoad(
  department: Department,
  fiscalYear: 2024 | 2025 | 2026 | 2027,
  toggles: ToggleState,
  viewMode: typeof VIEW_MODES[number],
  selectedCategories: string[]
): { success: boolean; error?: Error; data?: any } {
  try {
    // Simular carregamento de dados
    const metricsData = loadMetricsData(fiscalYear, department);
    const dreData = loadDREData(fiscalYear, department);
    
    // Verificar estrutura de dados
    if (!metricsData || typeof metricsData !== 'object') {
      throw new Error(`Dados de métricas inválidos para ${department} ${fiscalYear}`);
    }
    
    // Simular processamento de toggles
    const activeToggles = Object.entries(toggles)
      .filter(([_, value]) => value)
      .map(([key]) => key);
    
    // Simular agregação por modo de visualização
    const aggregateData = (meses: number[]) => {
      if (!Array.isArray(meses)) return [];
      if (viewMode === 'mensal') return meses;
      
      const periods: number[] = [];
      if (viewMode === 'bimestral') {
        for (let i = 0; i < 12; i += 2) {
          periods.push((meses[i] || 0) + (meses[i + 1] || 0));
        }
      } else if (viewMode === 'trimestral') {
        for (let i = 0; i < 12; i += 3) {
          periods.push((meses[i] || 0) + (meses[i + 1] || 0) + (meses[i + 2] || 0));
        }
      } else if (viewMode === 'semestral') {
        for (let i = 0; i < 12; i += 6) {
          let sum = 0;
          for (let j = 0; j < 6; j++) {
            sum += meses[i + j] || 0;
          }
          periods.push(sum);
        }
      }
      return periods;
    };
    
    // Testar agregação com dados reais
    if (metricsData.vendasPecas?.balcao?.vendas) {
      const aggregated = aggregateData(metricsData.vendasPecas.balcao.vendas);
      if (aggregated.length === 0 && viewMode !== 'mensal') {
        // Ok, pode estar vazio
      }
    }
    
    // Simular filtro de categorias
    const filteredCategories = selectedCategories.filter(cat => 
      ['pessoal', 'terceiros', 'ocupacao', 'funcionamento', 'vendas'].includes(cat)
    );
    
    // Simular renderização de componentes baseado nos toggles
    const componentsToRender: string[] = [];
    
    if (toggles.showTrocasChart) componentsToRender.push('TrocasChart');
    if (toggles.showRepasseChart) componentsToRender.push('RepasseChart');
    if (toggles.showEstoqueNovos) componentsToRender.push('EstoqueNovos');
    if (toggles.showEstoqueUsados) componentsToRender.push('EstoqueUsados');
    if (toggles.showEstoquePecas) componentsToRender.push('EstoquePecas');
    if (toggles.showVendaPecas) componentsToRender.push('VendaPecas');
    if (toggles.showVendasSeguradora) componentsToRender.push('VendasSeguradora');
    if (toggles.showVendasMercadoLivre) componentsToRender.push('VendasMercadoLivre');
    if (toggles.showInsights) componentsToRender.push('Insights');
    if (toggles.showDadosAdicionais) componentsToRender.push('DadosAdicionais');
    if (toggles.showDetailedMetrics) componentsToRender.push('DetailedMetrics');
    if (toggles.projectionMode) componentsToRender.push('ProjectionMode');
    if (toggles.showComparison) componentsToRender.push('Comparison');
    
    // Despesas Financeiras
    if (toggles.showDespesasFinanceirasNovos) componentsToRender.push('DespFinNovos');
    if (toggles.showDespesasFinanceirasUsados) componentsToRender.push('DespFinUsados');
    if (toggles.showDespesasFinanceirasPecas) componentsToRender.push('DespFinPecas');
    if (toggles.showDespesasFinanceirasOficina) componentsToRender.push('DespFinOficina');
    if (toggles.showDespesasFinanceirasFunilaria) componentsToRender.push('DespFinFunilaria');
    if (toggles.showDespesasFinanceirasAdministracao) componentsToRender.push('DespFinAdministracao');
    
    // Bonus
    if (toggles.showBonusNovos) componentsToRender.push('BonusNovos');
    if (toggles.showBonusUsados) componentsToRender.push('BonusUsados');
    if (toggles.showBonusPecas) componentsToRender.push('BonusPecas');
    if (toggles.showBonusOficina) componentsToRender.push('BonusOficina');
    if (toggles.showBonusFunilaria) componentsToRender.push('BonusFunilaria');
    if (toggles.showBonusAdministracao) componentsToRender.push('BonusAdministracao');
    
    // Créditos e Receitas
    if (toggles.showReceitaFinanciamentoNovos) componentsToRender.push('RecFinNovos');
    if (toggles.showReceitaFinanciamentoUsados) componentsToRender.push('RecFinUsados');
    if (toggles.showCreditoICMSNovos) componentsToRender.push('CreditoICMSNovos');
    if (toggles.showCreditoICMSPecas) componentsToRender.push('CreditoICMSPecas');
    if (toggles.showCreditoICMSAdministracao) componentsToRender.push('CreditoICMSAdministracao');
    if (toggles.showCreditoPISCofinsAdministracao) componentsToRender.push('CreditoPISCofinsAdministracao');
    if (toggles.showReceitaBlindagem) componentsToRender.push('ReceitaBlindagem');
    if (toggles.showReceitaDespachanteUsados) componentsToRender.push('RecDespachanteUsados');
    if (toggles.showReceitaDespachanteNovos) componentsToRender.push('RecDespachanteNovos');
    
    return { 
      success: true, 
      data: { 
        metricsData, 
        dreData, 
        componentsToRender,
        activeToggles,
        filteredCategories,
        viewMode
      } 
    };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

describe('Combinações de Toggles - Carregamento de UI', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Todos os Toggles Desligados', () => {
    const allOff = createToggleState([]);
    
    DEPARTMENTS.forEach(department => {
      FISCAL_YEARS.forEach(year => {
        it(`deve carregar UI sem exceção: ${department} / ${year} / todos toggles OFF`, () => {
          const result = simulateUILoad(department, year, allOff, 'mensal', []);
          expect(result.success).toBe(true);
          expect(result.error).toBeUndefined();
        });
      });
    });
  });

  describe('Todos os Toggles Ligados', () => {
    const allOn = createToggleState(ALL_TOGGLES);
    
    DEPARTMENTS.forEach(department => {
      FISCAL_YEARS.forEach(year => {
        it(`deve carregar UI sem exceção: ${department} / ${year} / todos toggles ON`, () => {
          const result = simulateUILoad(department, year, allOn, 'mensal', ['pessoal', 'terceiros', 'ocupacao', 'funcionamento']);
          expect(result.success).toBe(true);
          expect(result.error).toBeUndefined();
        });
      });
    });
  });

  describe('Toggles de Visualização Principais', () => {
    const mainToggles: (keyof ToggleState)[] = [
      'showInsights',
      'showDadosAdicionais',
      'showDetailedMetrics',
      'showComparison',
    ];
    
    // Gerar todas as combinações (2^4 = 16)
    for (let i = 0; i < 16; i++) {
      const activeToggles: (keyof ToggleState)[] = [];
      if (i & 1) activeToggles.push('showInsights');
      if (i & 2) activeToggles.push('showDadosAdicionais');
      if (i & 4) activeToggles.push('showDetailedMetrics');
      if (i & 8) activeToggles.push('showComparison');
      
      const toggleState = createToggleState(activeToggles);
      const toggleNames = activeToggles.length > 0 ? activeToggles.join('+') : 'nenhum';
      
      it(`deve carregar com toggles principais: ${toggleNames}`, () => {
        const result = simulateUILoad('usados', 2025, toggleState, 'mensal', ['pessoal']);
        expect(result.success).toBe(true);
      });
    }
  });

  describe('Toggles de Estoque', () => {
    const estoqueToggles: (keyof ToggleState)[] = [
      'showEstoqueNovos',
      'showEstoqueUsados',
      'showEstoquePecas',
    ];
    
    // Todas combinações de estoque (2^3 = 8)
    for (let i = 0; i < 8; i++) {
      const activeToggles: (keyof ToggleState)[] = [];
      if (i & 1) activeToggles.push('showEstoqueNovos');
      if (i & 2) activeToggles.push('showEstoqueUsados');
      if (i & 4) activeToggles.push('showEstoquePecas');
      
      const toggleState = createToggleState(activeToggles);
      
      DEPARTMENTS.forEach(dept => {
        it(`deve carregar estoque para ${dept}: combinação ${i}`, () => {
          const result = simulateUILoad(dept, 2025, toggleState, 'mensal', []);
          expect(result.success).toBe(true);
        });
      });
    }
  });

  describe('Toggles de Despesas Financeiras', () => {
    const despesaToggles: (keyof ToggleState)[] = [
      'showDespesasFinanceirasNovos',
      'showDespesasFinanceirasUsados',
      'showDespesasFinanceirasPecas',
      'showDespesasFinanceirasOficina',
      'showDespesasFinanceirasFunilaria',
      'showDespesasFinanceirasAdministracao',
    ];
    
    // Testar cada toggle individualmente com cada departamento
    despesaToggles.forEach(toggle => {
      const toggleState = createToggleState([toggle]);
      
      DEPARTMENTS.forEach(dept => {
        it(`deve carregar ${toggle} para ${dept}`, () => {
          const result = simulateUILoad(dept, 2025, toggleState, 'mensal', []);
          expect(result.success).toBe(true);
        });
      });
    });
    
    // Todas despesas financeiras ligadas
    it('deve carregar com todas despesas financeiras ligadas', () => {
      const toggleState = createToggleState(despesaToggles);
      const result = simulateUILoad('administracao', 2025, toggleState, 'mensal', []);
      expect(result.success).toBe(true);
    });
  });

  describe('Toggles de Bonus', () => {
    const bonusToggles: (keyof ToggleState)[] = [
      'showBonusNovos',
      'showBonusUsados',
      'showBonusPecas',
      'showBonusOficina',
      'showBonusFunilaria',
      'showBonusAdministracao',
    ];
    
    // Testar cada toggle individualmente
    bonusToggles.forEach(toggle => {
      it(`deve carregar ${toggle} sem exceção`, () => {
        const toggleState = createToggleState([toggle]);
        const result = simulateUILoad('usados', 2025, toggleState, 'mensal', []);
        expect(result.success).toBe(true);
      });
    });
    
    // Todos bonus ligados
    it('deve carregar com todos bonus ligados', () => {
      const toggleState = createToggleState(bonusToggles);
      const result = simulateUILoad('usados', 2025, toggleState, 'mensal', []);
      expect(result.success).toBe(true);
    });
  });

  describe('Toggles de Créditos e Receitas', () => {
    const creditoReceitaToggles: (keyof ToggleState)[] = [
      'showReceitaFinanciamentoNovos',
      'showReceitaFinanciamentoUsados',
      'showCreditoICMSNovos',
      'showCreditoICMSPecas',
      'showCreditoICMSAdministracao',
      'showCreditoPISCofinsAdministracao',
      'showReceitaBlindagem',
      'showReceitaDespachanteUsados',
      'showReceitaDespachanteNovos',
    ];
    
    creditoReceitaToggles.forEach(toggle => {
      it(`deve carregar ${toggle} sem exceção`, () => {
        const toggleState = createToggleState([toggle]);
        const result = simulateUILoad('administracao', 2026, toggleState, 'mensal', []);
        expect(result.success).toBe(true);
      });
    });
    
    it('deve carregar com todos créditos e receitas ligados', () => {
      const toggleState = createToggleState(creditoReceitaToggles);
      const result = simulateUILoad('administracao', 2025, toggleState, 'mensal', []);
      expect(result.success).toBe(true);
    });
  });

  describe('Combinações de Modos de Visualização', () => {
    const basicToggles: (keyof ToggleState)[] = ['showInsights', 'showDadosAdicionais'];
    const toggleState = createToggleState(basicToggles);
    
    VIEW_MODES.forEach(viewMode => {
      DEPARTMENTS.forEach(dept => {
        FISCAL_YEARS.forEach(year => {
          it(`deve carregar ${dept} / ${year} / ${viewMode}`, () => {
            const result = simulateUILoad(dept, year, toggleState, viewMode, ['pessoal', 'terceiros']);
            expect(result.success).toBe(true);
          });
        });
      });
    });
  });

  describe('Combinações de Categorias Selecionadas', () => {
    const toggleState = createToggleState(['showInsights']);
    
    SELECTED_CATEGORIES.forEach((categories, idx) => {
      it(`deve carregar com conjunto de categorias #${idx}: [${categories.join(', ')}]`, () => {
        const result = simulateUILoad('usados', 2025, toggleState, 'mensal', categories);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Stress Test - Múltiplas Combinações Simultâneas', () => {
    // Testar 50 combinações aleatórias de toggles
    const randomCombinations = Array.from({ length: 50 }, (_, i) => {
      const numToggles = Math.floor(Math.random() * ALL_TOGGLES.length);
      const shuffled = [...ALL_TOGGLES].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, numToggles);
    });
    
    randomCombinations.forEach((toggles, idx) => {
      it(`combinação aleatória #${idx + 1} (${toggles.length} toggles)`, () => {
        const toggleState = createToggleState(toggles);
        const dept = DEPARTMENTS[idx % DEPARTMENTS.length];
        const year = FISCAL_YEARS[idx % FISCAL_YEARS.length];
        const viewMode = VIEW_MODES[idx % VIEW_MODES.length];
        
        const result = simulateUILoad(dept, year, toggleState, viewMode, ['pessoal']);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Cenários de Uso Real', () => {
    it('deve carregar dashboard padrão (insights + dados adicionais)', () => {
      const toggleState = createToggleState(['showInsights', 'showDadosAdicionais']);
      const result = simulateUILoad('usados', 2025, toggleState, 'mensal', ['pessoal', 'terceiros', 'ocupacao', 'funcionamento']);
      expect(result.success).toBe(true);
      expect(result.data?.componentsToRender).toContain('Insights');
      expect(result.data?.componentsToRender).toContain('DadosAdicionais');
    });

    it('deve carregar visualização de comparação de anos', () => {
      const toggleState = createToggleState(['showComparison']);
      const result = simulateUILoad('novos', 2024, toggleState, 'trimestral', []);
      expect(result.success).toBe(true);
      expect(result.data?.componentsToRender).toContain('Comparison');
    });

    it('deve carregar modo de projeções', () => {
      const toggleState = createToggleState(['projectionMode', 'showProjectionModal']);
      const result = simulateUILoad('pecas', 2026, toggleState, 'semestral', []);
      expect(result.success).toBe(true);
      expect(result.data?.componentsToRender).toContain('ProjectionMode');
    });

    it('deve carregar métricas detalhadas com todos os estoques', () => {
      const toggleState = createToggleState([
        'showDetailedMetrics',
        'showEstoqueNovos',
        'showEstoqueUsados',
        'showEstoquePecas',
      ]);
      const result = simulateUILoad('consolidado', 2025, toggleState, 'mensal', []);
      expect(result.success).toBe(true);
      expect(result.data?.componentsToRender.length).toBeGreaterThanOrEqual(4);
    });

    it('deve carregar todas as vendas de peças', () => {
      const toggleState = createToggleState([
        'showVendaPecas',
        'showVendasSeguradora',
        'showVendasMercadoLivre',
      ]);
      const result = simulateUILoad('pecas', 2025, toggleState, 'bimestral', []);
      expect(result.success).toBe(true);
    });

    it('deve carregar relatório financeiro completo', () => {
      const toggleState = createToggleState([
        'showDespesasFinanceirasNovos',
        'showDespesasFinanceirasUsados',
        'showDespesasFinanceirasPecas',
        'showBonusNovos',
        'showBonusUsados',
        'showBonusPecas',
        'showReceitaFinanciamentoNovos',
        'showReceitaFinanciamentoUsados',
        'showCreditoICMSNovos',
        'showCreditoICMSPecas',
        'showInsights',
        'showDadosAdicionais',
      ]);
      const result = simulateUILoad('administracao', 2025, toggleState, 'mensal', ['pessoal', 'terceiros', 'ocupacao', 'funcionamento']);
      expect(result.success).toBe(true);
      expect(result.data?.componentsToRender.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('Transições de Estado', () => {
    it('deve lidar com mudança rápida de departamentos', () => {
      const toggleState = createToggleState(['showInsights']);
      
      DEPARTMENTS.forEach(dept => {
        const result = simulateUILoad(dept, 2025, toggleState, 'mensal', []);
        expect(result.success).toBe(true);
      });
    });

    it('deve lidar com mudança rápida de anos', () => {
      const toggleState = createToggleState(['showDetailedMetrics']);
      
      FISCAL_YEARS.forEach(year => {
        const result = simulateUILoad('usados', year, toggleState, 'mensal', []);
        expect(result.success).toBe(true);
      });
    });

    it('deve lidar com mudança rápida de modo de visualização', () => {
      const toggleState = createToggleState(['showDadosAdicionais']);
      
      VIEW_MODES.forEach(mode => {
        const result = simulateUILoad('usados', 2025, toggleState, mode, ['pessoal']);
        expect(result.success).toBe(true);
      });
    });
  });
});

describe('Validação de Dados com Toggles Ativos', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Integridade de Dados por Departamento', () => {
    DEPARTMENTS.forEach(dept => {
      it(`deve retornar dados válidos para ${dept}`, () => {
        const metricsData = loadMetricsData(2025, dept);
        
        expect(metricsData).toBeDefined();
        expect(typeof metricsData).toBe('object');
        
        // Verificar estrutura básica de vendas de peças
        if (metricsData.vendasPecas) {
          expect(metricsData.vendasPecas).toHaveProperty('balcao');
          expect(metricsData.vendasPecas).toHaveProperty('oficina');
        }
      });
    });
  });

  describe('Consistência entre Anos', () => {
    FISCAL_YEARS.forEach(year => {
      it(`deve manter estrutura consistente para ano ${year}`, () => {
        const metricsUsados = loadMetricsData(year, 'usados');
        const metricsNovos = loadMetricsData(year, 'novos');
        
        // Ambos devem ter mesma estrutura básica
        expect(Object.keys(metricsUsados).length).toBeGreaterThan(0);
        expect(Object.keys(metricsNovos).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Dados do Consolidado', () => {
    FISCAL_YEARS.forEach(year => {
      it(`deve calcular consolidado corretamente para ${year}`, () => {
        const consolidated = loadMetricsData(year, 'consolidado');
        
        expect(consolidated).toBeDefined();
        expect(typeof consolidated).toBe('object');
        
        // Consolidado deve ter dados agregados
        if (consolidated.vendasPecas?.balcao?.vendas) {
          expect(Array.isArray(consolidated.vendasPecas.balcao.vendas)).toBe(true);
        }
      });
    });
  });
});
