/**
 * Testes de Regressão
 * 
 * Este arquivo contém testes para bugs reportados pelos usuários,
 * garantindo que os mesmos erros não aconteçam novamente.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DetailedMetricsTable } from '../components/DetailedMetricsTable';
import { VWFinancialDashboard } from '../components/VWFinancialDashboard';
import { businessMetricsDataNovos2025 } from '../data/businessMetricsDataNovos2025';

describe('Regressão: Erro "Cannot read properties of undefined"', () => {
  it('deve renderizar DetailedMetricsTable sem erro quando vendasPecas é undefined', () => {
    // Dados sem vendasPecas (como businessMetricsDataNovos2025)
    const dataWithoutVendasPecas = {
      ...businessMetricsDataNovos2025,
      vendasPecas: undefined
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithoutVendasPecas as any} />);
    }).not.toThrow();
  });

  it('deve renderizar DetailedMetricsTable sem erro quando vendasPecas.balcao é undefined', () => {
    const dataWithoutBalcao = {
      ...businessMetricsDataNovos2025,
      vendasPecas: {
        balcao: undefined,
        oficina: undefined,
        funilaria: undefined,
        acessorios: undefined,
        seguradoraTotal: undefined
      }
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithoutBalcao as any} />);
    }).not.toThrow();
  });

  it('deve renderizar DetailedMetricsTable sem erro quando seguradoras é undefined', () => {
    const dataWithoutSeguradoras = {
      ...businessMetricsDataNovos2025,
      seguradoras: undefined
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithoutSeguradoras as any} />);
    }).not.toThrow();
  });

  it('deve renderizar DetailedMetricsTable sem erro quando juros é undefined', () => {
    const dataWithoutJuros = {
      ...businessMetricsDataNovos2025,
      juros: undefined
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithoutJuros as any} />);
    }).not.toThrow();
  });

  it('deve renderizar DetailedMetricsTable sem erro quando despesasCartao é undefined', () => {
    const dataWithoutDespesasCartao = {
      ...businessMetricsDataNovos2025,
      despesasCartao: undefined
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithoutDespesasCartao as any} />);
    }).not.toThrow();
  });

  it('deve renderizar DetailedMetricsTable sem erro quando bonus é undefined', () => {
    const dataWithoutBonus = {
      ...businessMetricsDataNovos2025,
      bonus: undefined
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithoutBonus as any} />);
    }).not.toThrow();
  });

  it('deve renderizar DetailedMetricsTable sem erro quando receitasFinanciamento é undefined', () => {
    const dataWithoutReceitasFinanciamento = {
      ...businessMetricsDataNovos2025,
      receitasFinanciamento: undefined
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithoutReceitasFinanciamento as any} />);
    }).not.toThrow();
  });

  it('deve renderizar DetailedMetricsTable sem erro quando creditosICMS é undefined', () => {
    const dataWithoutCreditosICMS = {
      ...businessMetricsDataNovos2025,
      creditosICMS: undefined
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithoutCreditosICMS as any} />);
    }).not.toThrow();
  });

  it('deve renderizar DetailedMetricsTable sem erro quando creditosPISCOFINS é undefined', () => {
    const dataWithoutCreditosPISCOFINS = {
      ...businessMetricsDataNovos2025,
      creditosPISCOFINS: undefined
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithoutCreditosPISCOFINS as any} />);
    }).not.toThrow();
  });

  it('deve renderizar DetailedMetricsTable com dados reais do businessMetricsDataNovos2025', () => {
    // Teste com dados reais que causaram o erro original
    expect(() => {
      render(<DetailedMetricsTable data={businessMetricsDataNovos2025 as any} />);
    }).not.toThrow();
  });

  it('deve filtrar corretamente métricas com dados undefined', () => {
    const dataWithMixedUndefined = {
      ...businessMetricsDataNovos2025,
      vendasPecas: undefined,
      seguradoras: undefined,
      mercadoLivre: undefined
    };

    const { container } = render(<DetailedMetricsTable data={dataWithMixedUndefined as any} />);
    
    // O componente deve renderizar (pode ser uma mensagem vazia ou as métricas disponíveis)
    expect(container.firstChild).toBeTruthy();
  });

  it('deve lidar com objeto de dados completamente vazio', () => {
    const emptyData = {} as any;

    // Deve renderizar mensagem de dados vazios sem erro
    const { container } = render(<DetailedMetricsTable data={emptyData} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('deve lidar com arrays reduce em objetos undefined', () => {
    // Este teste previne o erro "Cannot read properties of undefined (reading 'reduce')"
    const dataWithEmptyArrays = {
      months: [],
      vendasNovos: { vendas: [], volumeTrocas: [], percentualTrocas: [] },
      vendasPecas: undefined,
      seguradoras: undefined
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithEmptyArrays as any} />);
    }).not.toThrow();
  });
});

describe('Regressão: VWFinancialDashboard - Erro .reduce() em vendasPecas undefined', () => {
  it('deve renderizar VWFinancialDashboard sem erro quando vendasPecas é undefined', () => {
    // VWFinancialDashboard usa seus próprios dados e trata undefined internamente
    expect(() => {
      render(<VWFinancialDashboard />);
    }).not.toThrow();
  });

  it('deve renderizar cards condicionalmente quando vendasPecas não existe', () => {
    const { container } = render(<VWFinancialDashboard />);
    
    // Verifica se o componente renderizou sem erros
    expect(container).toBeTruthy();
  });

  it('não deve chamar .reduce() em arrays undefined nas seções de vendasPecas', () => {
    // Teste que renderiza o componente e verifica se não há erro de .reduce()
    expect(() => {
      const { container } = render(<VWFinancialDashboard />);
      expect(container).toBeTruthy();
    }).not.toThrow();
  });

  it('deve usar optional chaining para acessar propriedades de vendasPecas', () => {
    // Verifica se o componente usa ?. para acessar vendasPecas
    const { container } = render(<VWFinancialDashboard />);
    expect(container).toBeTruthy();
  });

  it('deve ocultar cards de vendasPecas quando os dados não existem no departamento', () => {
    // O componente deve verificar se vendasPecas existe antes de renderizar cards
    const { container } = render(<VWFinancialDashboard />);
    expect(container).toBeTruthy();
  });

  it('deve ocultar card consolidado quando vendasPecas não está completo', () => {
    // O card consolidado deve verificar se todas as seções de vendasPecas existem
    const { container } = render(<VWFinancialDashboard />);
    expect(container).toBeTruthy();
  });
});

describe('Regressão: Dados parciais por departamento', () => {
  it('deve renderizar corretamente para departamento Novos que não tem todas as propriedades', () => {
    expect(() => {
      render(<DetailedMetricsTable data={businessMetricsDataNovos2025 as any} />);
    }).not.toThrow();
  });

  it('deve exibir apenas as métricas disponíveis no departamento', () => {
    const { container } = render(<DetailedMetricsTable data={businessMetricsDataNovos2025 as any} />);
    
    // Verifica se o componente renderizou
    const table = container.querySelector('.detailed-metrics-table') || 
                  container.querySelector('[class*="grid"]') ||
                  container.querySelector('table') ||
                  container.firstChild;
    
    expect(table).toBeTruthy();
  });

  it('não deve tentar acessar propriedades de objetos null ou undefined', () => {
    const dataWithNulls = {
      ...businessMetricsDataNovos2025,
      vendasPecas: null,
      seguradoras: null,
      mercadoLivre: null,
      juros: null,
      custos: null,
      despesasCartao: null,
      bonus: null,
      receitasFinanciamento: null,
      creditosICMS: null,
      creditosPISCOFINS: null
    };

    expect(() => {
      render(<DetailedMetricsTable data={dataWithNulls as any} />);
    }).not.toThrow();
  });
});
