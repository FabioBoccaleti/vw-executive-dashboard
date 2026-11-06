import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { kvKeys } from '@/lib/kvClient';
import { getBaseGerencialMes } from '@/components/BaseGerencialDashboard/baseGerencialStorage';
import { BaseGerencialDashboard } from '@/components/BaseGerencialDashboard';
import { CustoFixoPinheirosTab } from '@/components/BaseGerencialDashboard/CustoFixoPinheirosTab';
import {
  processCustoFixoPinheirosData,
  type CustoFixoPinheirosData,
} from '@/components/BaseGerencialDashboard/baseGerencialDataProcessor';

vi.mock('@/lib/kvClient', () => ({ kvKeys: vi.fn().mockResolvedValue([]) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));
vi.mock('@/components/BaseGerencialDashboard/baseGerencialStorage', async importOriginal => ({
  ...await importOriginal<typeof import('@/components/BaseGerencialDashboard/baseGerencialStorage')>(),
  getBaseGerencialMes: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/components/BaseGerencialDashboard/baseGerencialDataProcessor', () => ({
  processCustoFixoPinheirosData: vi.fn(),
}));
vi.mock('@/components/BaseGerencialDashboard/DepartamentoTab', () => ({
  DepartamentoTab: ({ marca, departamento }: { marca: string; departamento: string }) =>
    <div>{marca}: {departamento}</div>,
}));
vi.mock('@/components/BaseGerencialDashboard/BaseGerencialDreTab', () => ({
  BaseGerencialDreTab: () => <div>DRE existente</div>,
}));
vi.mock('@/components/BaseGerencialDashboard/AnaliseCenariosTab', () => ({ AnaliseCenariosTab: () => null }));
vi.mock('@/components/BaseGerencialDashboard/ComparativoTab', () => ({ ComparativoTab: () => null }));

const dados: CustoFixoPinheirosData = {
  total: -350,
  grupos: [{
    tipo: 'despesas_pessoal', subtotal: -350,
    contas: [
      {
        conta: '51101 - SALARIOS', valor: -300,
        departamentos: [
          { departamento: 'Oficina', valor: -100 },
          { departamento: 'Veículos Novos', valor: -200 },
        ],
      },
      { conta: '51102 - FERIAS', valor: -50, departamentos: [{ departamento: 'Administração', valor: -50 }] },
    ],
  }],
};

beforeEach(() => {
  vi.mocked(kvKeys).mockReset().mockResolvedValue([]);
  vi.mocked(getBaseGerencialMes).mockReset().mockResolvedValue(null);
  vi.mocked(processCustoFixoPinheirosData).mockReset().mockResolvedValue(dados);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Custo Fixo Pinheiros — interface', () => {
  it('inicia oculta, aparece após DRE somente na Audi e volta oculta em um novo acesso', async () => {
    const { unmount } = render(<BaseGerencialDashboard onChangeBrand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Audi' }));
    expect(screen.queryByRole('button', { name: 'Custo Fixo Pinheiros' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar Custo Fixo Pinheiros' }));
    const tab = screen.getByRole('button', { name: 'Custo Fixo Pinheiros' });
    expect(tab.previousElementSibling).toHaveTextContent('DRE');
    await screen.findByText('Total das Despesas');
    fireEvent.click(screen.getByRole('button', { name: 'VW' }));
    expect(screen.queryByRole('button', { name: /Custo Fixo Pinheiros/ })).not.toBeInTheDocument();
    expect(screen.getByText('vw: veiculos_novos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Audi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Custo Fixo Pinheiros' }));
    expect(screen.queryByRole('button', { name: 'Custo Fixo Pinheiros' })).not.toBeInTheDocument();
    expect(screen.getByText('DRE existente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar Custo Fixo Pinheiros' }));
    await screen.findByText('Total das Despesas');
    unmount();
    render(<BaseGerencialDashboard onChangeBrand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Audi' }));
    expect(screen.queryByRole('button', { name: 'Custo Fixo Pinheiros' })).not.toBeInTheDocument();
  });

  it('sem importações usa o mês atual e permite selecionar outro período', async () => {
    render(<BaseGerencialDashboard onChangeBrand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Audi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar Custo Fixo Pinheiros' }));
    await screen.findByText('Total das Despesas');
    expect(processCustoFixoPinheirosData).toHaveBeenLastCalledWith(new Date().getFullYear(), new Date().getMonth() + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    await screen.findByText(`Setembro / ${new Date().getFullYear()}`);
    expect(processCustoFixoPinheirosData).toHaveBeenLastCalledWith(new Date().getFullYear(), 9);
    fireEvent.click(screen.getByRole('button', { name: '‹' }));
    await screen.findByText(`Setembro / ${new Date().getFullYear() - 1}`);
    expect(processCustoFixoPinheirosData).toHaveBeenLastCalledWith(new Date().getFullYear() - 1, 9);
  });

  it('abre no último mês importado válido, inclusive de outro ano, ignorando chaves removidas ou vazias', async () => {
    vi.mocked(kvKeys).mockResolvedValue([
      'basege:2024:M12', 'basege:2025:M09', 'basege:2025:M08',
      'basege:2026:M01', 'basege:2025:M10', 'basege:2027:M13', 'basege:dre-cache:audi:2026',
    ]);
    vi.mocked(getBaseGerencialMes).mockImplementation(async (year, mes) =>
      year === 2025 && mes === 9
        ? { rows: [{ conta: '51101 - SALARIOS', isMain: true, saldoAnterior: 0, valDebito: 100, valCredito: 0, saldoPeriodo: -100, saldoAtual: -100 }], totalRow: null, importedAt: '', fileName: 'teste.txt' }
        : year === 2025 && mes === 10
          ? { rows: [], totalRow: null, importedAt: '', fileName: 'vazio.txt' }
          : null
    );
    render(<BaseGerencialDashboard onChangeBrand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Audi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar Custo Fixo Pinheiros' }));
    await screen.findByText('Setembro / 2025');
    expect(processCustoFixoPinheirosData).toHaveBeenCalledExactlyOnceWith(2025, 9);
    fireEvent.click(screen.getByRole('button', { name: 'Ago' }));
    await screen.findByText('Agosto / 2025');
    fireEvent.click(screen.getByRole('button', { name: 'Veículos Novos' }));
    expect(screen.getByRole('button', { name: 'Ano todo' })).toHaveClass('bg-slate-700');
    expect(screen.getByText(String(new Date().getFullYear()))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Custo Fixo Pinheiros' }));
    await screen.findByText('Setembro / 2025');
    expect(processCustoFixoPinheirosData).toHaveBeenLastCalledWith(2025, 9);
    fireEvent.click(screen.getByRole('button', { name: 'Ano todo' }));
    await screen.findByText('Ano 2025 (todo)');
    fireEvent.click(screen.getByRole('button', { name: 'VW' }));
    fireEvent.click(screen.getByRole('button', { name: 'Audi' }));
    await screen.findByText('Setembro / 2025');
    expect(processCustoFixoPinheirosData).toHaveBeenLastCalledWith(2025, 9);
  });

  it('aguarda a busca do último mês e exibe erro explícito se ela falhar', async () => {
    render(<BaseGerencialDashboard onChangeBrand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Audi' }));
    const erro = new Error('Falha ao listar meses');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let rejeitar: (error: Error) => void = () => {};
    vi.mocked(kvKeys).mockReturnValueOnce(new Promise((_, reject) => { rejeitar = reject; }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar Custo Fixo Pinheiros' }));
    expect(screen.getByRole('status', { name: 'Buscando mês mais recente com dados' })).toBeInTheDocument();
    expect(processCustoFixoPinheirosData).not.toHaveBeenCalled();
    await act(async () => { rejeitar(erro); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro ao buscar o mês mais recente');
    expect(processCustoFixoPinheirosData).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Erro ao buscar último período de Custo Fixo Pinheiros:', erro);
  });

  it('expande apenas contas com vários departamentos e mostra o departamento único sem expansão', async () => {
    const { container } = render(<CustoFixoPinheirosTab year={2026} mes={9} />);
    await screen.findByText('Total das Despesas');
    const detalhes = container.querySelectorAll('details');
    expect(detalhes).toHaveLength(1);
    expect(detalhes[0]).not.toHaveAttribute('open');
    fireEvent.click(within(detalhes[0]).getByText(/51101 - SALARIOS/));
    expect(detalhes[0]).toHaveAttribute('open');
    expect(within(detalhes[0]).getByText('Oficina')).toBeInTheDocument();
    expect(within(detalhes[0]).getByText('Veículos Novos')).toBeInTheDocument();
    expect(within(detalhes[0]).getByText(/100,00/)).toBeInTheDocument();
    expect(within(detalhes[0]).getByText(/200,00/)).toBeInTheDocument();
    expect(screen.getByText('Administração')).toBeInTheDocument();
    fireEvent.click(within(detalhes[0]).getByText(/51101 - SALARIOS/));
    expect(detalhes[0]).not.toHaveAttribute('open');
  });

  it('mostra estado vazio e erro explícito, sem apresentar totais em caso de falha', async () => {
    vi.mocked(processCustoFixoPinheirosData).mockResolvedValueOnce({ grupos: [], total: 0 });
    const { unmount } = render(<CustoFixoPinheirosTab year={2026} mes={9} />);
    await screen.findByText('Nenhuma despesa encontrada');
    unmount();
    const erro = new Error('Falha de leitura');
    vi.mocked(processCustoFixoPinheirosData).mockRejectedValueOnce(erro);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CustoFixoPinheirosTab year={2026} mes={9} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro ao carregar Custo Fixo Pinheiros');
    expect(screen.queryByText('Total das Despesas')).not.toBeInTheDocument();
    expect(log).toHaveBeenCalledWith('Erro ao carregar Custo Fixo Pinheiros:', erro);
    expect(toast.error).toHaveBeenCalled();
  });

  it('ignora respostas de um período anterior que terminam depois da seleção atual', async () => {
    let concluirAnterior: (value: CustoFixoPinheirosData) => void = () => {};
    vi.mocked(processCustoFixoPinheirosData).mockReturnValueOnce(
      new Promise(resolve => { concluirAnterior = resolve; })
    );
    const { rerender } = render(<CustoFixoPinheirosTab year={2026} mes={8} />);
    rerender(<CustoFixoPinheirosTab year={2026} mes={9} />);
    await screen.findByText('Total das Despesas');
    await act(async () => { concluirAnterior({ grupos: [], total: 0 }); });
    expect(screen.getByText('51102 - FERIAS')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma despesa encontrada')).not.toBeInTheDocument();
  });
});
