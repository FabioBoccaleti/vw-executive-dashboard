import { describe, it, expect } from 'vitest';
import type { RegraRemuneracaoSignDrive } from '@/components/CadastrosPage/cadastrosStorage';
import {
  selecionarFaixaPorQuantidade,
  percentualComissaoRegra,
  calcComissaoRegra,
  valorPremioRegra,
} from '@/components/VendasBonificacoesDashboard/signDriveRemuneracao';

function makeRegra(overrides: Partial<RegraRemuneracaoSignDrive> = {}): RegraRemuneracaoSignDrive {
  return {
    id: 'r1',
    nome: 'Comissão Vendedor',
    cargo: 'Vendedor',
    tiposVendaIds: [],
    comissaoAtiva: true,
    comissaoModo: 'faixas',
    comissaoPercentual: '',
    comissaoFaixas: [
      { id: 'f1', de: '1', ate: '5', valor: '8' },
      { id: 'f2', de: '6', ate: '', valor: '10' },
    ],
    comissaoBases: [],
    premioAtivo: false,
    premioModo: 'fixo',
    premioUnidade: 'percentual',
    premioValor: '',
    premioFaixas: [],
    ...overrides,
  };
}

describe('Sign&Drive — regra de remuneração por faixa (retroativa)', () => {
  it('seleciona a faixa pela quantidade total de vendas', () => {
    const regra = makeRegra();
    expect(selecionarFaixaPorQuantidade(regra.comissaoFaixas, 3)?.valor).toBe('8');
    expect(selecionarFaixaPorQuantidade(regra.comissaoFaixas, 5)?.valor).toBe('8');
    expect(selecionarFaixaPorQuantidade(regra.comissaoFaixas, 6)?.valor).toBe('10');
    expect(selecionarFaixaPorQuantidade(regra.comissaoFaixas, 50)?.valor).toBe('10');
  });

  it('aplica 8% quando há de 1 a 5 vendas', () => {
    const regra = makeRegra();
    expect(percentualComissaoRegra(regra, 3)).toBe(8);
    // 3 vendas, base total R$ 90.000 → 8% = 7.200
    expect(calcComissaoRegra(regra, 3, 90000)).toBeCloseTo(7200, 2);
  });

  it('ao atingir a 6ª venda, aplica 10% de forma retroativa sobre todas', () => {
    const regra = makeRegra();
    expect(percentualComissaoRegra(regra, 6)).toBe(10);
    // 6 vendas, base total R$ 600.000 → 10% sobre tudo = 60.000
    expect(calcComissaoRegra(regra, 6, 600000)).toBeCloseTo(60000, 2);
  });

  it('comissão fixa ignora a quantidade', () => {
    const regra = makeRegra({ comissaoModo: 'fixa', comissaoPercentual: '7,5', comissaoFaixas: [] });
    expect(percentualComissaoRegra(regra, 1)).toBe(7.5);
    expect(percentualComissaoRegra(regra, 100)).toBe(7.5);
    expect(calcComissaoRegra(regra, 100, 100000)).toBeCloseTo(7500, 2);
  });

  it('comissão inativa resulta em 0', () => {
    const regra = makeRegra({ comissaoAtiva: false });
    expect(percentualComissaoRegra(regra, 6)).toBe(0);
    expect(calcComissaoRegra(regra, 6, 600000)).toBe(0);
  });

  it('sem faixa correspondente resulta em 0', () => {
    const regra = makeRegra();
    expect(percentualComissaoRegra(regra, 0)).toBe(0);
  });

  it('prêmio percentual por faixa incide sobre a base', () => {
    const regra = makeRegra({
      premioAtivo: true,
      premioModo: 'faixas',
      premioUnidade: 'percentual',
      premioFaixas: [
        { id: 'p1', de: '1', ate: '5', valor: '1' },
        { id: 'p2', de: '6', ate: '', valor: '2' },
      ],
    });
    expect(valorPremioRegra(regra, 6, 600000)).toBeCloseTo(12000, 2);
  });

  it('prêmio em valor (R$) fixo independe da base', () => {
    const regra = makeRegra({
      premioAtivo: true,
      premioModo: 'fixo',
      premioUnidade: 'valor',
      premioValor: '500',
    });
    expect(valorPremioRegra(regra, 10, 999999)).toBe(500);
  });
});
