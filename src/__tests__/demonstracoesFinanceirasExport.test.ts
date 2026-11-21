import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { extractAccounts } from '@/components/FluxoCaixaDashboard/balanceteParser';
import {
  aplicarModeloBalancoSorana, aplicarModeloDfcPadrao, cadastroVazio, chavePeriodo,
  type DadosDemonstracoes, type LinhaDemonstracao,
} from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import { criarWorkbookDemonstracoesFinanceiras } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/exportacaoExcel';
import { construirConferencias } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/conferenciasModelo';
import { CONFERENCIAS_CONFIG_PADRAO } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/conferenciasStorage';
import type { ConferenciasExportacao } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/conferenciasDados';

describe('Exportação Excel das demonstrações financeiras', () => {
  it('inclui resumo de todos os períodos e detalhes completos, com semáforos, valores numéricos e versões', async () => {
    const cadastro = aplicarModeloDfcPadrao(cadastroVazio());
    const antes = extractAccounts('A;1.1.1.01;Caixa;100;20;0;120', { strict: true });
    const depois = extractAccounts('A;1.1.1.01;Caixa;102;20;0;122', { strict: true });
    const conta = {
      conta: '1.1.1.01', descricao: 'Caixa', saldoAnterior: 102, debitos: 20, creditos: 0, saldoAtual: 122,
      movimento: -20, detalhe: 'Conferir continuidade',
    };
    const resultados = construirConferencias({
      ano: 2026, mes: 3, atual: depois, anterior: antes, proximo: depois,
      acumulado: [antes, antes, depois], mesesDoAno: [], mesesAnteriores: [],
      cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
    }).map(resultado => resultado.id === 'alertas' ? {
      ...resultado,
      movimentosPL: [{ grupo: '2.3.3', variacao: 12.34, estado: 'Atenção: revisar' }],
      variacoesAtipicas: [{
        demonstracao: 'Ativo', linha: 'Caixa', valorMes: 122, mediaAnterior: 100,
        variacao: 22, variacaoPercentual: 22, motivo: 'Variação de teste', contas: [conta],
      }],
      arrendamentos: {
        aumentoPassivoCentavos: 12345, variacaoDireitoUsoCentavos: 23456, fluxoDfcCentavos: -100,
        contasPassivo: Object.values(depois), contasDireitoUso: Object.values(antes),
      },
    } : resultado.id === 'continuidade-saldos' ? {
      ...resultado, contas: [conta], contasMesSeguinte: [{ ...conta, detalhe: 'Mês seguinte' }],
    } : resultado);
    const actor = { userId: 'user-1', username: 'conferente' };
    const referencia = {
      id: '11111111-1111-4111-8111-111111111111', version: 'v1', year: 2026, month: 3,
      importedAt: 1000, importedBy: actor, status: 'imported' as const, chunkCount: 1,
      fileName: 'Balancete emitido.txt', emittedAt: 2000, emittedBy: actor,
    };
    const conferencias: ConferenciasExportacao = {
      ano: 2026, mes: 3, config: CONFERENCIAS_CONFIG_PADRAO, resultados,
      snapshots: [referencia],
      comparacoes: [{
        rotulo: 'Versão emitida', referencia,
        contas: [
          { conta: conta.conta, descricao: 'Caixa', antes: antes[conta.conta], depois: depois[conta.conta] },
          { conta: '9.1', descricao: 'Conta removida', antes: antes[conta.conta], depois: null },
        ],
        linhas: [{ demonstracao: 'Ativo', linha: 'Caixa', antes: 120, depois: 122, diferenca: 2 }],
      }],
    };
    const periodos = [2026, 2025].flatMap(ano => [1, 2, 3].map(mes =>
      ano === 2026 && mes === 3 ? conferencias : {
        ...conferencias, ano, mes, snapshots: [], comparacoes: [],
        resultados: construirConferencias({
          ano, mes, atual: null, anterior: null, proximo: null,
          acumulado: [], mesesDoAno: [], mesesAnteriores: [], cadastro, config: CONFERENCIAS_CONFIG_PADRAO,
        }),
      }));
    const workbook = criarWorkbookDemonstracoesFinanceiras({
      cadastro, dados: {}, anos: [2026, 2025], mesLimite: 3, incluirNotasAnuais: false, notas: [], conferencias: periodos,
    });
    const bytes = await workbook.xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(bytes);
    const ws = reopened.getWorksheet('Conferências')!;
    expect(ws).toBeDefined();
    expect(ws.getColumn(1).values).toContain('Painel de conferências · 03/2026');
    expect(ws.getColumn(1).values).toContain('Painel de conferências · 03/2025');
    expect(ws.getColumn(1).values).not.toContain('Painel de conferências · 04/2026');
    expect([6, 7, 8, 9, 10, 11].map(indice => ws.getCell(indice, 1).value)).toEqual(
      ['01/2026', '02/2026', '03/2026', '01/2025', '02/2025', '03/2025'],
    );
    expect(ws.getCell('B6').value).toBe('Indisponível');
    expect(ws.getCell('B6').fill).toMatchObject({ fgColor: { argb: 'FFE2E8F0' } });
    expect(ws.getCell('B8').value).toBe('Erro');
    expect(ws.getCell('B8').fill).toMatchObject({ fgColor: { argb: 'FFFEE2E2' } });
    expect(ws.getCell('B8').note).toBe(resultados[0].resumo);
    expect(ws.getCell('D8').value).toBe('Informativo');
    expect(ws.getCell('D8').fill).toMatchObject({ fgColor: { argb: 'FFDBEAFE' } });
    expect(ws.getCell('M5').value).toBe(resultados[11].titulo);
    const inicioDetalhes = ws.getColumn(1).values.indexOf('Painel de conferências · 03/2026') + 2;
    for (const [index, resultado] of resultados.entries()) {
      const row = ws.getRow(index + inicioDetalhes);
      expect(row.getCell(1).value).toBe(resultado.titulo);
      expect(row.getCell(3).value).toBe(resultado.resumo);
      expect(row.getCell(2).fill).toMatchObject({ type: 'pattern', pattern: 'solid' });
    }
    const rowWith = (coluna: number, valor: string) => {
      const indice = ws.getColumn(coluna).values.indexOf(valor);
      expect(indice).toBeGreaterThan(0);
      return ws.getRow(indice);
    };
    const divergencia = rowWith(2, 'Caixa — Conferir continuidade');
    expect(divergencia.getCell(3).value).toBe(102);
    expect(divergencia.getCell(6).value).toBe(122);
    expect(divergencia.getCell(7).value).toBe(-20);
    expect(divergencia.getCell(6).numFmt).toContain('#,##0.00');
    const variacao = rowWith(2, 'Caixa — Variação de teste');
    expect(variacao.getCell(6).value).toBe(0.22);
    expect(variacao.getCell(6).numFmt).toBe('0.0%;[Red]-0.0%;-');
    const historico = rowWith(1, 'Balancete emitido.txt');
    expect(historico.getCell(3).value).toEqual(new Date(1000));
    expect(historico.getCell(4).value).toBe('conferente');
    expect(historico.getCell(6).value).toEqual(new Date(2000));
    const removida = rowWith(2, 'Conta removida');
    expect(removida.getCell(9).value).toBe(120);
    expect(removida.getCell(10).value).toBeNull();
    const tolerancia = rowWith(1, 'Tolerância de conferência (R$)');
    expect(tolerancia.getCell(2).value).toBe(1);
    expect(ws.getColumn(1).values).toContain('Histórico de importações');
    expect(ws.getColumn(1).values).toContain('Parâmetros das conferências');
    expect(ws.getColumn(1).values.filter(valor => valor === 'Parâmetros das conferências')).toHaveLength(1);
    expect(ws.getColumn(1).values).toContain('Divergências no saldo anterior do mês seguinte');
    expect(reopened.getWorksheet('DRE')).toBeDefined();
  });

  it('gera abas profissionais com meses, acumulados, saldos patrimoniais, conciliação e notas', async () => {
    const base = aplicarModeloDfcPadrao(cadastroVazio());
    const linhas: LinhaDemonstracao[] = [
      ...base.linhas,
      { id: 'dre-receita', nome: 'Receita Líquida de Vendas', demonstracao: 'dre', tipo: 'contas', itens: [
        { referencia: '3.1.1', operacao: 1 }, { referencia: '3.1.2', operacao: 1 },
      ] },
      { id: 'dre-custos', nome: 'Custos', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.2', operacao: 1 }] },
      { id: 'dre-resultado', nome: 'Resultado', demonstracao: 'dre', tipo: 'total', itens: [
        { referencia: 'dre-receita', operacao: 1 }, { referencia: 'dre-custos', operacao: 1 },
      ] },
      { id: 'dre-outras', nome: 'Outras receitas', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1.3', operacao: 1 }] },
      { id: 'ativo-caixa', nome: 'Caixa', demonstracao: 'ativo', tipo: 'contas', itens: [
        { referencia: '1.1.1.01', operacao: 1 }, { referencia: '1.1.1.02', operacao: 1 },
      ] },
      { id: 'passivo-fornecedor', nome: 'Fornecedores', demonstracao: 'passivo', tipo: 'contas', itens: [
        { referencia: '2.1.1.01', operacao: 1 }, { referencia: '2.1.1.02', operacao: 1 },
      ] },
      { id: 'debt-root', nome: 'Empréstimos', demonstracao: 'endividamento', tipo: 'total', itens: [{ referencia: 'loan-1', operacao: 1 }] },
      {
        id: 'loan-1', nome: 'Banco Exemplo', demonstracao: 'endividamento', tipo: 'contas', bancoDe: 'debt-root',
        itens: [{ referencia: '2.1.1.01', operacao: 1 }],
        captacao: {
          data: '2026-01-10', valorCentavos: 100000, taxa: 'CDI + 2%', parcelasTotais: 12,
          restantesPorMes: { '2026_1': 12, '2026_2': 11 },
          jurosProvisionadosPorMes: { '2026_1': 1500, '2026_2': 1200 },
        },
      },
    ];
    const cadastro = {
      ...base,
      empresa: { nome: 'Empresa Exemplo LTDA', cnpj: '00.000.000/0001-00', nire: '12345' },
      linhas,
    };
    const dados: DadosDemonstracoes = {
      [chavePeriodo({ ano: 2026, mes: 1 })]: extractAccounts([
        'A;3.1.1;Receita;0;0;100; -100',
        'A;3.1.2;Receita sem movimento;0;0;0;0',
        'A;3.1.3;Receita com movimento em outro mês;0;0;0;0',
        'D;3.2;Custos;0;20;0;0',
        'A;1.1.1.01;Bancos;100;0;0;100',
        'A;1.1.1.02;Banco sem saldo;0;0;0;0',
        'P;2.1.1.01;Fornecedores;10;0;20;30',
        'P;2.1.1.02;Fornecedor sem saldo;0;0;0;0',
      ].join('\n'), { strict: true }),
      [chavePeriodo({ ano: 2026, mes: 2 })]: extractAccounts([
        'A;3.1.1;Receita;-100;0;50;-150',
        'A;3.1.2;Receita sem movimento;0;0;0;0',
        'A;3.1.3;Receita com movimento em outro mês;0;0;5;5',
        'D;3.2;Custos;0;10;0;0',
        'A;1.1.1.01;Bancos;100;0;0;150',
        'A;1.1.1.02;Banco sem saldo;0;0;0;0',
        'P;2.1.1.01;Fornecedores;30;0;10;40',
        'P;2.1.1.02;Fornecedor sem saldo;0;0;0;0',
      ].join('\n'), { strict: true }),
    };
    const workbook = criarWorkbookDemonstracoesFinanceiras({
      cadastro,
      dados,
      anos: [2026],
      mesLimite: 2,
      incluirNotasAnuais: false,
      notas: [{
        escopo: { ano: 2026, mes: 1, periodo: 'mes', metodo: 'direto' },
        notas: [{ id: 'nota-1', linhaId: 'dfc-op01', linhaNome: 'Recebimentos de clientes', texto: 'Recebimento extraordinário no mês.' }],
      }],
    });

    expect(workbook.worksheets.map(worksheet => worksheet.name)).toEqual([
      'DRE', 'DFC Direto', 'DFC Indireto', 'Endividamento',
      'Ativo', 'Passivo + PL',
      'DRE - Abertura', 'Ativo - Abertura', 'Passivo + PL - Abertura',
    ]);
    const bytes = await workbook.xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(bytes);

    const dre = reopened.getWorksheet('DRE')!;
    expect(dre.getCell('B7').value).toBe('Jan/2026\nR$');
    expect(dre.getCell('C7').value).toBe('Jan/2026\n% RL Vendas');
    expect(dre.getCell('D7').value).toBe('Fev/2026\nR$');
    expect(dre.getCell('E7').value).toBe('Fev/2026\n% RL Vendas');
    expect(dre.getCell('F7').value).toBe('Acum. Jan–Fev/2026\nR$');
    expect(dre.getCell('G7').value).toBe('Acum. Jan–Fev/2026\n% RL Vendas');
    expect(dre.getCell('B8').value).toBe(100);
    expect(dre.getCell('C8').value).toBe(1);
    expect(dre.getCell('D8').value).toBe(50);
    expect(dre.getCell('E8').value).toBe(1);
    expect(dre.getCell('F8').value).toBe(150);
    expect(dre.getCell('G8').value).toBe(1);
    expect(dre.getCell('A1').value).toBe('Empresa Exemplo LTDA');
    expect(dre.getCell('B8').numFmt).toContain('#,##0.00');
    expect(dre.getCell('C8').numFmt).toBe('0.0%;[Red]-0.0%;-');
    const linhaCustos = dre.getColumn(1).values.indexOf('Custos');
    expect(dre.getCell(linhaCustos, 2).value).toBe(-20);
    expect(dre.getCell(linhaCustos, 3).value).toBe(-0.2);
    expect(dre.getCell(linhaCustos, 5).value).toBe(-0.2);
    const linhaResultado = dre.getColumn(1).values.indexOf('Resultado');
    expect(dre.getCell(linhaResultado, 2).value).toBe(80);
    expect(dre.getCell(linhaResultado, 3).value).toBe(0.8);

    const aberturaDre = reopened.getWorksheet('DRE - Abertura')!;
    const linhaReceita = aberturaDre.getColumn(1).values.indexOf('3.1.1 — Receita');
    expect(linhaReceita).toBeGreaterThan(0);
    expect(aberturaDre.getCell(linhaReceita, 2).value).toBe(100);
    expect(aberturaDre.getCell(linhaReceita, 3).value).toBe(50);
    expect(aberturaDre.getCell(linhaReceita, 4).value).toBe(150);
    expect(aberturaDre.getColumn(1).values).not.toContain('3.1.2 — Receita sem movimento');
    const linhaReceitaOutroMes = aberturaDre.getColumn(1).values.indexOf('3.1.3 — Receita com movimento em outro mês');
    expect(linhaReceitaOutroMes).toBeGreaterThan(0);
    expect(aberturaDre.getCell(linhaReceitaOutroMes, 2).value).toBe(0);
    expect(aberturaDre.getCell(linhaReceitaOutroMes, 3).value).toBe(5);

    const ativo = reopened.getWorksheet('Ativo')!;
    expect(ativo.getCell('B7').value).toBe('Jan/2026');
    expect(ativo.getCell('C7').value).toBe('Fev/2026');
    expect(ativo.getCell('D7').value).toBeNull();
    expect(ativo.getCell('B8').value).toBe(100);
    expect(ativo.getCell('C8').value).toBe(150);

    const aberturaAtivo = reopened.getWorksheet('Ativo - Abertura')!;
    const linhaBancos = aberturaAtivo.getColumn(1).values.indexOf('1.1.1.01 — Bancos');
    expect(linhaBancos).toBeGreaterThan(0);
    expect(aberturaAtivo.getCell(linhaBancos, 2).value).toBe(100);
    expect(aberturaAtivo.getCell(linhaBancos, 3).value).toBe(150);
    expect(aberturaAtivo.getColumn(1).values).not.toContain('1.1.1.02 — Banco sem saldo');

    const aberturaPassivo = reopened.getWorksheet('Passivo + PL - Abertura')!;
    const linhaFornecedor = aberturaPassivo.getColumn(1).values.indexOf('2.1.1.01 — Fornecedores');
    expect(linhaFornecedor).toBeGreaterThan(0);
    expect(aberturaPassivo.getCell(linhaFornecedor, 2).value).toBe(30);
    expect(aberturaPassivo.getCell(linhaFornecedor, 3).value).toBe(40);
    expect(aberturaPassivo.getColumn(1).values).not.toContain('2.1.1.02 — Fornecedor sem saldo');

    const endividamento = reopened.getWorksheet('Endividamento')!;
    expect(endividamento.getColumn(7).values).toContain(12);
    expect(endividamento.getColumn(8).values).toContain(15);

    const dfcDireto = reopened.getWorksheet('DFC Direto')!;
    expect(dfcDireto.getColumn(1).values).toContain('Caixa e equivalentes — conciliação');
    expect(dfcDireto.getColumn(1).values).toContain('Notas explicativas — Método Direto');
    expect(dfcDireto.getColumn(1).values).toContain('Jan/2026 | Recebimentos de clientes: Recebimento extraordinário no mês.');
    const inicioCaixa = dfcDireto.getColumn(1).values.indexOf('Saldo de caixa — início');
    expect(dfcDireto.getCell(inicioCaixa, 2).value).toBe(100);
    expect(dfcDireto.getCell(inicioCaixa, 4).value).toBe(100);

    expect(reopened.getWorksheet('DFC Indireto')!.getColumn(1).values).toContain('Resultado líquido do período (lucro + / prejuízo –)');
  });

  it('exporta a composição do PL e as diferenças das duas conferências do balanço', () => {
    const base = aplicarModeloDfcPadrao(cadastroVazio());
    const cadastro = aplicarModeloBalancoSorana({
      ...base,
      empresa: { nome: 'Empresa Exemplo LTDA', cnpj: '00.000.000/0001-00', nire: '' },
      linhas: [
        ...base.linhas,
        { id: 'ativo-total', nome: 'Ativo', demonstracao: 'ativo', tipo: 'total', itens: [
          { referencia: 'ativo-caixa', operacao: 1 }, { referencia: 'ativo-depreciacao', operacao: 1 },
        ] },
        { id: 'ativo-caixa', nome: 'Caixa', demonstracao: 'ativo', tipo: 'contas', sublinhaDe: 'ativo-total', itens: [
          { referencia: '1.1.1.01', operacao: 1 },
        ] },
        { id: 'ativo-depreciacao', nome: 'Depreciação acumulada', demonstracao: 'ativo', tipo: 'contas', sublinhaDe: 'ativo-total', itens: [
          { referencia: '1.5.5.02.01.001', operacao: 1 },
        ] },
        { id: 'passivo-total', nome: 'Passivo', demonstracao: 'passivo', tipo: 'total', itens: [
          { referencia: 'passivo-nao-circulante', operacao: 1 },
        ] },
        { id: 'passivo-nao-circulante', nome: 'Passivo Não Circulante', demonstracao: 'passivo', tipo: 'contas', sublinhaDe: 'passivo-total', itens: [
          { referencia: '2.1.1', operacao: 1 }, { referencia: '2.3.1.01.01.001', operacao: 1 },
        ] },
        { id: 'dre-receita', nome: 'Receita', demonstracao: 'dre', tipo: 'contas', itens: [
          { referencia: '3.1.1', operacao: 1 },
        ] },
        { id: 'dre-custo', nome: 'Custos', demonstracao: 'dre', tipo: 'contas', itens: [
          { referencia: '4.1.1', operacao: 1 },
        ] },
        { id: 'dre-lucro', nome: 'LUCRO LÍQUIDO DO EXERCÍCIO', demonstracao: 'dre', tipo: 'total', itens: [
          { referencia: 'dre-receita', operacao: 1 }, { referencia: 'dre-custo', operacao: 1 },
        ] },
      ],
    });
    const criarBalancete = (mes: number) => extractAccounts([
      'A;1.1.1.01;Caixa;0;0;0;1000',
      'A;1.5.5.02.01.001;Depreciação acumulada;0;0;0;10',
      'P;2.1.1;Passivo;0;0;0;-100',
      `P;2.3.1;Capital social totalizador;0;0;0;${mes === 1 ? -810 : -740}`,
      `P;2.3.1.01.01.001;Capital social;0;0;0;${mes === 1 ? -810 : -740}`,
      `R;3.1.1;Receita;0;0;100;${mes === 1 ? -100 : -200}`,
      `D;4.1.1;Custo;0;20;0;${mes === 1 ? 20 : 40}`,
      `D;5.1.1;Despesa não classificada;0;${mes === 1 ? 0 : 10};0;${mes === 1 ? 0 : 10}`,
    ].join('\n'), { strict: true });
    const workbook = criarWorkbookDemonstracoesFinanceiras({
      cadastro,
      dados: {
        [chavePeriodo({ ano: 2026, mes: 1 })]: criarBalancete(1),
        [chavePeriodo({ ano: 2026, mes: 2 })]: criarBalancete(2),
      },
      anos: [2026],
      mesLimite: 2,
      incluirNotasAnuais: false,
      notas: [],
    });
    const passivo = workbook.getWorksheet('Passivo + PL')!;
    const colunaNomes = passivo.getColumn(1).values;
    const linhaCapital = colunaNomes.indexOf('Capital Social');
    const linhaBalanco = colunaNomes.indexOf('Ativo – (Passivo + PL)');
    const linhaResultado = colunaNomes.indexOf('Resultado do balancete – Lucro líquido da DRE');
    const linhaSemDre = colunaNomes.indexOf('5.1.1 — Despesa não classificada');

    expect([passivo.getCell(linhaCapital, 2).value, passivo.getCell(linhaCapital, 3).value]).toEqual([810, 740]);
    expect([passivo.getCell(linhaBalanco, 2).value, passivo.getCell(linhaBalanco, 3).value]).toEqual([0, 0]);
    expect([passivo.getCell(linhaResultado, 2).value, passivo.getCell(linhaResultado, 3).value]).toEqual([0, -10]);
    expect(passivo.getCell(linhaSemDre, 3).value).toBe(-10);
  });
});
