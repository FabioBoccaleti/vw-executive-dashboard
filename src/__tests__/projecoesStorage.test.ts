import { describe, expect, it } from 'vitest';

import {
  createEmptyBudgetVw,
  parseVal,
  recalculateBudgetVwRow,
} from '@/components/AnaliseProjecoesDashboard/projecoesStorage';

describe('projecoesStorage recalculation', () => {
  it('recalcula linhas derivadas do budget quando um valor base muda', () => {
    const row = createEmptyBudgetVw(2026, 6);

    row.usados.receitaOperacionalLiquida = '9336723';
    row.usados.custoOperacionalReceita = '-18823602.563';
    row.usados.outrasReceitasOperacionais = '93712';
    row.usados.outrasDespesasOperacionais = '-515752';
    row.usados.despPessoal = '-117992';
    row.usados.despServTerceiros = '-71208';
    row.usados.despOcupacao = '-7957';
    row.usados.despFuncionamento = '-81787';
    row.usados.despVendas = '-47392';
    row.usados.amortizacoesDepreciacoes = '-12000';
    row.usados.outrasReceitasFinanceiras = '8000';
    row.usados.despFinanceirasNaoOperacional = '-5000';
    row.usados.despesasNaoOperacionais = '-3000';
    row.usados.outrasRendasNaoOperacionais = '2000';
    row.usados.provisoesIrpjCs = '-10000';
    row.usados.participacoes = '-4000';

    const usados = recalculateBudgetVwRow(row).usados;

    expect(parseVal(usados.lucroPrejOperacionalBruto)).toBeCloseTo(-9486879.563);
    expect(parseVal(usados.margemContribuicao)).toBeCloseTo(-9908919.563);
    expect(parseVal(usados.lucroPrejOperacionalLiquido)).toBeCloseTo(-10235255.563);
    expect(parseVal(usados.lucroPrejAntesImpostos)).toBeCloseTo(-10245255.563);
    expect(parseVal(usados.lucroLiquidoExercicio)).toBeCloseTo(-10259255.563);
  });
});