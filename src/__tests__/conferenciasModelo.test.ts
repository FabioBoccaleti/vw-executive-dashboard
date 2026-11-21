import { describe, expect, it } from 'vitest';
import {
  cadastroVazio,
  aplicarModeloBalancoSorana,
  aplicarModeloDfcPadrao,
  calcularLinhas,
  type CadastroDemonstracoes,
  type ContasBalancete,
} from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import {
  compararSnapshotsBalancete,
  calcularDiferencaLinhasSnapshots,
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
  it('exige apenas analíticas com saldo ou débitos/créditos, respeitando escopo e prefixos de cada demonstração', () => {
    const cadastro: CadastroDemonstracoes = {
      ...cadastroVazio(),
      linhas: [
        { id: 'ativo', nome: 'Ativo', demonstracao: 'ativo', tipo: 'contas', contasPorPrefixo: true, itens: [{ referencia: '1.7', operacao: 1 }] },
        { id: 'dre', nome: 'DRE', demonstracao: 'dre', tipo: 'contas', contasPorPrefixo: true, itens: [{ referencia: '3.1', operacao: 1 }] },
      ],
    };
    const atual: ContasBalancete = {
      '1.7': { ...conta('1.7', 0, 10, 0, 10), nivel: 'S' },
      '1.7.01': conta('1.7.01', 0, 10, 0, 10),
      '1.8.01': conta('1.8.01', 5, 0, 0, 5),
      '1.8.02': conta('1.8.02', 0, 2, 2, 0),
      '1.8.03': conta('1.8.03'),
      '1.1.1.01': conta('1.1.1.01', 10, 0, 0, 10),
      '3.1.01': conta('3.1.01', 0, 0, 10, -10),
      '4.1.01': conta('4.1.01', 0, 10, 0, 10),
      ...Object.fromEntries(['1.3', '1.9', '2.4', '2.9'].map(prefixo =>
        [`${prefixo}.01`, conta(`${prefixo}.01`, 0, 50, 0, 50)])),
    };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
      mesesDoAno: [], mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
    });
    const classificacao = resultados.find(item => item.id === 'classificacao')!;
    const pendentes = classificacao.contas!;
    expect(pendentes.filter(item => item.detalhe?.startsWith('Ativo')).map(item => item.conta))
      .toEqual(['1.8.01', '1.8.02', '1.1.1.01']);
    expect(pendentes.filter(item => item.detalhe?.startsWith('DRE')).map(item => item.conta)).toEqual(['4.1.01']);
    expect(pendentes.filter(item => item.detalhe?.startsWith('Passivo'))).toEqual([]);
    expect(pendentes.some(item => ['1.7', '1.8.03'].includes(item.conta))).toBe(false);
    expect(pendentes.some(item => /^(1\.3|1\.9|2\.4|2\.9)(?:\.|$)/.test(item.conta))).toBe(false);
    expect(pendentes.filter(item => item.detalhe?.startsWith('DFC')).some(item => item.conta.startsWith('1.1.1.'))).toBe(false);
  });

  it.each([0, 5])('reutiliza prefixos e componentes indiretos, sem falsos sem linha com diferença de caixa %s', diferenca => {
    const cadastro = aplicarModeloDfcPadrao(cadastroVazio());
    const atual: ContasBalancete = {
      '1.1.1.01': conta('1.1.1.01', 100, 50, 0, 150 + diferenca),
      '1.1.2.06.01': conta('1.1.2.06.01', 20, 10, 0, 30),
      '3.1.01': conta('3.1.01', 0, 0, 100, -100),
      '4.1.1.01': conta('4.1.1.01', 0, 40, 0, 40),
      '2.3.1.01': conta('2.3.1.01', -120, 0, 0, -120),
    };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
      mesesDoAno: [], mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
    });
    expect(resultados.find(item => item.id === 'caixa-dfc')!.estado).toBe(diferenca === 0 ? 'ok' : 'erro');
    const classificacao = resultados.find(item => item.id === 'classificacao')!;
    expect(classificacao.contas!.filter(item => item.detalhe?.startsWith('DFC'))).toEqual([]);
    expect(classificacao.conciliacoesDfc).toEqual([
      { metodo: 'DFC Direta', diferenca: diferenca ? -diferenca : 0, efeitoSemLinha: 0, naoExplicado: diferenca ? -diferenca : 0 },
      { metodo: 'DFC Indireta', diferenca: diferenca ? -diferenca : 0, efeitoSemLinha: 0, naoExplicado: diferenca ? -diferenca : 0 },
    ]);
    if (diferenca) expect(classificacao.estado).toBe('erro');
  });

  it.each([['direta', 0], ['indireta', 0], ['direta', 10], ['indireta', 10]] as const)('concilia conta patrimonial sem classificação %s e informa resíduo de R$ %s', (metodo, residuo) => {
    const padrao = aplicarModeloDfcPadrao(cadastroVazio());
    const cadastro: CadastroDemonstracoes = {
      ...padrao,
      linhas: metodo === 'direta' ? padrao.linhas.map(linha => ({
        ...linha, itens: linha.itens.filter(item => !item.referencia.startsWith('1.1.2')),
      })) : padrao.linhas,
      dfcIndiretoRegras: metodo === 'indireta'
        ? padrao.dfcIndiretoRegras!.filter(regra => regra.referencia !== '1.1.2') : padrao.dfcIndiretoRegras,
    };
    const atual = {
      '1.1.1.01': conta('1.1.1.01', 100, 0, 25, 75 - residuo),
      '1.1.2.01': conta('1.1.2.01', 0, 25, 0, 25),
      '2.3.1.01': conta('2.3.1.01', -100, 0, 0, -100),
    };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
      mesesDoAno: [], mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
    });
    expect(resultados.find(item => item.id === 'caixa-dfc')!.estado).toBe('erro');
    const classificacao = resultados.find(item => item.id === 'classificacao')!;
    const contasDfc = classificacao.contas!.filter(item => item.detalhe?.startsWith('DFC'));
    expect(contasDfc).toHaveLength(metodo === 'direta' ? 2 : 1);
    expect(contasDfc.every(item => item.conta === '1.1.2.01' && item.efeitoDfc === 25 && item.movimento === -25)).toBe(true);
    expect(classificacao.conciliacoesDfc).toEqual([
      { metodo: 'DFC Direta', diferenca: (metodo === 'direta' ? 25 : 0) + residuo, efeitoSemLinha: metodo === 'direta' ? 25 : 0, naoExplicado: residuo },
      { metodo: 'DFC Indireta', diferenca: 25 + residuo, efeitoSemLinha: 25, naoExplicado: residuo },
    ]);
    if (residuo) expect(classificacao.estado).toBe('erro');
  });

  it.each([0, 0.99, 1])('esvazia a lista da DFC quando o efeito líquido não mapeado de R$ %s está dentro da tolerância do item 6', diferenca => {
    const padrao = aplicarModeloDfcPadrao(cadastroVazio());
    const cadastro = { ...padrao, linhas: padrao.linhas.map(linha => ({
      ...linha, itens: linha.itens.filter(item => item.referencia !== '3.1'),
    })) };
    const atual = {
      '1.1.1.01': conta('1.1.1.01', 100, 0, 0, 100),
      '3.1.01': conta('3.1.01', 0, 0, 10 + diferenca, -10 - diferenca),
      '3.1.02': conta('3.1.02', 0, 10, 0, 10),
    };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
      mesesDoAno: [], mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
    });
    expect(resultados.find(item => item.id === 'caixa-dfc')!.estado).toBe('ok');
    expect(resultados.find(item => item.id === 'classificacao')!.contas!.filter(item => item.detalhe?.startsWith('DFC'))).toEqual([]);
  });

  it.each([
    [5796, 'R$ 5.796,00'],
    [27097066.37, 'R$ 27.097.066,37'],
    [-3419.87, '-R$ 3.419,87'],
  ])('apresenta a diferença patrimonial de %s em reais, sem multiplicar por 100', (saldo, exibido) => {
    const cadastro = aplicarModeloBalancoSorana({
      ...cadastroVazio(),
      linhas: [
        { id: 'caixa', nome: 'Caixa', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.1.1.01', operacao: 1 }] },
        { id: 'passivo', nome: 'Passivo', demonstracao: 'passivo', tipo: 'contas', itens: [{ referencia: '2.1.1.01', operacao: 1 }] },
      ],
    });
    const atual = { '1.1.1.01': conta('1.1.1.01', 0, 0, 0, saldo) };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
      mesesDoAno: [], mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
    });
    const balanco = resultados.find(item => item.id === 'fechamento-balanco')!;
    expect(balanco.resumo.replace(/\u00a0/g, ' ')).toBe(`Diferença: ${exibido}.`);
    expect(balanco.estado).toBe('erro');
    expect(resultados.find(item => item.id === 'fechamento-balancete')!.resumo.replace(/\u00a0/g, ' '))
      .toContain(`soma dos saldos ${exibido}`);
    expect(atual['1.1.1.01'].saldoAtual).toBe(saldo);
  });

  it.each([[0.99, 'ok'], [1, 'ok'], [1.01, 'erro']] as const)(
    'compara a diferença de R$ %s com a tolerância de R$ 1,00 na mesma unidade',
    (diferenca, estado) => {
      const atual = { '1.1.1.01': conta('1.1.1.01', 0, diferenca, 0, 0) };
      const resultados = construirConferencias({
        ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
        mesesDoAno: [], mesesAnteriores: [], cadastro: cadastroVazio(), config: CONFERENCIAS_CONFIG_PADRAO,
      });
      expect(resultados.find(item => item.id === 'fechamento-balancete')!.estado).toBe(estado);
    },
  );

  it('converte médias, variações, movimentos agregados e alterações de versões para reais uma única vez', () => {
    const cadastro: CadastroDemonstracoes = {
      ...cadastroVazio(),
      linhas: [
        { id: 'caixa', nome: 'Caixa', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.1.1.01', operacao: 1 }] },
        { id: 'receita', nome: 'Receita', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1.01', operacao: 1 }] },
      ],
    };
    const periodo = (valor: number) => ({
      '1.1.1.01': conta('1.1.1.01', 0, 0, 0, valor),
      '3.1.01': conta('3.1.01', 0, 0, valor, 0),
    });
    const anterior = periodo(100.01);
    const atual = periodo(200.03);
    const resultados = construirConferencias({
      ano: 2026, mes: 3, atual, anterior, proximo: null, acumulado: [anterior, atual],
      mesesDoAno: [], mesesAnteriores: [{ ano: 2026, mes: 1, contas: anterior }, { ano: 2026, mes: 2, contas: periodo(100.02) }],
      cadastro, config: { ...CONFERENCIAS_CONFIG_PADRAO, limiteVariacaoCentavos: 10000 },
    });
    const variacoes = resultados.find(item => item.id === 'alertas')!.variacoesAtipicas!;
    expect(variacoes.find(item => item.demonstracao === 'Ativo')).toMatchObject({
      valorMes: 200.03, mediaAnterior: 100.02, variacao: 100.01,
    });
    const grupoDre = resultados.find(item => item.id === 'soma-linhas-grupos')!.grupos!.find(item => item.nome.startsWith('DRE'))!;
    expect(grupoDre).toMatchObject({
      esperado: 300.04, somaLinhas: 300.04, diferenca: 0,
      contas: [{ debitos: 0, creditos: 300.04, movimento: 300.04 }],
    });
    const alteracoes = calcularDiferencaLinhasSnapshots(cadastro, anterior, atual);
    expect(alteracoes).toEqual(expect.arrayContaining([
      { demonstracao: 'DRE', linha: 'Receita', antes: 100.01, depois: 200.03, diferenca: 100.02 },
      { demonstracao: 'Ativo', linha: 'Caixa', antes: 100.01, depois: 200.03, diferenca: 100.02 },
    ]));
    expect(alteracoes.every(item => item.diferenca === 100.02)).toBe(true);
  });

  it('mantém a diferença operacional negativa no mês e no acumulado em reais', () => {
    const cadastro: CadastroDemonstracoes = {
      ...cadastroVazio(),
      linhas: ['operacional', 'investimento', 'financiamento'].map((secao, indice) => ({
        id: `dfc-${secao}`, nome: secao, demonstracao: 'dfc', tipo: 'contas',
        itens: [{ referencia: `2.1.${indice + 7}`, operacao: 1 }],
      })),
    };
    const atual = {
      '3.1.01': conta('3.1.01', 0, 0, 3419.87, 0),
      '1.1.1.01': conta('1.1.1.01', 0, 123.45, 0, 123.45),
      '2.1.9': conta('2.1.9', 0, 0, 123.45, -123.45),
    };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
      mesesDoAno: [], mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
    });
    expect(resultados.find(item => item.id === 'direto-indireto')!.resumo.replace(/\u00a0/g, ' '))
      .toBe('Mês: -R$ 3.419,87; acumulado: -R$ 3.419,87.');
    expect(resultados.find(item => item.id === 'caixa-dfc')!.resumo.replace(/\u00a0/g, ' '))
      .toContain('DFC Direta − caixa: R$ 0,00');
  });

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
