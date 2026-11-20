import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { extractAccounts } from '@/components/FluxoCaixaDashboard/balanceteParser';
import {
  aplicarModeloDfcPadrao, cadastroVazio, chavePeriodo,
  type DadosDemonstracoes, type LinhaDemonstracao,
} from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import { criarWorkbookDemonstracoesFinanceiras } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/exportacaoExcel';

describe('Exportação Excel das demonstrações financeiras', () => {
  it('gera abas profissionais com meses, acumulados, saldos patrimoniais, conciliação e notas', async () => {
    const base = aplicarModeloDfcPadrao(cadastroVazio());
    const linhas: LinhaDemonstracao[] = [
      ...base.linhas,
      { id: 'dre-receita', nome: 'Receita total', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1.1', operacao: 1 }] },
      { id: 'ativo-caixa', nome: 'Caixa', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.1.1.01', operacao: 1 }] },
      { id: 'passivo-fornecedor', nome: 'Fornecedores', demonstracao: 'passivo', tipo: 'contas', itens: [{ referencia: '2.1.1', operacao: 1 }] },
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
        'A;1.1.1.01;Bancos;100;0;0;100',
        'P;2.1.1.01;Fornecedores;10;0;20;30',
      ].join('\n'), { strict: true }),
      [chavePeriodo({ ano: 2026, mes: 2 })]: extractAccounts([
        'A;3.1.1;Receita;-100;0;50;-150',
        'A;1.1.1.01;Bancos;100;0;0;150',
        'P;2.1.1.01;Fornecedores;30;0;10;40',
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
      'DRE', 'Ativo', 'Passivo + PL', 'Endividamento', 'DFC Direto', 'DFC Indireto',
    ]);
    const bytes = await workbook.xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(bytes);

    const dre = reopened.getWorksheet('DRE')!;
    expect(dre.getCell('B7').value).toBe('Jan/2026');
    expect(dre.getCell('C7').value).toBe('Fev/2026');
    expect(dre.getCell('D7').value).toBe('Acum. Jan–Fev/2026');
    expect(dre.getCell('B8').value).toBe(100);
    expect(dre.getCell('C8').value).toBe(50);
    expect(dre.getCell('D8').value).toBe(150);
    expect(dre.getCell('A1').value).toBe('Empresa Exemplo LTDA');
    expect(dre.getCell('B8').numFmt).toContain('#,##0.00');

    const ativo = reopened.getWorksheet('Ativo')!;
    expect(ativo.getCell('B7').value).toBe('Jan/2026');
    expect(ativo.getCell('C7').value).toBe('Fev/2026');
    expect(ativo.getCell('D7').value).toBeNull();
    expect(ativo.getCell('B8').value).toBe(100);
    expect(ativo.getCell('C8').value).toBe(150);

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
});
