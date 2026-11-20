import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FluxoCaixaDashboard } from '@/components/FluxoCaixaDashboard';
import { loadFluxoCaixaRaw } from '@/components/FluxoCaixaDashboard/fluxoCaixaStorage';
import { cadastroVazio } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import { kvGet } from '@/lib/kvClient';

vi.mock('@/components/FluxoCaixaDashboard/fluxoCaixaStorage', () => ({
  loadFluxoCaixaRaw: vi.fn().mockResolvedValue(null),
  loadFluxoCaixaIndex: vi.fn().mockResolvedValue({}),
  saveFluxoCaixaData: vi.fn(),
}));
vi.mock('@/lib/kvClient', () => ({
  kvGet: vi.fn().mockResolvedValue(null),
  kvSet: vi.fn(),
  kvCompareAndSet: vi.fn(),
}));
vi.mock('@/components/FluxoCaixaDashboard/ComparativosTab', () => ({
  ComparativosTab: () => <div>Comparativos</div>,
}));

afterEach(cleanup);

it.each([3, 0])('mantém a emissão aberta ao carregar um novo período (%s) com balancete válido', async mes => {
  const rawText = Array.from({ length: 10 }, (_, index) => `A;1.${index + 1};Conta ${index};0,00;0,00;0,00;10,00`).join('\n');
  const mesAnterior = localStorage.getItem('fluxo_caixa_selected_month');
  localStorage.setItem('fluxo_caixa_selected_month', '1');
  vi.mocked(loadFluxoCaixaRaw).mockResolvedValue({ rawText });
  try {
    render(<FluxoCaixaDashboard />);
    await screen.findByText('Total do Ativo');
    fireEvent.click(screen.getByRole('button', { name: 'Emissão de Demonstrações Financeiras' }));
    await screen.findByRole('heading', { name: 'Emissão de Demonstrações Financeiras' });
    const mesAtual = screen.getAllByRole('combobox')[1];
    fireEvent.change(mesAtual, { target: { value: String(mes) } });
    await waitFor(() => expect(screen.queryByText('Carregando balancetes...')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Emissão de Demonstrações Financeiras' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emissão de Demonstrações Financeiras' })).toHaveAttribute('aria-current', 'page');
  } finally {
    cleanup();
    if (mesAnterior === null) localStorage.removeItem('fluxo_caixa_selected_month');
    else localStorage.setItem('fluxo_caixa_selected_month', mesAnterior);
    vi.mocked(loadFluxoCaixaRaw).mockResolvedValue(null);
  }
});

it('abre Emissão de Demonstrações Financeiras pela opção separada logo acima de Novo Arquivo', async () => {
  render(<FluxoCaixaDashboard />);
  const botoes = within(screen.getByRole('complementary')).getAllByRole('button');
  const emissao = screen.getByRole('button', { name: 'Emissão de Demonstrações Financeiras' });
  const novoArquivo = screen.getByRole('button', { name: 'Novo Arquivo' });
  expect(botoes.indexOf(novoArquivo)).toBe(botoes.indexOf(emissao) + 1);

  fireEvent.click(emissao);
  expect(await screen.findByRole('heading', { name: 'Emissão de Demonstrações Financeiras' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Cadastros' })).toBeInTheDocument();
  expect(emissao).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Comparativos' }));
  expect(emissao).not.toHaveAttribute('aria-current');
  expect(screen.queryByRole('heading', { name: 'Emissão de Demonstrações Financeiras' })).not.toBeInTheDocument();
});

it('mostra o aviso ao entrar em Projeção, fecha com OK e reaparece somente em uma nova entrada', async () => {
  render(<FluxoCaixaDashboard />);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Projeção' }));
  const aviso = within(await screen.findByRole('alertdialog'));
  expect(aviso.getByText('Funcionalidade ainda em Teste.')).toBeInTheDocument();
  fireEvent.click(aviso.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(screen.getByText('Nenhum dado realizado disponível')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Projeção' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Comparativos' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Projeção' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Funcionalidade ainda em Teste.');
});

it('recarrega em Resultado as linhas e valores do cadastro atualizado da DRE', async () => {
  const mesAnterior = localStorage.getItem('fluxo_caixa_selected_month');
  localStorage.setItem('fluxo_caixa_selected_month', '1');
  const rawText = [
    'A;3.1.1;Receita original;0,00;0,00;100,00;100,00',
    'A;3.1.2;Receita atualizada;0,00;0,00;500,00;500,00',
    ...Array.from({ length: 8 }, (_, index) => `A;7.${index + 1};Conta ${index};0,00;0,00;0,00;0,00`),
  ].join('\n');
  const createCadastro = (referencia: string) => ({
    ...cadastroVazio(),
    version: `cadastro-${referencia}`,
    empresa: { nome: 'Sorana', cnpj: '12345678901234', nire: '' },
    linhas: [
      {
        id: 'receita-liquida',
        nome: 'Receita Líquida de Vendas',
        demonstracao: 'dre' as const,
        tipo: 'contas' as const,
        itens: [{ referencia, operacao: 1 as const }],
      },
    ],
  });
  let cadastroSalvo = createCadastro('3.1.1');
  vi.mocked(kvGet).mockImplementation(async key => (
    key === 'fluxo_caixa_demonstracoes_cadastro' ? cadastroSalvo : null
  ));
  vi.mocked(loadFluxoCaixaRaw).mockResolvedValue({ rawText });

  try {
    render(<FluxoCaixaDashboard />);
    await screen.findByText('Total do Ativo');

    fireEvent.click(screen.getByRole('button', { name: 'Resultado' }));
    const linhaOriginal = await screen.findByRole('row', { name: /Receita Líquida de Vendas/ });
    await waitFor(() => expect(linhaOriginal).toHaveTextContent(/100/));

    fireEvent.click(screen.getByRole('button', { name: 'Emissão de Demonstrações Financeiras' }));
    await screen.findByRole('heading', { name: 'Emissão de Demonstrações Financeiras' });
    cadastroSalvo = createCadastro('3.1.2');

    fireEvent.click(screen.getByRole('button', { name: 'Resultado' }));
    const linhaAtualizada = await screen.findByRole('row', { name: /Receita Líquida de Vendas/ });
    await waitFor(() => expect(linhaAtualizada).toHaveTextContent(/500/));

    fireEvent.click(screen.getByRole('button', { name: /Evolução Mensal/ }));
    expect(await screen.findByRole('heading', { name: 'Evolução Mensal — Resultado (DRE)' })).toBeInTheDocument();
    expect(await screen.findByText(/Total:.*500/)).toBeInTheDocument();
  } finally {
    cleanup();
    if (mesAnterior === null) localStorage.removeItem('fluxo_caixa_selected_month');
    else localStorage.setItem('fluxo_caixa_selected_month', mesAnterior);
    vi.mocked(loadFluxoCaixaRaw).mockResolvedValue(null);
    vi.mocked(kvGet).mockResolvedValue(null);
  }
});
