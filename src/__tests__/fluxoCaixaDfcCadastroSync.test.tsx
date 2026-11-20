import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FluxoCaixaDashboard } from '@/components/FluxoCaixaDashboard';
import { loadFluxoCaixaRaw } from '@/components/FluxoCaixaDashboard/fluxoCaixaStorage';
import { aplicarModeloDfcPadrao, cadastroVazio } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
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

it('recarrega cadastro e regras DFC nas abas direta, indireta e evolução mensal', async () => {
  const mesAnterior = localStorage.getItem('fluxo_caixa_selected_month');
  const anoAnterior = localStorage.getItem('fluxo_caixa_selected_year');
  localStorage.setItem('fluxo_caixa_selected_month', '1');
  localStorage.setItem('fluxo_caixa_selected_year', '2026');

  const rawText = [
    'A;1.1.3.01.01;Clientes 1;0,00;10,00;0,00;10,00',
    'A;1.1.3.01.02;Clientes 2;0,00;20,00;0,00;20,00',
    'A;3.1;Receita;0,00;0,00;100,00;-100,00',
    'A;4.1;Custo;0,00;30,00;0,00;30,00',
    ...Array.from({ length: 8 }, (_, index) => `A;9.${index + 1};Conta ${index};0,00;0,00;0,00;0,00`),
  ].join('\n');

  let cadastroSalvo = aplicarModeloDfcPadrao({
    ...cadastroVazio(),
    version: 'cadastro-v1',
    empresa: { nome: 'Sorana', cnpj: 'exemplo', nire: '' },
  });
  vi.mocked(kvGet).mockImplementation(async key => (
    key === 'fluxo_caixa_demonstracoes_cadastro' ? cadastroSalvo : null
  ));
  vi.mocked(loadFluxoCaixaRaw).mockResolvedValue({ rawText });

  try {
    render(<FluxoCaixaDashboard />);
    await screen.findByText('Total do Ativo');

    fireEvent.click(screen.getByRole('button', { name: 'FC Direto' }));
    const recebimentosOriginais = await screen.findByRole('row', { name: /Recebimentos de clientes/ });
    await waitFor(() => expect(recebimentosOriginais).toHaveTextContent(/70/));

    fireEvent.click(screen.getByRole('button', { name: 'Emissão de Demonstrações Financeiras' }));
    await screen.findByRole('heading', { name: 'Emissão de Demonstrações Financeiras' });
    cadastroSalvo = {
      ...cadastroSalvo,
      version: 'cadastro-v2',
      linhas: cadastroSalvo.linhas.map(linha => {
        if (linha.id === 'dfc-op01') {
          return {
            ...linha,
            nome: 'Recebimentos customizados',
            itens: [{ referencia: '1.1.3.01.02', operacao: 1 }],
          };
        }
        if (linha.id === 'dfc-op02') {
          return {
            ...linha,
            itens: [...linha.itens, { referencia: '1.1.3.01.01', operacao: 1 }],
          };
        }
        return linha;
      }),
      dfcIndiretoRegras: cadastroSalvo.dfcIndiretoRegras?.map(regra => (
        regra.referencia === '1.1.3.01.02' ? { ...regra, linha: 'V03' } : regra
      )),
    };

    fireEvent.click(screen.getByRole('button', { name: 'FC Direto' }));
    const recebimentosAtualizados = await screen.findByRole('row', { name: /Recebimentos customizados/ });
    await waitFor(() => expect(recebimentosAtualizados).toHaveTextContent(/20/));
    fireEvent.click(screen.getByRole('button', { name: /Evolução Mensal/ }));
    expect(await screen.findByText('Recebimentos customizados')).toBeInTheDocument();
    expect(await screen.findByText(/Total:.*20/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    fireEvent.click(screen.getByRole('button', { name: 'FC Indireto' }));
    const variacaoClientes = await screen.findByRole('row', { name: /Clientes e créditos de vendas/ });
    const variacaoEstoques = screen.getByRole('row', { name: /^Estoques/ });
    await waitFor(() => {
      expect(variacaoClientes).toHaveTextContent(/10/);
      expect(variacaoEstoques).toHaveTextContent(/20/);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Diagnóstico Mês' }));
    expect(await screen.findByText(/Variação total:/)).toHaveTextContent(/40/);
    expect(await screen.findByText(/Contribuição por atividade \(FC Indireto\)/)).toBeInTheDocument();
  } finally {
    if (mesAnterior === null) localStorage.removeItem('fluxo_caixa_selected_month');
    else localStorage.setItem('fluxo_caixa_selected_month', mesAnterior);
    if (anoAnterior === null) localStorage.removeItem('fluxo_caixa_selected_year');
    else localStorage.setItem('fluxo_caixa_selected_year', anoAnterior);
    vi.mocked(loadFluxoCaixaRaw).mockResolvedValue(null);
    vi.mocked(kvGet).mockResolvedValue(null);
  }
}, 15000);
