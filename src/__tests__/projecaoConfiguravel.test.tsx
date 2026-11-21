import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ProjecaoTab } from '@/components/FluxoCaixaDashboard/ProjecaoTab';
import { cadastroVazio, type LinhaDemonstracao } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import type { ContasBalancete } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import { loadCadastroDemonstracoes } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/storage';

vi.mock('@/lib/kvClient', () => ({
  kvGet: vi.fn().mockResolvedValue(null),
  kvSet: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/storage', () => ({
  loadCadastroDemonstracoes: vi.fn(),
}));

afterEach(cleanup);

function criarLinha(
  id: string,
  nome: string,
  demonstracao: LinhaDemonstracao['demonstracao'],
  tipo: LinhaDemonstracao['tipo'],
  referencias: string[],
  sublinhaDe?: string,
): LinhaDemonstracao {
  return {
    id,
    nome,
    demonstracao,
    tipo,
    ...(sublinhaDe ? { sublinhaDe } : {}),
    itens: referencias.map(referencia => ({ referencia, operacao: 1 })),
  };
}

function conta(conta: string, valDeb: number, valCred: number, saldoAnt = 0, saldoAtual = 0): ContasBalancete[string] {
  return { nivel: 'A', conta, desc: conta, saldoAnt, valDeb, valCred, saldoAtual };
}

it('projeta a DRE linha a linha e aplica o ajuste compartilhado do FC Direto', async () => {
  const linhas = [
    criarLinha('dre-receita', 'Receita Líquida de Vendas', 'dre', 'contas', ['3.1.1']),
    criarLinha('dre-custo', 'Custo de Vendas', 'dre', 'contas', ['4.1.1']),
    criarLinha('dre-resultado', 'Resultado Líquido do Exercício', 'dre', 'total', ['dre-receita', 'dre-custo']),
    criarLinha('dfc-operacional', 'Atividades Operacionais', 'dfc', 'total', ['dfc-operacional-detalhe']),
    criarLinha('dfc-operacional-detalhe', 'Movimento operacional', 'dfc', 'contas', ['1.1.1.01'], 'dfc-operacional'),
    criarLinha('dfc-investimento', 'Atividades de Investimento', 'dfc', 'total', ['dfc-investimento-detalhe']),
    criarLinha('dfc-investimento-detalhe', 'Aquisições', 'dfc', 'contas', ['1.5.5.01'], 'dfc-investimento'),
    criarLinha('dfc-financiamento', 'Atividades de Financiamento', 'dfc', 'total', ['dfc-financiamento-detalhe']),
    criarLinha('dfc-financiamento-detalhe', 'Empréstimos', 'dfc', 'contas', ['2.2.1.07.01'], 'dfc-financiamento'),
  ];
  const cadastro = {
    ...cadastroVazio(),
    empresa: { nome: 'Sorana', cnpj: '12345678901234', nire: '' },
    linhas,
    dfcModeloInicializado: true,
    dfcIndiretoModeloInicializado: true,
    dfcIndiretoRegras: [],
  };
  vi.mocked(loadCadastroDemonstracoes).mockResolvedValue(cadastro);
  const accounts: ContasBalancete = {
    '3.1.1': conta('3.1.1', 0, 1000),
    '4.1.1': conta('4.1.1', 400, 0),
    '1.1.1.01': conta('1.1.1.01', 100, 300, 1000, 1200),
    '1.5.5.01': conta('1.5.5.01', 50, 0),
    '2.2.1.07.01': conta('2.2.1.07.01', 0, 40),
  };

  render(
    <ProjecaoTab
      allMonthsAccounts={[accounts]}
      selectedYear={2025}
      selectedMonth={1}
      fmtBRL={value => `$${value.toFixed(2)}`}
    />,
  );

  fireEvent.click(await screen.findByRole('button', { name: /Resultado do Exercício/ }));
  const ajusteReceita = await screen.findByRole('slider', { name: 'Ajuste de Receita Líquida de Vendas' });
  fireEvent.change(ajusteReceita, { target: { value: '10' } });

  const linhaProjetada = screen.getByRole('row', { name: /Fev\/25/ });
  expect(within(linhaProjetada).getByText('$1100.00')).toBeInTheDocument();
  expect(within(linhaProjetada).getByText('($400.00)')).toBeInTheDocument();
  expect(within(linhaProjetada).getByText('$700.00')).toBeInTheDocument();

  fireEvent.change(await screen.findByRole('slider', { name: 'Ajuste de Bloco Operacional' }), {
    target: { value: '10' },
  });
  fireEvent.click(screen.getByRole('button', { name: /FC Direto Projetado/ }));

  const linhaOperacional = screen.getByRole('row', { name: /Atividades Operacionais.*\+\$2420\.00/ });
  expect(linhaOperacional).toHaveTextContent('+$2420.00');

  fireEvent.click(screen.getByRole('button', { name: /FC Indireto Projetado/ }));
  const linhaOperacionalIndireta = screen.getByRole('row', {
    name: /CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS.*\+\$7260\.00/,
  });
  expect(linhaOperacionalIndireta).toBeInTheDocument();
});
