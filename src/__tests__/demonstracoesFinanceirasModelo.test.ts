import { describe, expect, it } from 'vitest';
import { extractAccounts } from '@/components/FluxoCaixaDashboard/balanceteParser';
import { aplicarModeloBalancoSorana, aplicarModeloDfcPadrao, calcularDfcIndireto, calcularLinhas, calcularSaldosCaixaEquivalentes, cadastroVazio, identificarContasDfcNaoMapeadas, identificarContasDfcPendentes, identificarContasIncompletas, identificarContasNaoClassificadas, listarContasDaLinha, listarContasDfcDaLinha, validarContasCompletas, validarLinhas, type LinhaDemonstracao } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import { deveExibirLinhaDfc } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/dfcTabela';

const grupo = (id: string, conta: string, operacao: 1 | -1 = 1): LinhaDemonstracao => ({
  id, nome: id, demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: conta, operacao }],
});
const total = (id: string, referencias: string[]): LinhaDemonstracao => ({
  id, nome: id, demonstracao: 'dre', tipo: 'total', itens: referencias.map(referencia => ({ referencia, operacao: 1 })),
});
const janeiro = extractAccounts('R;3.1;Receita;0,00;0,00;1.000,00;10.000,00\nD;3.2;Custo;0,00;200,00;0,00;2.000,00', { strict: true });
const fevereiro = extractAccounts('R;3.1;Receita;0,00;100,00;0,00;9.900,00\nD;3.2;Custo;0,00;50,00;0,00;2.050,00', { strict: true });

describe('Demonstrações financeiras — cálculo e integridade', () => {
  it.each([
    { valores: [0, 0, 0], exibir: false },
    { valores: [0, -0.01, 0], exibir: true },
    { valores: [0, 0, 100], exibir: true },
    { valores: [0, null, 0], exibir: true },
    { valores: [0, undefined, 0], exibir: true },
  ])('filtra a DFC apenas quando todos os valores exibidos e acumulados são zero: $valores', ({ valores, exibir }) => {
    expect(deveExibirLinhaDfc(valores)).toBe(exibir);
  });

  it('lista contas de resultado com movimento que não estão em grupos da DRE, por coluna', () => {
    const balancete = (texto: string) => extractAccounts(texto, { strict: true });
    const mes1 = balancete([
      'S;5;Despesas;0;0;0;0', 'A;5.1;Pessoal;0,00;300,00;0,00;300,00', 'A;5.2;Aluguel;0,00;100,00;100,00;0,00',
      'A;3.1;Receita;0,00;0,00;1.000,00;1.000,00', 'A;1.1;Caixa;0,00;500,00;0,00;500,00', 'A;6.1;IR;0,00;0,00;0,00;0,00',
    ].join('\n'));
    const mes2 = balancete('A;6.1;IR;0,00;40,00;0,00;40,00\nA;3.1;Receita;0,00;0,00;10,00;10,00');
    const resultado = identificarContasNaoClassificadas([grupo('Receita', '3.1'), { ...grupo('Ativo', '5.1'), demonstracao: 'ativo' }], [[mes1], [mes1, mes2], [null]]);
    expect(resultado).toEqual([
      { conta: '5.1', desc: 'Pessoal', valores: [-300, -300, null] },
      { conta: '6.1', desc: 'IR', valores: [0, -40, null] },
    ]);
  });
  it('calcula DRE pelo movimento com sinais automáticos, inclusive estornos, totalizações e subtotais', () => {
    const linhas = [grupo('Receita', '3.1'), grupo('Custo', '3.2', -1), total('Resultado', ['Receita', 'Custo']), total('Resultado final', ['Resultado'])];
    expect([...calcularLinhas(linhas, 'dre', [janeiro]).values()]).toEqual([1000, -200, 800, 800]);
    expect([...calcularLinhas(linhas, 'dre', [janeiro, fevereiro]).values()]).toEqual([900, -250, 650, 650]);
    expect(calcularLinhas(linhas, 'dre', [fevereiro]).get('Receita')).toBe(-100);
  });

  it('valida e calcula sublinhas da DRE sem permitir referências externas ou contas duplicadas', () => {
    const primeira = { ...grupo('Primeira', '3.1'), sublinhaDe: 'Grupo' };
    const segunda = { ...grupo('Segunda', '3.2'), sublinhaDe: 'Grupo' };
    const principal = total('Grupo', ['Primeira', 'Segunda']);
    const resultado = total('Resultado', ['Grupo']);
    const linhas = [principal, primeira, segunda, resultado];
    expect(validarLinhas(linhas)).toBeNull();
    expect(calcularLinhas(linhas, 'dre', [janeiro]).get('Resultado')).toBe(800);
    expect(validarLinhas([...linhas, total('Inválido', ['Primeira'])])).toMatch(/mesma demonstração/);
    expect(validarLinhas([principal, primeira, { ...segunda, itens: primeira.itens }])).toMatch(/sobrepõe/);
    expect(validarLinhas([total('Grupo', ['Primeira']), primeira, segunda])).toMatch(/soma da sua linha principal/);
  });

  it.each(['ativo', 'passivo'] as const)('valida sublinhas de %s e soma seus valores com os sinais das contas', demonstracao => {
    const primeira = { ...grupo('Primeira', '1.1', -1), demonstracao, sublinhaDe: 'Grupo' };
    const segunda = { ...grupo('Segunda', '1.2'), demonstracao, sublinhaDe: 'Grupo' };
    const principal = { ...total('Grupo', ['Primeira', 'Segunda']), demonstracao };
    const contas = extractAccounts('A;1.1;Conta;0;0;0;100\nA;1.2;Conta;0;0;0;-20', { strict: true });
    expect(validarLinhas([principal, primeira, segunda])).toBeNull();
    expect(calcularLinhas([principal, primeira, segunda], demonstracao, [contas]).get('Grupo')).toBe(demonstracao === 'ativo' ? 80 : -80);
    expect(validarLinhas([principal, primeira, { ...segunda, demonstracao: 'dre' }])).toMatch(/linha principal/);
  });

  it('usa saldos pontuais no patrimônio em vez de movimentos ou soma de meses', () => {
    const linha = { ...grupo('Caixa', '1.1'), demonstracao: 'ativo' as const };
    const atual = extractAccounts('A;1.1;Caixa;150,00;20,00;10,00;160,00', { strict: true });
    const anterior = extractAccounts('A;1.1;Caixa;90,00;80,00;20,00;150,00', { strict: true });
    expect(calcularLinhas([linha], 'ativo', [atual]).get('Caixa')).toBe(160);
    expect(calcularLinhas([linha], 'ativo', [anterior]).get('Caixa')).toBe(150);
  });

  it('preserva os sinais importados das redutoras e separa o PL com prefixos e resultado do balancete', () => {
    const linhas: LinhaDemonstracao[] = [
      { ...grupo('Depreciação acumulada', '1.5.5.02.01.001'), demonstracao: 'ativo' },
      { ...grupo('Amortização acumulada', '1.5.5.02.02.001'), demonstracao: 'ativo' },
      { ...grupo('Amortização acumulada intangível', '1.5.7.02.001'), demonstracao: 'ativo' },
      {
        id: 'passivo-nao-circulante', nome: 'Passivo Não Circulante', demonstracao: 'passivo', tipo: 'contas',
        itens: ['2.2.1', '2.3.1.01.01.001', '2.3.2.01.01.001'].map(referencia => ({ referencia, operacao: 1 })),
      },
    ];
    const cadastro = aplicarModeloBalancoSorana({ ...cadastroVazio(), linhas });
    const contas = extractAccounts([
      'A;1.5.5.02.01.001;Depreciação acumulada;0;0;0;-20',
      'A;1.5.5.02.02.001;Amortização acumulada;0;0;0;-5',
      'A;1.5.7.02.001;Amortização acumulada intangível;0;0;0;-6',
      'P;2.2.1;Passivo;0;0;0;-30',
      'P;2.3.1;Capital social totalizador;0;0;0;-100',
      'P;2.3.1.01.01.001;Capital social;0;0;0;-100',
      'P;2.3.2.01.01.001;Reserva de capital;0;0;0;-20',
      'P;2.3.2.02.01.001;Reserva de lucros 1;0;0;0;-30',
      'P;2.3.2.03.01.001;Reserva de lucros 2;0;0;0;-10',
      'P;2.3.3.01.01.001;Lucros acumulados;0;0;0;-50',
      'P;2.3.3.02.01.001;Prejuízos acumulados;0;0;0;10',
      'R;3.1.1;Receita;0;0;150;-150',
      'D;4.1.1;Custo;0;40;0;40',
      'D;5.1.1;Despesa;0;10;0;10',
      'D;6.1.1;Imposto;0;5;0;5',
    ].join('\n'), { strict: true });

    expect(validarLinhas(cadastro.linhas)).toBeNull();
    expect(cadastro.linhas.find(linha => linha.id === 'passivo-nao-circulante')?.itens.map(item => item.referencia)).toEqual(['2.2.1']);
    expect(cadastro.linhas.find(linha => linha.nome === 'Depreciação acumulada')?.itens[0].operacao).toBe(1);
    expect(cadastro.linhas.find(linha => linha.nome === 'Amortização acumulada')?.itens[0].operacao).toBe(1);
    const ativo = calcularLinhas(cadastro.linhas, 'ativo', [contas]);
    expect(ativo.get('Depreciação acumulada')).toBe(-20);
    expect(ativo.get('Amortização acumulada')).toBe(-5);
    expect(ativo.get('Amortização acumulada intangível')).toBe(-6);

    const passivo = calcularLinhas(cadastro.linhas, 'passivo', [contas]);
    expect(passivo.get('passivo-pl-capital')).toBe(100);
    expect(passivo.get('passivo-pl-reservas-capital')).toBe(20);
    expect(passivo.get('passivo-pl-reservas-lucros')).toBe(40);
    expect(passivo.get('passivo-pl-lucros-acumulados')).toBe(40);
    expect(passivo.get('passivo-resultado-periodo')).toBe(95);
    expect(passivo.get('passivo-pl')).toBe(295);
    expect(listarContasDaLinha(cadastro.linhas.find(linha => linha.id === 'passivo-pl-capital')!, [contas]).map(({ conta }) => conta.conta))
      .toEqual(['2.3.1.01.01.001']);
    expect(aplicarModeloBalancoSorana(cadastro)).toBe(cadastro);
  });

  it('soma prefixos com sinal em cadastro já migrado, ignorando inversões legadas sem refazer o PL', () => {
    const legado = {
      ...cadastroVazio(), modeloBalancoSoranaAplicado: true,
      linhas: [
        { ...grupo('Amortizações', '1.5.7.02', -1), demonstracao: 'ativo' as const, contasPorPrefixo: true, saldoInvertido: true },
        { ...grupo('Conta semelhante', '1.5.7.020.001'), demonstracao: 'ativo' as const },
        { ...grupo('Depreciação personalizada', '1.5.5.02.01.001'), demonstracao: 'ativo' as const },
        { ...grupo('Linha da DFC', '1.5.7.02.001'), demonstracao: 'dfc' as const },
      ],
    };
    const corrigido = aplicarModeloBalancoSorana(legado);
    const contas = extractAccounts([
      'S;1.5.7.02;Amortização total;0;0;0;-30',
      'A;1.5.7.02.001;Amortização 1;0;0;0;-20',
      'A;1.5.7.02.002;Amortização 2;0;0;0;10',
      'A;1.5.7.020.001;Conta semelhante;0;0;0;40',
      'A;1.5.5.02.01.001;Depreciação personalizada;0;0;0;5',
    ].join('\n'), { strict: true });
    expect(corrigido.linhas).toHaveLength(legado.linhas.length);
    expect(corrigido.linhas[0].itens[0].operacao).toBe(-1);
    expect(legado.linhas[0].itens[0].operacao).toBe(-1);
    expect(corrigido.linhas.slice(1)).toEqual(legado.linhas.slice(1));
    const valores = calcularLinhas(corrigido.linhas, 'ativo', [contas]);
    expect(valores.get('Amortizações')).toBe(-10);
    expect(valores.get('Conta semelhante')).toBe(40);
    expect(valores.get('Depreciação personalizada')).toBe(5);
    expect(aplicarModeloBalancoSorana(corrigido)).toBe(corrigido);
  });

  it('calcula DFC Direto mensal e acumulado pelo movimento Crédito − Débito', () => {
    const sublinhas: LinhaDemonstracao[] = [
      ...[
        ['Receita', '3.1', 1],
        ['Custo', '4.1', 1],
        ['Caixa', '1.1', 1],
        ['Fornecedores', '2.1', 1],
      ].map(([id, referencia, operacao]) => ({
        ...grupo(String(id), String(referencia), Number(operacao) as 1 | -1),
        demonstracao: 'dfc' as const,
        sublinhaDe: 'Fluxo',
      })),
    ];
    const linhas: LinhaDemonstracao[] = [
      { ...total('Fluxo', sublinhas.map(linha => linha.id)), demonstracao: 'dfc' },
      ...sublinhas,
    ];
    const jan = extractAccounts([
      'A;3.1;Receita;0;0;1000;-1000',
      'A;4.1;Custo;0;300;0;300',
      'A;1.1;Caixa;100;50;0;150',
      'P;2.1;Fornecedores;10;0;30;40',
    ].join('\n'), { strict: true });
    const fev = extractAccounts([
      'A;3.1;Receita;-1000;0;500;-1500',
      'A;4.1;Custo;300;100;0;400',
      'A;1.1;Caixa;150;25;0;175',
      'P;2.1;Fornecedores;40;0;10;50',
    ].join('\n'), { strict: true });

    expect(validarLinhas(linhas)).toBeNull();
    expect([...calcularLinhas(linhas, 'dfc', [fev]).values()]).toEqual([385, 500, -100, -25, 10]);
    expect([...calcularLinhas(linhas, 'dfc', [jan, fev]).values()]).toEqual([1065, 1500, -400, -75, 40]);
  });

  it('semeia o modelo DFC uma vez, preservando uma configuração salva mesmo quando removida', () => {
    const inicial = aplicarModeloDfcPadrao(cadastroVazio());
    const linhasDfc = inicial.linhas.filter(linha => linha.demonstracao === 'dfc');
    expect(linhasDfc).toHaveLength(25);
    expect(linhasDfc.filter(linha => linha.tipo === 'contas' && !linha.foraDfc)).toHaveLength(18);
    expect(linhasDfc.filter(linha => linha.tipo === 'contas').reduce((total, linha) => total + linha.itens.length, 0)).toBe(189);
    expect(validarLinhas(inicial.linhas)).toBeNull();
    expect(inicial.dfcContasCaixaEquivalentes).toEqual(['1.1.1']);
    expect(linhasDfc.filter(linha => linha.dfcSubtotalNome).map(linha => linha.dfcSubtotalNome)).toEqual([
      'CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS',
      'CAIXA LÍQUIDO DAS ATIVIDADES DE INVESTIMENTO',
      'CAIXA LÍQUIDO DAS ATIVIDADES DE FINANCIAMENTO',
    ]);
    expect(inicial.dfcIndiretoRegras).toContainEqual({ referencia: '1.1.2', linha: 'V03' });
    expect(inicial.dfcIndiretoRegras).toContainEqual({ referencia: '5.5.2.07.20', linha: 'AJ01' });

    const personalizada = {
      ...inicial,
      linhas: inicial.linhas.map(linha => linha.id === 'dfc-op01' ? { ...linha, nome: 'Receita ajustada pelo usuário' } : linha),
      dfcContasCaixaEquivalentes: ['1.1.1.01.01.001'],
    };
    expect(aplicarModeloDfcPadrao(personalizada)).toBe(personalizada);

    const cadastroLegado = { ...inicial };
    delete cadastroLegado.dfcContasCaixaEquivalentes;
    expect(aplicarModeloDfcPadrao({ ...cadastroLegado, dfcModeloInicializado: true }).dfcContasCaixaEquivalentes).toEqual(['1.1.1']);

    const linhasLegadas = inicial.linhas.map(linha => {
      const copia = { ...linha };
      delete copia.dfcSubtotalNome;
      return copia.id === 'dfc-operacional' ? { ...copia, nome: 'Operações ajustadas' } : copia;
    });
    const migradaComSubtotais = aplicarModeloDfcPadrao({ ...inicial, linhas: linhasLegadas });
    expect(migradaComSubtotais.linhas.find(linha => linha.id === 'dfc-operacional')).toMatchObject({
      nome: 'Operações ajustadas',
      dfcSubtotalNome: 'CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS',
    });

    const removida = { ...inicial, linhas: inicial.linhas.filter(linha => linha.demonstracao !== 'dfc') };
    expect(aplicarModeloDfcPadrao(removida).linhas.some(linha => linha.demonstracao === 'dfc')).toBe(false);
    const removidaLegada = { ...removida };
    delete removidaLegada.dfcContasCaixaEquivalentes;
    const migrada = aplicarModeloDfcPadrao(removidaLegada);
    expect(migrada.linhas.some(linha => linha.demonstracao === 'dfc')).toBe(false);
    expect(migrada.dfcContasCaixaEquivalentes).toEqual(['1.1.1']);
  });

  it('classifica pelo prefixo mais longo, mantém contas fora dos totais e lista contas não mapeadas', () => {
    const principal: LinhaDemonstracao = { ...total('Atividades Operacionais', ['Linha ampla', 'Linha específica']), demonstracao: 'dfc' };
    const ampla: LinhaDemonstracao = {
      ...grupo('Linha ampla', '1.1'), demonstracao: 'dfc', sublinhaDe: principal.id,
    };
    const especifica: LinhaDemonstracao = {
      ...grupo('Linha específica', '1.1.1'), demonstracao: 'dfc', sublinhaDe: principal.id,
    };
    const fora: LinhaDemonstracao = {
      ...total('Contas fora da DFC', ['Caixa']), demonstracao: 'dfc', foraDfc: true,
    };
    const caixa: LinhaDemonstracao = {
      ...grupo('Caixa', '2.3'), demonstracao: 'dfc', sublinhaDe: fora.id, foraDfc: true,
    };
    const linhas = [principal, ampla, especifica, fora, caixa];
    const contas = extractAccounts([
      'A;1.1.1.01.01.001;Caixa;0;20;10;0',
      'A;1.1.2.01.01.001;Cliente;0;20;70;0',
      'A;2.3.1.01;PL;0;25;0;0',
      'A;9.9.1;Sem prefixo;0;5;0;0',
    ].join('\n'), { strict: true });

    expect(validarLinhas(linhas)).toBeNull();
    expect([...calcularLinhas(linhas, 'dfc', [contas]).values()]).toEqual([40, 50, -10, -25, -25]);
    expect(listarContasDfcDaLinha(linhas, 'Linha específica', [contas]).map(item => item.referencia)).toEqual(['1.1.1.01.01.001']);
    expect(identificarContasDfcNaoMapeadas(linhas, [[contas]])).toEqual([
      { conta: '9.9.1', desc: 'Sem prefixo', valores: [-5] },
    ]);
  });

  it('concilia o saldo inicial e final usando somente contas cobertas pelos prefixos selecionados', () => {
    const prefixosPadrao = aplicarModeloDfcPadrao(cadastroVazio()).dfcContasCaixaEquivalentes ?? [];
    const janeiro = extractAccounts([
      'A;1.1.1.01.01.001;Banco A;100;0;0;150',
      'A;1.1.1.02.01.001;Banco B;200;0;0;200',
      'A;1.1.2.01;Estoque;900;0;0;900',
    ].join('\n'), { strict: true });
    const fevereiro = extractAccounts([
      'A;1.1.1.01.01.001;Banco A;150;0;0;200',
      'A;1.1.1.02.01.001;Banco B;200;0;0;250',
      'A;1.1.2.01;Estoque;900;0;0;900',
    ].join('\n'), { strict: true });

    expect(calcularSaldosCaixaEquivalentes(prefixosPadrao, [fevereiro])).toEqual({
      saldoInicial: 350, saldoFinal: 450, variacaoReal: 100,
    });
    expect(calcularSaldosCaixaEquivalentes(prefixosPadrao, [janeiro, fevereiro])).toEqual({
      saldoInicial: 300, saldoFinal: 450, variacaoReal: 150,
    });

    const prefixosPersonalizados = ['1.1.1.01.01.001'];
    expect(calcularSaldosCaixaEquivalentes(prefixosPersonalizados, [janeiro, fevereiro])).toEqual({
      saldoInicial: 100, saldoFinal: 200, variacaoReal: 100,
    });
    expect(calcularSaldosCaixaEquivalentes(prefixosPersonalizados, [janeiro, null])).toEqual({
      saldoInicial: null, saldoFinal: null, variacaoReal: null,
    });
  });

  it('calcula a DFC indireta com ajustes, variações de saldo e linhas de investimento/financiamento do método direto', () => {
    const linhas: LinhaDemonstracao[] = [
      { id: 'dfc-operacional', nome: 'Operacional', demonstracao: 'dfc', tipo: 'total', itens: [{ referencia: 'dfc-op01', operacao: 1 }] },
      { id: 'dfc-op01', nome: 'Operacional', demonstracao: 'dfc', tipo: 'contas', sublinhaDe: 'dfc-operacional', itens: [
        { referencia: '3.1', operacao: 1 }, { referencia: '4.1', operacao: 1 }, { referencia: '2.1.1.01.01', operacao: 1 },
      ] },
      { id: 'dfc-investimento', nome: 'Investimento', demonstracao: 'dfc', tipo: 'total', itens: [{ referencia: 'dfc-inv01', operacao: 1 }] },
      { id: 'dfc-inv01', nome: 'Imobilizado', demonstracao: 'dfc', tipo: 'contas', sublinhaDe: 'dfc-investimento', itens: [
        { referencia: '3.6.1.01', operacao: 1 }, { referencia: '5.1.3.04', operacao: 1 },
      ] },
      { id: 'dfc-financiamento', nome: 'Financiamento', demonstracao: 'dfc', tipo: 'total', itens: [{ referencia: 'dfc-fin01', operacao: 1 }] },
      { id: 'dfc-fin01', nome: 'Juros', demonstracao: 'dfc', tipo: 'contas', sublinhaDe: 'dfc-financiamento', itens: [
        { referencia: '5.5.7.01.01.001', operacao: 1 },
      ] },
    ];
    const contas = extractAccounts([
      'A;3.1;Receita;0;0;100;0',
      'A;4.1;Custo;0;40;0;0',
      'P;2.1.1.01.01;Fornecedores;-10;0;10;-20',
      'A;3.6.1.01;Ganho na venda;0;0;30;0',
      'A;5.1.3.04;Depreciação;0;5;0;0',
      'A;5.5.7.01.01.001;Juros;0;20;0;0',
    ].join('\n'), { strict: true });

    expect(validarLinhas(linhas)).toBeNull();
    const resultado = calcularDfcIndireto(linhas, aplicarModeloDfcPadrao(cadastroVazio()).dfcIndiretoRegras ?? [], [contas]);
    expect(resultado.valores.get('RES')).toBe(65);
    expect(resultado.valores.get('AJ01')).toBe(5);
    expect(resultado.valores.get('AJ02')).toBe(-30);
    expect(resultado.valores.get('AJ04')).toBe(20);
    expect(resultado.valores.get('V08')).toBe(10);
    expect(resultado.valores.get('dfc-operacional')).toBe(70);
    expect(resultado.valores.get('dfc-investimento')).toBe(25);
    expect(resultado.valores.get('dfc-financiamento')).toBe(-20);
    expect(resultado.valores.get('dfc-total')).toBe(75);
    expect(resultado.valores.get('diferenca-operacional')).toBe(0);
    expect(resultado.valores.get('diferenca-total')).toBe(0);
    expect(resultado.contasOperacionaisSemLinha).toBe(0);
  });

  it('identifica contas com movimento pendentes e sugere mapeamentos somente com contas próximas consistentes', () => {
    const linhas: LinhaDemonstracao[] = [
      { id: 'dfc-operacional', nome: 'Operacional', demonstracao: 'dfc', tipo: 'total', itens: [{ referencia: 'dfc-op01', operacao: 1 }] },
      { id: 'dfc-op01', nome: 'Ativos operacionais', demonstracao: 'dfc', tipo: 'contas', sublinhaDe: 'dfc-operacional', itens: [
        { referencia: '1.1.2.01', operacao: 1 }, { referencia: '1.1.2.02', operacao: 1 },
      ] },
    ];
    const contas = extractAccounts([
      'A;1.1.2.01;Clientes diversos A;0;0;0;0',
      'A;1.1.2.02;Clientes diversos B;0;0;0;0',
      'A;1.1.2.03;Clientes diversos C;0;20;0;20',
      'A;1.1.2.04;Clientes diversos D;0;0;0;0',
    ].join('\n'), { strict: true });
    const regras = [
      { referencia: '1.1.2.01', linha: 'V03' },
      { referencia: '1.1.2.02', linha: 'V03' },
    ];

    const pendencias = identificarContasDfcPendentes(linhas, regras, [[contas]]);
    expect(pendencias.map(conta => conta.conta)).toEqual(['1.1.2.03']);
    expect(pendencias[0]).toMatchObject({
      statusDireto: 'Sem classificação',
      statusIndireto: 'Sem linha de variação do capital de giro.',
      sugestaoDireta: {
        codigo: 'dfc-op01',
        contasSemelhantes: [
          { conta: '1.1.2.01', desc: 'Clientes diversos A' },
          { conta: '1.1.2.02', desc: 'Clientes diversos B' },
        ],
      },
      sugestaoIndireta: {
        codigo: 'V03',
        nome: 'V03 · Estoques',
      },
    });

    const linhasAmbiguas: LinhaDemonstracao[] = [
      { id: 'dfc-operacional', nome: 'Operacional', demonstracao: 'dfc', tipo: 'total', itens: [
        { referencia: 'dfc-op01', operacao: 1 }, { referencia: 'dfc-op02', operacao: 1 },
      ] },
      { id: 'dfc-op01', nome: 'Clientes', demonstracao: 'dfc', tipo: 'contas', sublinhaDe: 'dfc-operacional', itens: [{ referencia: '1.1.2.01', operacao: 1 }] },
      { id: 'dfc-op02', nome: 'Outros ativos', demonstracao: 'dfc', tipo: 'contas', sublinhaDe: 'dfc-operacional', itens: [{ referencia: '1.1.2.02', operacao: 1 }] },
    ];
    const regrasAmbiguas = [
      { referencia: '1.1.2.01', linha: 'V01' },
      { referencia: '1.1.2.02', linha: 'V03' },
    ];
    const ambigua = identificarContasDfcPendentes(linhasAmbiguas, regrasAmbiguas, [[contas]])
      .find(conta => conta.conta === '1.1.2.03');
    expect(ambigua?.sugestaoDireta).toBeNull();
    expect(ambigua?.sugestaoIndireta).toBeNull();
  });

  it('preserva centavos e ignora operações manuais antigas tanto nas contas quanto nas totalizações da DRE', () => {
    const linhas = [grupo('Receita', '3.1', -1), grupo('Custo', '3.2'), {
      ...total('Resultado', ['Receita', 'Custo']), itens: [{ referencia: 'Receita', operacao: 1 as const }, { referencia: 'Custo', operacao: -1 as const }],
    }];
    const contas = extractAccounts('R;3.1;Receita;0,00;0,00;100,15;0,00\nD;3.2;Custo;0,00;0,11;0,00;0,00', { strict: true });
    expect(calcularLinhas(linhas, 'dre', [contas]).get('Resultado')).toBe(100.04);
  });

  it('soma contas de naturezas diferentes no mesmo grupo e preserva reversões de despesas e impostos', () => {
    const contas = extractAccounts('A;3.1;Receita;0;0;1000;0\nA;3.2;Imposto;0;100;0;0\nA;4.1;Custo;0;300;0;0\nA;5.1;Reversão de despesa;0;0;40;0\nA;6.1;Reversão de imposto;0;0;10;0', { strict: true });
    const linha = { ...grupo('Resultado', '3.1'), itens: ['3.1', '3.2', '4.1', '5.1', '6.1'].map(referencia => ({ referencia, operacao: -1 as const })) };
    expect(calcularLinhas([linha], 'dre', [contas]).get('Resultado')).toBe(650);
  });

  it('preserva o saldo no Ativo e o inverte no Passivo, ignorando operações manuais em contas e totais', () => {
    const contas = extractAccounts('A;1.1;Disponível;0;0;0;160\nA;1.2;Redutora;0;0;0;-20', { strict: true });
    for (const demonstracao of ['ativo', 'passivo'] as const) {
      const linhas = [
        { ...grupo('Disponível', '1.1'), demonstracao },
        { ...grupo('Redutora', '1.2', -1), demonstracao },
        { ...total('Total', ['Disponível', 'Redutora']), demonstracao, itens: [{ referencia: 'Disponível', operacao: 1 as const }, { referencia: 'Redutora', operacao: -1 as const }] },
      ];
      expect([...calcularLinhas(linhas, demonstracao, [contas]).values()]).toEqual(
        demonstracao === 'ativo' ? [160, -20, 140] : [-160, 20, -140],
      );
    }
  });

  it('não transforma balancete ou conta ausente em zero nem em acumulado parcial', () => {
    const linhas = [grupo('Receita', '3.1'), total('Resultado', ['Receita'])];
    expect([...calcularLinhas(linhas, 'dre', [janeiro, null]).values()]).toEqual([null, null]);
    const semReceita = extractAccounts('A;1.1;Caixa;0;0;0;50', { strict: true });
    expect([...calcularLinhas(linhas, 'dre', [semReceita]).values()]).toEqual([0, 0]);
    expect([...calcularLinhas(linhas, 'dre', []).values()]).toEqual([null, null]);
  });

  it('considera como zero a conta ausente em um período importado nas três demonstrações', () => {
    const semConta = extractAccounts('A;9.9;Outra conta;0;0;0;10', { strict: true });
    const casos = [
      { demonstracao: 'dre' as const, linha: grupo('Receita', '3.1'), contas: janeiro, esperado: 1000 },
      { demonstracao: 'ativo' as const, linha: { ...grupo('Caixa', '1.1'), demonstracao: 'ativo' as const }, contas: extractAccounts('A;1.1;Caixa;0;0;0;160', { strict: true }), esperado: 160 },
      { demonstracao: 'passivo' as const, linha: { ...grupo('Fornecedores', '2.1'), demonstracao: 'passivo' as const }, contas: extractAccounts('P;2.1;Fornecedores;0;0;0;-75', { strict: true }), esperado: 75 },
    ];

    for (const caso of casos) {
      expect(calcularLinhas([caso.linha], caso.demonstracao, [caso.contas, semConta]).get(caso.linha.id)).toBe(caso.esperado);
    }
  });

  it('impede duplicidade e sobreposição entre contas sintéticas e analíticas, inclusive em grupos distintos', () => {
    expect(validarLinhas([grupo('Receita', '3.1'), grupo('Outra receita', '3.1')])).toMatch(/sobrepõe/);
    expect(validarLinhas([grupo('Receita', '3'), grupo('Outra receita', '3.1')])).toMatch(/sobrepõe/);
    expect(validarLinhas([grupo('Receita', '3.1'), grupo('Outra receita', '3.10')])).toBeNull();
    expect(validarLinhas([{ ...grupo('Ativo', '1'), demonstracao: 'ativo' }, { ...grupo('Passivo', '1'), demonstracao: 'passivo' }])).toBeNull();
  });

  it('calcula totalizações independentemente da posição e impede ciclos, referências inválidas e dupla contagem', () => {
    const linhas = [total('Lucro Bruto', ['Receita', 'Custo']), grupo('Receita', '3.1'), grupo('Custo', '3.2')];
    expect(validarLinhas(linhas)).toBeNull();
    expect([...calcularLinhas(linhas, 'dre', [janeiro]).values()]).toEqual([800, 1000, -200]);
    expect(validarLinhas([total('Total', ['Total'])])).toMatch(/circular/);
    expect(validarLinhas([total('Total', ['excluido'])])).toMatch(/mesma demonstração/);
    expect(validarLinhas([grupo('Receita', '3.1'), total('Subtotal', ['Receita']), total('Total', ['Receita', 'Subtotal'])])).toMatch(/mais de uma vez/);
  });

  it('lê milhar brasileiro, decimal com ponto e rejeita números e contas inválidos no modo estrito', () => {
    const contas = extractAccounts('Nível;Conta;Desc. Conta;Saldo Anterior;Val. Débito;Val. Crédito;Saldo Atual;\r\nA;1.1;Caixa;1.234,56;2,00;0,00;1236.56', { strict: true });
    expect(contas['1.1'].saldoAnt).toBe(1234.56);
    expect(contas['1.1'].saldoAtual).toBe(1236.56);
    expect(() => extractAccounts('A;1.1;Caixa;0,00;erro;0,00;0,00', { strict: true })).toThrow(/Valor inválido/);
    expect(() => extractAccounts('A;1.1;incompleta', { strict: true })).toThrow(/incompleta/);
    expect(() => extractAccounts('A;conta;Caixa;0;0;0;0', { strict: true })).toThrow(/Conta inválida/);
    expect(extractAccounts('A;1;Ativo;0;0;0;10\nA;1;Ativo;0;0;0;20', { strict: true })['1'].saldoAtual).toBe(20);
  });

  it('identifica contas iniciais e sintéticas, sem confundir códigos semelhantes nem exigir tamanho fixo das analíticas', () => {
    const contas = extractAccounts('1;3;Receitas;0;0;100;0\n2;3.1;Grupo;0;0;100;0\nA;3.1.1;Receita detalhada;0;0;100;0\nA;3.10;Outra receita;0;0;50;0\nS;4.1.1.01.01.001;Agrupadora;0;0;500;0', { strict: true });
    const incompletas = identificarContasIncompletas([contas]);
    expect([...incompletas].sort()).toEqual(['3', '3.1', '4.1.1.01.01.001']);
    expect(validarContasCompletas([grupo('Receita', '3.1')], incompletas)).toMatch(/incompleta ou é agrupadora/);
    expect(validarContasCompletas([grupo('Receita', '3.1.1')], incompletas)).toBeNull();
    expect(validarContasCompletas([grupo('Outra receita', '3.10')], incompletas)).toBeNull();
  });

  it('não calcula contas agrupadoras de cadastros antigos, mas mantém contas completas repetidas sem dupla soma', () => {
    const contas = extractAccounts('2;3.1;Grupo;0;0;100;0\n2;3.1;Grupo repetido;0;0;200;0\nA;3.1.1;Detalhada;0;0;20;0\nA;3.1.1;Detalhada repetida;0;0;30;0', { strict: true });
    expect(calcularLinhas([grupo('Grupo antigo', '3.1'), total('Total antigo', ['Grupo antigo'])], 'dre', [contas])).toEqual(new Map([['Grupo antigo', null], ['Total antigo', null]]));
    expect(calcularLinhas([grupo('Receita', '3.1.1')], 'dre', [contas]).get('Receita')).toBe(30);
  });
});
