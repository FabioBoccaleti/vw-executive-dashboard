import { describe, expect, it } from 'vitest';
import {
  cadastroVazio,
  aplicarModeloBalancoSorana,
  calcularLinhas,
  type ContasBalancete,
} from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import {
  compararSnapshotsBalancete,
  construirConferencias,
  type EntradaConferencias,
} from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/conferenciasModelo';
import { CONFERENCIAS_CONFIG_PADRAO } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/conferenciasStorage';

function conta(
  codigo: string,
  saldoAnt = 0,
  valDeb = 0,
  valCred = 0,
  saldoAtual = 0,
) {
  return {
    nivel: 'A',
    conta: codigo,
    desc: `Conta ${codigo}`,
    saldoAnt,
    valDeb,
    valCred,
    saldoAtual,
  };
}

describe('conferenciasModelo', () => {
  it('concilia saldos contábeis com redutoras e lista inversões pequenas, destacando somente as maiores', () => {
    const cadastro = aplicarModeloBalancoSorana({
      ...cadastroVazio(),
      linhas: [
        { id: 'receber', nome: 'Contas a receber', demonstracao: 'ativo', tipo: 'contas', contasPorPrefixo: true, saldoInvertido: true, itens: [{ referencia: '1.1.3', operacao: -1 }] },
        { id: 'amortizacao', nome: 'Amortização', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.5.7.02.001', operacao: -1 }] },
        { id: 'ativo-total', nome: 'Ativo', demonstracao: 'ativo', tipo: 'total', itens: [{ referencia: 'receber', operacao: -1 }, { referencia: 'amortizacao', operacao: -1 }] },
        { id: 'passivo', nome: 'Passivo Circulante', demonstracao: 'passivo', tipo: 'contas', contasPorPrefixo: true, itens: [{ referencia: '2.1', operacao: -1 }] },
      ],
    });
    const atual: ContasBalancete = {
      '1.1.3.01.03.001': conta('1.1.3.01.03.001', 120.5, 0, 0, 120.5),
      '1.1.3.01.03.003': conta('1.1.3.01.03.003', -30.25, 0, 0, -30.25),
      '1.1.3.01.03.006': conta('1.1.3.01.03.006', -10.75, 0, 0, -10.75),
      '1.5.7.02.001': { ...conta('1.5.7.02.001', -9.5, 0, 0, -9.5), desc: 'Amortização acumulada' },
      '2.1.1.01': conta('2.1.1.01', -90, 0, 0, -90),
      '2.1.2.01': { ...conta('2.1.2.01', 10, 0, 0, 10), desc: 'Encargos financeiros a incorrer' },
      '2.1.4.01': conta('2.1.4.01', 5, 0, 0, 5),
      '2.1.5.01': conta('2.1.5.01'),
      '2.3.1.01': conta('2.3.1.01', -20, 0, 0, -20),
      '2.3.3.02': conta('2.3.3.02', 25, 0, 0, 25),
    };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: atual, proximo: null, acumulado: [atual],
      mesesDoAno: [], mesesAnteriores: [], cadastro,
      config: { ...CONFERENCIAS_CONFIG_PADRAO, limiteSinalCentavos: 3000 },
    });
    expect(calcularLinhas(cadastro.linhas, 'ativo', [atual]).get('ativo-total')).toBe(70);
    const passivo = calcularLinhas(cadastro.linhas, 'passivo', [atual]);
    expect(passivo.get('passivo')).toBe(75);
    expect(passivo.get('passivo-pl')).toBe(-5);
    expect(resultados.find(item => item.id === 'fechamento-balanco')).toMatchObject({ estado: 'ok' });
    const grupos = resultados.find(item => item.id === 'soma-linhas-grupos')!.grupos!;
    expect(grupos.filter(grupo => /^(Ativo|Passivo|PL)/.test(grupo.nome)).every(grupo => grupo.diferenca === 0)).toBe(true);
    const sinais = resultados.find(item => item.id === 'alertas')!.contas!.filter(item => item.detalhe?.startsWith('Esperada'));
    expect(sinais.map(item => item.conta)).toEqual(['1.1.3.01.03.003', '1.1.3.01.03.006', '2.1.4.01']);
    expect(sinais.map(item => item.destaque)).toEqual([true, false, false]);
    expect(sinais.map(item => item.saldoAtual)).toEqual([-30.25, -10.75, 5]);
    expect(atual['1.1.3.01.03.003'].saldoAtual).toBe(-30.25);
    expect(atual['2.1.4.01'].saldoAtual).toBe(5);
  });

  it('compara saldos, débitos e créditos, ignorando diferenças de até R$ 1,00', () => {
    const anterior: ContasBalancete = {
      '1.1.1.01': conta('1.1.1.01', 10, 100, 25, 85),
      '1.1.1.02': conta('1.1.1.02', 20, 10, 0, 30),
    };
    const atual: ContasBalancete = {
      '1.1.1.01': conta('1.1.1.01', 10, 102, 25, 87),
      '1.1.1.02': conta('1.1.1.02', 20, 10, 0, 31),
    };

    const diferencas = compararSnapshotsBalancete(anterior, atual);

    expect(diferencas).toHaveLength(1);
    expect(diferencas[0]).toMatchObject({
      conta: '1.1.1.01',
      antes: { valDeb: 100, saldoAtual: 85 },
      depois: { valDeb: 102, saldoAtual: 87 },
    });
  });

  it('lista divergências de continuidade acima de R$ 1,00, inclusive no mês seguinte', () => {
    const anterior: ContasBalancete = {
      '8.1': conta('8.1', 0, 0, 0, 100),
      '8.2': conta('8.2', 0, 0, 0, 100),
    };
    const atual: ContasBalancete = {
      '8.1': conta('8.1', 101.01, 0, 0, 105),
      '8.2': conta('8.2', 100.99, 0, 0, 100.99),
    };
    const proximo: ContasBalancete = {
      '8.1': conta('8.1', 106.01, 0, 0, 110),
      '8.2': conta('8.2', 101.98, 0, 0, 102),
    };
    const entrada: EntradaConferencias = {
      ano: 2026,
      mes: 2,
      atual,
      anterior,
      proximo,
      acumulado: [anterior, atual],
      mesesDoAno: Array.from({ length: 12 }, (_, index) => ({
        ano: 2026,
        mes: index + 1,
        contas: index === 0 ? anterior : atual,
      })),
      mesesAnteriores: [
        { ano: 2025, mes: 11, contas: anterior },
        { ano: 2025, mes: 12, contas: anterior },
      ],
      cadastro: cadastroVazio(),
      config: CONFERENCIAS_CONFIG_PADRAO,
    };

    const resultado = construirConferencias(entrada).find(item => item.id === 'continuidade-saldos');

    expect(resultado?.estado).toBe('erro');
    expect(resultado?.contas?.map(item => item.conta)).toEqual(['8.1']);
    expect(resultado?.contasMesSeguinte?.map(item => item.conta)).toEqual(['8.1']);
  });

  it('avisa quando a linha de lucro líquido não está cadastrada na DRE', () => {
    const atual: ContasBalancete = { '3.1': conta('3.1', 0, 0, 0, 0) };
    const entrada: EntradaConferencias = {
      ano: 2026,
      mes: 1,
      atual,
      anterior: atual,
      proximo: null,
      acumulado: [atual],
      mesesDoAno: Array.from({ length: 12 }, (_, index) => ({ ano: 2026, mes: index + 1, contas: atual })),
      mesesAnteriores: [
        { ano: 2025, mes: 11, contas: atual },
        { ano: 2025, mes: 12, contas: atual },
      ],
      cadastro: cadastroVazio(),
      config: CONFERENCIAS_CONFIG_PADRAO,
    };

    const resultado = construirConferencias(entrada).find(item => item.id === 'resultado-dre');

    expect(resultado?.estado).toBe('atencao');
    expect(resultado?.resumo).toContain('Lucro Líquido do Exercício');
  });
});
