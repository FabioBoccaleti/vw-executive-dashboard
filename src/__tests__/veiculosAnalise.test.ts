import { describe, expect, it } from 'vitest';
import { agruparModelosBase, buildAnaliseVeiculos } from '@/components/EstoqueUsadosVwDashboard/veiculosAnalise';
import type { VeiculoRow } from '@/components/EstoqueUsadosVwDashboard/veiculosStorage';

function veiculo(modelo: string, valor: number): VeiculoRow {
  return { modelo, valor, veiculo: modelo, chassi: modelo, marca: 'VW', nf: '', identificacao: '', entrada: null };
}

describe('agrupamento de novos por carro', () => {
  it('agrupa versões Audi preservando os identificadores alfanuméricos dos carros', () => {
    const analise = buildAnaliseVeiculos([
      veiculo('AUDI Q3 PERFORMANCE 2.0', 100),
      veiculo('NOVO Q3 SPORTBACK S LINE', 200),
      veiculo('AUDI A3 SEDAN PERFORMANCE', 300),
      veiculo('A3 SPORTBACK', 400),
      veiculo('AUDI RS Q8 PERFORMANCE', 500),
      veiculo('AUDI Q8 E-TRON', 600),
    ], '2026-11-30', 90);

    expect(agruparModelosBase(analise.itens).map(({ modelo, n, valor }) => ({ modelo, n, valor }))).toEqual([
      { modelo: 'A3', n: 2, valor: 700 },
      { modelo: 'Q3', n: 2, valor: 300 },
      { modelo: 'Q8', n: 1, valor: 600 },
      { modelo: 'RSQ8', n: 1, valor: 500 },
    ]);
  });

  it('soma versões do mesmo carro e preserva os itens originais sem incluir valores zerados', () => {
    const analise = buildAnaliseVeiculos([
      veiculo('NOVO T-CROSS SENSE 200 TSI', 100),
      veiculo('Volkswagen T Cross HIGHLINE', 200),
      veiculo('TCROSS COMFORTLINE', 300),
      veiculo('POLO TRACK', 400),
      veiculo('POLO HIGHLINE', 0),
    ], '2026-11-30', 90);
    const grupos = agruparModelosBase(analise.itens);

    expect(grupos.map(({ modelo, n, valor }) => ({ modelo, n, valor }))).toEqual([
      { modelo: 'T-CROSS', n: 3, valor: 600 },
      { modelo: 'POLO', n: 1, valor: 400 },
    ]);
    expect(grupos[0].itens.map(item => item.modelo)).toEqual([
      'NOVO T-CROSS SENSE 200 TSI', 'Volkswagen T Cross HIGHLINE', 'TCROSS COMFORTLINE',
    ]);
    expect(analise.modelos).toHaveLength(4);
  });

  it('distingue modelos elétricos e mantém descrições vazias visíveis', () => {
    const analise = buildAnaliseVeiculos([
      veiculo('VW ID.4 PRO PERF', 200),
      veiculo('ID4 PURE', 100),
      veiculo('NOVO ID. BUZZ PRO', 400),
      veiculo('', 50),
    ], '2026-11-30', 90);

    expect(agruparModelosBase(analise.itens).map(({ modelo, n, valor }) => ({ modelo, n, valor }))).toEqual([
      { modelo: 'ID.4', n: 2, valor: 300 },
      { modelo: 'ID.BUZZ', n: 1, valor: 400 },
      { modelo: 'Não informado', n: 1, valor: 50 },
    ]);
  });
});
