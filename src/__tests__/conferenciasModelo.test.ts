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

function variacoesAtipicas(
  cadastro: CadastroDemonstracoes,
  anterior: ContasBalancete,
  atual: ContasBalancete,
  config = CONFERENCIAS_CONFIG_PADRAO,
) {
  return construirConferencias({
    ano: 2026, mes: 4, atual, anterior, proximo: null, acumulado: [atual],
    mesesDoAno: [], mesesAnteriores: [1, 2, 3].map(mes => ({ ano: 2026, mes, contas: anterior })),
    cadastro, config,
  }).find(item => item.id === 'alertas')!.variacoesAtipicas!;
}

describe('conferenciasModelo', () => {
  it('zera a conciliação da DFC no item 11 nos 12 meses quando o item 6 confere, sem contar caixa duas vezes', () => {
    const cadastro = aplicarModeloDfcPadrao(cadastroVazio());
    const fluxos = [579874.62, -200.45, 0, 150.01, 8765.43, -45.67, 2500, 999.99, -10.01, 51247.34, 123.45, -987.65];
    for (const [indice, fluxo] of fluxos.entries()) {
      const atual = {
        '1.1.1.01': conta('1.1.1.01', 1000000, Math.max(fluxo, 0), Math.max(-fluxo, 0), 1000000 + fluxo),
        '3.1.01': conta('3.1.01', 0, Math.max(-fluxo, 0), Math.max(fluxo, 0), -fluxo),
        '2.3.1.01': conta('2.3.1.01', -1000000, 0, 0, -1000000),
      };
      const resultados = construirConferencias({
        ano: 2026, mes: indice + 1, atual, anterior: null, proximo: null, acumulado: [atual],
        mesesDoAno: [], mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
      });
      expect(resultados.find(item => item.id === 'caixa-dfc')!.estado).toBe('ok');
      expect(resultados.find(item => item.id === 'soma-linhas-grupos')!.grupos!.find(item => item.nome.startsWith('DFC')))
        .toMatchObject({ nome: 'DFC — seções − variação de caixa', esperado: fluxo, somaLinhas: fluxo, diferenca: 0 });
    }
  });

  it.each([false, true])('mantém a diferença real ou a indisponibilidade da DFC, sem forçar zero (seção ausente: %s)', ausente => {
    const padrao = aplicarModeloDfcPadrao(cadastroVazio());
    const cadastro = { ...padrao, linhas: ausente ? padrao.linhas.filter(linha =>
      linha.id !== 'dfc-financiamento' && linha.sublinhaDe !== 'dfc-financiamento') : padrao.linhas };
    const atual = {
      '1.1.1.01': conta('1.1.1.01', 1000, 100, 0, 1090),
      '3.1.01': conta('3.1.01', 0, 0, 100, -100),
    };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
      mesesDoAno: [], mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
    });
    expect(resultados.find(item => item.id === 'caixa-dfc')!.estado).toBe(ausente ? 'indisponivel' : 'erro');
    expect(resultados.find(item => item.id === 'soma-linhas-grupos')!.grupos!.find(item => item.nome.startsWith('DFC')))
      .toMatchObject({ esperado: 90, somaLinhas: ausente ? null : 100, diferenca: ausente ? null : 10 });
  });

  it('usa a seleção de caixa do item 6 e não mistura contas fora DFC nem o fechamento do balancete', () => {
    const cadastro = { ...aplicarModeloDfcPadrao(cadastroVazio()), dfcContasCaixaEquivalentes: ['1.1.1.01'] };
    const atual = {
      '1.1.1.01': conta('1.1.1.01', 1000, 100, 0, 1100),
      '1.1.1.02': conta('1.1.1.02', 300, 75, 0, 375),
      '3.1.01': conta('3.1.01', 0, 0, 100, -100),
      '1.8.99': conta('1.8.99', 0, 10, 0, 10),
    };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
      mesesDoAno: [], mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
    });
    expect(resultados.find(item => item.id === 'fechamento-balancete')!.estado).toBe('erro');
    expect(resultados.find(item => item.id === 'caixa-dfc')!.estado).toBe('ok');
    expect(resultados.find(item => item.id === 'soma-linhas-grupos')!.grupos!.find(item => item.nome.startsWith('DFC')))
      .toMatchObject({ esperado: 100, somaLinhas: 100, diferenca: 0 });
  });

  it.each([
    ['Pagamentos a fornecedores e floor plan', 'dfc', '4.1.1.01', 20000000, 22400000],
    ['Estoque', 'ativo', '1.1.2.01', 60000000, 63000000],
    ['Contas a receber', 'ativo', '1.1.3.01', 20000000, 22400000],
    ['Empréstimos e Financiamentos', 'passivo', '2.1.1.02', 20000000, 22400000],
    ['Adiantamentos com clientes', 'passivo', '2.1.1.03', 20000000, 22400000],
    ['Fornecedores', 'passivo', '2.1.1.01', 20000000, 22400000],
    ['Contas correntes', 'ativo', '1.1.4.01', 20000000, 22400000],
  ] as const)('não aplica a regra de R$ 2 milhões a %s', (nome, demonstracao, codigo, base, valorAtual) => {
    const cadastro: CadastroDemonstracoes = {
      ...cadastroVazio(),
      linhas: [{ id: 'detalhe', nome, demonstracao, tipo: 'contas', itens: [{ referencia: codigo, operacao: 1 }] }],
    };
    const periodo = (valor: number) => ({
      [codigo]: conta(codigo, 0, demonstracao === 'dfc' ? valor : 0, 0, demonstracao === 'passivo' ? -valor : valor),
    });
    const config = demonstracao === 'dfc' ? CONFERENCIAS_CONFIG_PADRAO : { ...CONFERENCIAS_CONFIG_PADRAO, linhasCapitalGiro: [] };
    expect(variacoesAtipicas(cadastro, periodo(base), periodo(valorAtual), config)).toEqual([]);
  });

  it.each([
    [8000000, 13000000, false],
    [12000000, 18000000, false],
    [10000000, 16000000, true],
    [0, 10000000, false],
    [1000000, -1000000, false],
    [1000000, -4100000, true],
  ] as const)('exige os limites monetário e percentual no capital de giro, de %s para %s', (base, valorAtual, alerta) => {
    const cadastro: CadastroDemonstracoes = {
      ...cadastroVazio(),
      linhas: [{ id: 'estoque', nome: 'Estoques', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.1.2.01', operacao: 1 }] }],
    };
    const periodo = (valor: number) => ({ '1.1.2.01': conta('1.1.2.01', 0, 0, 0, valor) });
    const variacoes = variacoesAtipicas(cadastro, periodo(base), periodo(valorAtual));
    expect(variacoes.map(item => item.linha)).toEqual(alerta ? ['Estoques'] : []);
    if (alerta) expect(Math.abs(variacoes[0].variacao)).toBeGreaterThan(5000000);
  });

  it.each(['2.1.1.02', '2.2.1.01'])('herda a categoria de empréstimos do grupo apenas para detalhes circulantes (%s)', codigo => {
    const cadastro: CadastroDemonstracoes = {
      ...cadastroVazio(),
      linhas: [
        { id: 'emprestimos', nome: 'Empréstimos e Financiamentos', demonstracao: 'passivo', tipo: 'total', itens: [{ referencia: 'banco', operacao: 1 }] },
        { id: 'banco', nome: 'Banco A', demonstracao: 'passivo', tipo: 'contas', sublinhaDe: 'emprestimos', itens: [{ referencia: codigo, operacao: 1 }] },
      ],
    };
    const periodo = (valor: number) => ({ [codigo]: conta(codigo, 0, 0, 0, -valor) });
    const variacoes = variacoesAtipicas(cadastro, periodo(20000000), periodo(22400000), { ...CONFERENCIAS_CONFIG_PADRAO, linhasCapitalGiro: [] });
    expect(variacoes.map(item => item.linha)).toEqual(codigo.startsWith('2.1') ? [] : ['Banco A']);
  });

  it('mantém os nomes adicionais cadastrados e a regra absoluta para outros detalhes', () => {
    const cadastro: CadastroDemonstracoes = {
      ...cadastroVazio(),
      linhas: [
        { id: 'especial', nome: 'Linha personalizada', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1.01', operacao: 1 }] },
        { id: 'outro', nome: 'Outra receita', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.2.01', operacao: 1 }] },
      ],
    };
    const periodo = (valor: number) => ({
      '3.1.01': conta('3.1.01', 0, 0, valor, 0),
      '3.2.01': conta('3.2.01', 0, 0, valor, 0),
    });
    const variacoes = variacoesAtipicas(cadastro, periodo(20000000), periodo(22400000), {
      ...CONFERENCIAS_CONFIG_PADRAO, linhasCapitalGiro: ['Linha personalizada'],
    });
    expect(variacoes).toMatchObject([{ linha: 'Outra receita', variacaoPercentual: 12, motivo: 'Variação superior ao limite absoluto.' }]);
  });

  it('analisa apenas os detalhes, sem totais do balanço, seções da DFC, Lucro Bruto ou Resultado do Período', () => {
    const cadastro: CadastroDemonstracoes = {
      ...cadastroVazio(),
      linhas: [
        { id: 'circulante', nome: 'Circulante', demonstracao: 'ativo', tipo: 'total', itens: [{ referencia: 'caixa', operacao: 1 }] },
        { id: 'caixa', nome: 'Caixa', demonstracao: 'ativo', tipo: 'contas', sublinhaDe: 'circulante', itens: [{ referencia: '1.1.1.01', operacao: 1 }] },
        { id: 'nao-circulante', nome: 'Não Circulante', demonstracao: 'ativo', tipo: 'total', itens: [{ referencia: 'maquinas', operacao: 1 }] },
        { id: 'maquinas', nome: 'Máquinas', demonstracao: 'ativo', tipo: 'contas', sublinhaDe: 'nao-circulante', itens: [{ referencia: '1.5.2.01', operacao: 1 }] },
        { id: 'lucro-bruto', nome: 'Lucro Bruto', demonstracao: 'dre', tipo: 'total', itens: [{ referencia: 'receita', operacao: 1 }] },
        { id: 'receita', nome: 'Receita', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1.01', operacao: 1 }] },
        { id: 'resultado', nome: 'Resultado do Período', demonstracao: 'passivo', tipo: 'contas', calculo: 'resultadoBalancete', itens: [] },
        ...(['operacional', 'investimento', 'financiamento'] as const).flatMap((secao, indice) => [
          { id: `dfc-${secao}`, nome: `Atividades de ${secao}`, demonstracao: 'dfc' as const, tipo: 'total' as const, itens: [{ referencia: `detalhe-${secao}`, operacao: 1 as const }] },
          { id: `detalhe-${secao}`, nome: `Detalhe ${secao}`, demonstracao: 'dfc' as const, tipo: 'contas' as const, sublinhaDe: `dfc-${secao}`, itens: [{ referencia: `5.${indice + 1}.01`, operacao: 1 as const }] },
        ]),
      ],
    };
    const periodo = (valor: number) => ({
      '1.1.1.01': conta('1.1.1.01', 0, 0, 0, valor),
      '1.5.2.01': conta('1.5.2.01', 0, 0, 0, valor),
      '3.1.01': conta('3.1.01', 0, 0, valor, -valor),
      ...Object.fromEntries([1, 2, 3].map(grupo => [`5.${grupo}.01`, conta(`5.${grupo}.01`, 0, valor, 0, valor)])),
    });
    const variacoes = variacoesAtipicas(cadastro, periodo(20000000), periodo(22400000));
    expect(variacoes.map(item => item.linha).sort()).toEqual([
      'Caixa', 'Detalhe financiamento', 'Detalhe investimento', 'Detalhe operacional', 'Máquinas', 'Receita',
    ]);
  });

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

  it.each([
    { mes: 9, valor: 3419.87 },
    { mes: 10, valor: 3419.87 },
    { mes: 9, valor: 0.01 },
  ])('identifica linhas e totais da DFC Indireta que não acumulam em $mes, inclusive diferenças de $valor reais', ({ mes, valor }) => {
    const mesesDoAno = Array.from({ length: 12 }, (_, indice) => {
      const saldo = indice < 8 ? 0 : -valor;
      return {
        ano: 2026, mes: indice + 1,
        contas: { '1.1.3.01.03.001': conta('1.1.3.01.03.001', saldo, 0, 0, saldo) },
      };
    });
    const resultados = construirConferencias({
      ano: 2026, mes, atual: mesesDoAno[mes - 1].contas, anterior: mesesDoAno[mes - 2].contas,
      proximo: null, acumulado: mesesDoAno.slice(0, mes).map(periodo => periodo.contas),
      mesesDoAno, mesesAnteriores: [], cadastro: aplicarModeloDfcPadrao(cadastroVazio()),
      config: CONFERENCIAS_CONFIG_PADRAO,
    });
    if (valor === 3419.87) {
      expect(resultados.find(item => item.id === 'direto-indireto')!.resumo.replace(/\u00a0/g, ' '))
        .toBe('Mês: R$ 0,00; acumulado: -R$ 3.419,87.');
    }
    const item8 = resultados.find(item => item.id === 'acumulado-mensal')!;
    expect(item8.estado).toBe('erro');
    expect(item8.divergenciasAcumulado).toEqual([
      'Clientes e créditos de vendas', 'Variações do capital de giro',
      'CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS', 'VARIAÇÃO DE CAIXA PELA DFC',
    ].map(linha => ({
      demonstracao: 'DFC Indireta', linha, valorAcumulado: valor, somaMeses: 0, diferenca: valor,
    })));
  });

  it('compara DRE, DFC Direta e DFC Indireta com os meses na seleção anual', () => {
    const base = aplicarModeloDfcPadrao(cadastroVazio());
    const cadastro: CadastroDemonstracoes = {
      ...base,
      linhas: [...base.linhas, {
        id: 'receita', nome: 'Receita', demonstracao: 'dre', tipo: 'contas',
        itens: [{ referencia: '3.1.01', operacao: 1 }],
      }],
    };
    const mensal = { '3.1.01': conta('3.1.01', 0, 0, 1, -1) };
    const anual = { '3.1.01': conta('3.1.01', 0, 0, 14, -14) };
    const resultados = construirConferencias({
      ano: 2026, mes: 0, atual: anual, anterior: null, proximo: null, acumulado: [anual],
      mesesDoAno: Array.from({ length: 12 }, (_, index) => ({ ano: 2026, mes: index + 1, contas: mensal })),
      mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
    });
    const item8 = resultados.find(item => item.id === 'acumulado-mensal')!;
    expect(item8.estado).toBe('erro');
    expect(item8.divergenciasAcumulado).toEqual(expect.arrayContaining([
      { demonstracao: 'DRE', linha: 'Receita', valorAcumulado: 14, somaMeses: 12, diferenca: 2 },
      { demonstracao: 'DFC Direta', linha: 'Recebimentos de clientes', valorAcumulado: 14, somaMeses: 12, diferenca: 2 },
      { demonstracao: 'DFC Indireta', linha: 'Resultado líquido do período (lucro + / prejuízo –)', valorAcumulado: 14, somaMeses: 12, diferenca: 2 },
    ]));
  });

  it('não usa o erro entre métodos do item 7 como substituto da comparação do item 8', () => {
    const atual = { '1.1.3.01.03.001': conta('1.1.3.01.03.001', 0, 0, 0, 3419.87) };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
      mesesDoAno: [{ ano: 2026, mes: 1, contas: atual }], mesesAnteriores: [],
      cadastro: aplicarModeloDfcPadrao(cadastroVazio()), config: CONFERENCIAS_CONFIG_PADRAO,
    });
    expect(resultados.find(item => item.id === 'direto-indireto')!.estado).toBe('erro');
    expect(resultados.find(item => item.id === 'acumulado-mensal')).toMatchObject({
      estado: 'ok', divergenciasAcumulado: [],
    });
  });

  it.each(['ausente', 'não listado'])('não considera OK o acumulado quando um mês está %s', condicao => {
    const atual = { '3.1.01': conta('3.1.01') };
    const resultados = construirConferencias({
      ano: 2026, mes: 2, atual, anterior: atual, proximo: null, acumulado: [atual, atual],
      mesesDoAno: [
        { ano: 2026, mes: 1, contas: atual },
        ...(condicao === 'ausente' ? [{ ano: 2026, mes: 2, contas: null }] : []),
      ],
      mesesAnteriores: [], cadastro: aplicarModeloDfcPadrao(cadastroVazio()), config: CONFERENCIAS_CONFIG_PADRAO,
    });
    expect(resultados.find(item => item.id === 'acumulado-mensal')).toMatchObject({
      estado: 'indisponivel', divergenciasAcumulado: [],
    });
  });

  it('não ignora valores calculados indisponíveis na verificação do acumulado', () => {
    const atual = { '3.1.01': conta('3.1.01') };
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: null, proximo: null, acumulado: [atual],
      mesesDoAno: [{ ano: 2026, mes: 1, contas: atual }], mesesAnteriores: [],
      cadastro: cadastroVazio(), config: CONFERENCIAS_CONFIG_PADRAO,
    });
    expect(resultados.find(item => item.id === 'acumulado-mensal')!.estado).toBe('indisponivel');
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

  it.each([1, -1])('aplica as naturezas das redutoras, exclui compensações e preserva alertas reais (fator %s)', fator => {
    const redutoras = [
      ['1.1.3.01.03.003', 'Débitos por devolução', -100],
      ['1.1.3.01.03.006', 'Créditos/depósitos a identificar', -100],
      ['1.1.5.01.01.009', 'Provisão despesa financeira', -100],
      ['1.1.4.02.01.003', 'Obrigações SCP – redutoras', -100],
      ['1.1.4.02.01.004', 'Obrigações SCP – redutoras', -100],
      ['1.5.1.01.50.999', 'Provisão ajuste a valor presente', -100],
      ['2.1.2.03.02.099', 'Encargos financeiros a incorrer', 100],
      ['2.2.1.15.20.099', 'Encargos financeiros a incorrer', 100],
      ['2.1.4.01.01.005', 'Devolução de compras Audi', 100],
      ['4.1.5.01.03.098', '(-) Tempo improdutivo', -100],
    ] as const;
    const atual: ContasBalancete = Object.fromEntries(redutoras.map(([codigo, desc, saldo]) =>
      [codigo, { ...conta(codigo, 0, 0, 0, saldo * fator), desc }]));
    const compensacoes = ['1.3.1.01.01.001', '1.9.1.01.01.001', '2.4.1.01.01.001', '2.9.1.01.01.001'];
    for (const codigo of compensacoes) {
      atual[codigo] = { ...conta(codigo, 0, 0, 0, codigo.startsWith('1') ? -100 : 100), desc: '(-) Compensação' };
    }
    atual['2.2.1.06.01.001'] = { ...conta('2.2.1.06.01.001', 0, 0, 0, 50), desc: 'Outras contingências' };
    atual['4.1.1.01.01.002'] = { ...conta('4.1.1.01.01.002', 0, 0, 0, -10), desc: 'CMV Audi' };
    const antes = structuredClone(atual);
    const resultados = construirConferencias({
      ano: 2026, mes: 1, atual, anterior: atual, proximo: null, acumulado: [atual],
      mesesDoAno: [], mesesAnteriores: [], cadastro: cadastroVazio(),
      config: {
        ...CONFERENCIAS_CONFIG_PADRAO,
        limiteSinalCentavos: 3000,
        naturezaExcecoes: [
          ...CONFERENCIAS_CONFIG_PADRAO.naturezaExcecoes,
          ...compensacoes.map(prefixo => ({ prefixo, natureza: 'devedora' as const })),
        ],
      },
    });
    const alertas = resultados.find(item => item.id === 'alertas')!;
    const sinais = alertas.contas!.filter(item => item.detalhe?.startsWith('Esperada'));
    expect(sinais.map(item => item.conta).sort()).toEqual([
      ...(fator === -1 ? redutoras.map(([codigo]) => codigo) : []),
      '2.2.1.06.01.001', '4.1.1.01.01.002',
    ].sort());
    expect(alertas.contas!.some(item => item.detalhe === 'Sugestão de conta redutora')).toBe(false);
    expect(alertas.contas!.some(item => compensacoes.includes(item.conta))).toBe(false);
    expect(sinais.find(item => item.conta === '2.2.1.06.01.001')!.destaque).toBe(true);
    expect(sinais.find(item => item.conta === '4.1.1.01.01.002')!.destaque).toBe(false);
    expect(atual).toEqual(antes);
  });

  it('concilia saldos contábeis com redutoras e preserva alertas de outras contas devedoras no passivo', () => {
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
    expect(sinais.map(item => item.conta)).toEqual(['2.1.4.01']);
    expect(sinais.map(item => item.destaque)).toEqual([false]);
    expect(sinais.map(item => item.saldoAtual)).toEqual([5]);
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
