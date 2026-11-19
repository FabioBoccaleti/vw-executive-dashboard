import { describe, expect, it } from 'vitest';
import { extractAccounts } from '@/components/FluxoCaixaDashboard/balanceteParser';
import { calcularLinhas, identificarContasIncompletas, validarContasCompletas, validarLinhas, type LinhaDemonstracao } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';

const grupo = (id: string, conta: string, operacao: 1 | -1 = 1): LinhaDemonstracao => ({
  id, nome: id, demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: conta, operacao }],
});
const total = (id: string, referencias: string[]): LinhaDemonstracao => ({
  id, nome: id, demonstracao: 'dre', tipo: 'total', itens: referencias.map(referencia => ({ referencia, operacao: 1 })),
});
const janeiro = extractAccounts('R;3.1;Receita;0,00;0,00;1.000,00;10.000,00\nD;3.2;Custo;0,00;200,00;0,00;2.000,00', { strict: true });
const fevereiro = extractAccounts('R;3.1;Receita;0,00;100,00;0,00;9.900,00\nD;3.2;Custo;0,00;50,00;0,00;2.050,00', { strict: true });

describe('Demonstrações financeiras — cálculo e integridade', () => {
  it('calcula DRE pelo movimento com sinais automáticos, inclusive estornos, totalizações e subtotais', () => {
    const linhas = [grupo('Receita', '3.1'), grupo('Custo', '3.2', -1), total('Resultado', ['Receita', 'Custo']), total('Resultado final', ['Resultado'])];
    expect([...calcularLinhas(linhas, 'dre', [janeiro]).values()]).toEqual([1000, -200, 800, 800]);
    expect([...calcularLinhas(linhas, 'dre', [janeiro, fevereiro]).values()]).toEqual([900, -250, 650, 650]);
    expect(calcularLinhas(linhas, 'dre', [fevereiro]).get('Receita')).toBe(-100);
  });

  it('usa saldos pontuais no patrimônio em vez de movimentos ou soma de meses', () => {
    const linha = { ...grupo('Caixa', '1.1'), demonstracao: 'ativo' as const };
    const atual = extractAccounts('A;1.1;Caixa;150,00;20,00;10,00;160,00', { strict: true });
    const anterior = extractAccounts('A;1.1;Caixa;90,00;80,00;20,00;150,00', { strict: true });
    expect(calcularLinhas([linha], 'ativo', [atual]).get('Caixa')).toBe(160);
    expect(calcularLinhas([linha], 'ativo', [anterior]).get('Caixa')).toBe(150);
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

  it('mantém a escolha manual de sinais das contas e totalizações em Ativo e Passivo', () => {
    const contas = extractAccounts('A;1.1;Disponível;0;0;0;160\nA;1.2;Redutora;0;0;0;-20', { strict: true });
    for (const demonstracao of ['ativo', 'passivo'] as const) {
      const linhas = [
        { ...grupo('Disponível', '1.1'), demonstracao },
        { ...grupo('Redutora', '1.2', -1), demonstracao },
        { ...total('Total', ['Disponível', 'Redutora']), demonstracao, itens: [{ referencia: 'Disponível', operacao: 1 as const }, { referencia: 'Redutora', operacao: -1 as const }] },
      ];
      expect([...calcularLinhas(linhas, demonstracao, [contas]).values()]).toEqual([160, -20, 180]);
    }
  });

  it('não transforma balancete ou conta ausente em zero nem em acumulado parcial', () => {
    const linhas = [grupo('Receita', '3.1'), total('Resultado', ['Receita'])];
    expect([...calcularLinhas(linhas, 'dre', [janeiro, null]).values()]).toEqual([null, null]);
    expect([...calcularLinhas(linhas, 'dre', [{}]).values()]).toEqual([null, null]);
    expect([...calcularLinhas(linhas, 'dre', []).values()]).toEqual([null, null]);
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
