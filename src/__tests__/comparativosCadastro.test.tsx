import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ComparativosTab } from '@/components/FluxoCaixaDashboard/ComparativosTab';
import { loadFluxoCaixaIndex, loadFluxoCaixaRaw } from '@/components/FluxoCaixaDashboard/fluxoCaixaStorage';
import { loadCadastroDemonstracoes } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/storage';
import { aplicarModeloDfcPadrao, cadastroVazio, validarLinhas } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';

vi.mock('@/components/FluxoCaixaDashboard/fluxoCaixaStorage', () => ({
  loadFluxoCaixaRaw: vi.fn(),
  loadFluxoCaixaIndex: vi.fn(),
}));
vi.mock('@/components/FluxoCaixaDashboard/despesasStorage', () => ({
  loadDespesasTipos: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/storage', () => ({
  loadCadastroDemonstracoes: vi.fn(),
}));

afterEach(cleanup);

it('compara a DRE e os métodos direto e indireto cadastrados em períodos distintos', async () => {
  const dreLinhas = [
    { id: 'dre-revenue-gross', nome: 'Receita Bruta', demonstracao: 'dre' as const, tipo: 'contas' as const, itens: [{ referencia: '3.1', operacao: 1 as const }] },
    { id: 'dre-revenue-tax', nome: 'Deduções', demonstracao: 'dre' as const, tipo: 'contas' as const, itens: [{ referencia: '3.2', operacao: 1 as const }] },
    { id: 'dre-revenue', nome: 'Receita Líquida de Vendas', demonstracao: 'dre' as const, tipo: 'total' as const, itens: [{ referencia: 'dre-revenue-gross', operacao: 1 as const }, { referencia: 'dre-revenue-tax', operacao: 1 as const }] },
    { id: 'dre-cmv', nome: 'Custo', demonstracao: 'dre' as const, tipo: 'contas' as const, itens: [{ referencia: '4.1', operacao: 1 as const }] },
    { id: 'dre-gross-profit', nome: 'Lucro Bruto', demonstracao: 'dre' as const, tipo: 'total' as const, itens: [{ referencia: 'dre-revenue', operacao: 1 as const }, { referencia: 'dre-cmv', operacao: 1 as const }] },
    { id: 'dre-expenses', nome: 'Despesas', demonstracao: 'dre' as const, tipo: 'contas' as const, itens: [{ referencia: '5.1', operacao: 1 as const }] },
    { id: 'dre-before-tax', nome: 'Resultado Antes do IR/CSLL', demonstracao: 'dre' as const, tipo: 'total' as const, itens: [{ referencia: 'dre-gross-profit', operacao: 1 as const }, { referencia: 'dre-expenses', operacao: 1 as const }] },
    { id: 'dre-tax', nome: 'IR/CSLL', demonstracao: 'dre' as const, tipo: 'contas' as const, itens: [{ referencia: '6.1', operacao: 1 as const }] },
    { id: 'dre-net-result', nome: 'Resultado Líquido do Exercício', demonstracao: 'dre' as const, tipo: 'total' as const, itens: [{ referencia: 'dre-before-tax', operacao: 1 as const }, { referencia: 'dre-tax', operacao: 1 as const }] },
  ];
  let dummyIndex = 0;
  const cadastro = aplicarModeloDfcPadrao({
    ...cadastroVazio(),
    version: 'cadastro-v1',
    empresa: { nome: 'Sorana', cnpj: 'exemplo', nire: '' },
    linhas: dreLinhas,
  });
  cadastro.linhas = cadastro.linhas.map(linha => {
    if (linha.demonstracao !== 'dfc' || linha.tipo !== 'contas') return linha;
    if (linha.id === 'dfc-op01') {
      return {
        ...linha,
        itens: [
          { referencia: '3.1', operacao: 1 },
          { referencia: '1.1.3.01.01', operacao: 1 },
        ],
      };
    }
    dummyIndex += 1;
    return { ...linha, itens: [{ referencia: `8.9.${dummyIndex}`, operacao: 1 }] };
  });
  expect(validarLinhas(cadastro.linhas)).toBeNull();

  const rawText = [
    'A;1.1.1.01;Caixa;100,00;0,00;0,00;120,00',
    'A;1.1.3.01.01;Clientes;0,00;0,00;0,00;10,00',
    'A;3.1;Receita;0,00;0,00;100,00;-100,00',
    'A;3.2;Deduções;0,00;10,00;0,00;10,00',
    'A;4.1;Custo;0,00;30,00;0,00;30,00',
    'A;5.1;Despesas;0,00;5,00;0,00;5,00',
    'A;6.1;IR e CSLL;0,00;2,00;0,00;2,00',
  ].join('\n');

  vi.mocked(loadFluxoCaixaIndex).mockResolvedValue({
    '2025_12': true,
    '2026_01': true,
    '2026_02': true,
    '2026_03': true,
  });
  vi.mocked(loadFluxoCaixaRaw).mockResolvedValue({ rawText });
  vi.mocked(loadCadastroDemonstracoes).mockResolvedValue(cadastro);

  render(<ComparativosTab selectedYear={2026} selectedMonth={3} />);

  await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(8));
  const selectors = screen.getAllByRole('combobox') as HTMLSelectElement[];
  expect([selectors[0].value, selectors[2].value, selectors[4].value, selectors[6].value])
    .toEqual(['2025', '2026', '2026', '2026']);
  expect([selectors[1].value, selectors[3].value, selectors[5].value, selectors[7].value])
    .toEqual(['12', '1', '2', '3']);

  fireEvent.click(screen.getByRole('button', { name: 'Gerar Comparativo' }));

  const resultRow = await screen.findByRole('row', { name: /Resultado Líquido do Exercício/ });
  expect(resultRow).toHaveTextContent(/53/);
  expect(screen.getByRole('row', { name: /Variação Total — FC Direto/ })).toHaveTextContent(/100/);
  expect(screen.getByRole('row', { name: /Variação Total — FC Indireto/ })).toHaveTextContent(/45/);
  expect(screen.getByRole('row', { name: /Variação Real das Contas de Caixa/ })).toHaveTextContent(/20/);
});
