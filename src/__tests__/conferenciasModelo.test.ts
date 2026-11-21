import { describe, expect, it } from 'vitest';
import {
  cadastroVazio,
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
