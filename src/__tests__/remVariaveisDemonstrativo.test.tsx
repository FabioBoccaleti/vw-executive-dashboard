import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ColaboradorDemonstrativoPage } from '@/components/FolhaPagamentoDashboard/ColaboradorDemonstrativoPage';
import { buildLancamentoVazio, loadLancamento, saveLancamento, type Colaborador } from '@/components/FolhaPagamentoDashboard/remVariaveisStorage';
import { loadBaseGerencialDreSnapshot } from '@/components/BaseGerencialDashboard/baseGerencialDataProcessor';
import { loadDREDataAsync } from '@/lib/dbStorage';
import { kvGet } from '@/lib/kvClient';
import { toast } from 'sonner';

vi.mock('@/components/FolhaPagamentoDashboard/remVariaveisStorage', async original => ({
  ...await original<typeof import('@/components/FolhaPagamentoDashboard/remVariaveisStorage')>(),
  loadLancamento: vi.fn(),
  saveLancamento: vi.fn(),
}));
vi.mock('@/components/BaseGerencialDashboard/baseGerencialDataProcessor', () => ({
  loadBaseGerencialDreSnapshot: vi.fn(),
}));
vi.mock('@/lib/dbStorage', () => ({ loadDREDataAsync: vi.fn() }));
vi.mock('@/lib/kvClient', () => ({ kvGet: vi.fn() }));
vi.mock('@/components/VendasBonificacoesDashboard/provisaoPivSnapshotStorage', () => ({
  loadSnapshotStore: vi.fn().mockResolvedValue({ '2026-10': { totalSiq: 12000 } }),
}));
vi.mock('@/contexts/useAuth', () => ({ useAuth: () => ({ session: null }) }));
vi.mock('@/lib/authClient', () => ({ apiLogin: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const colaborador: Colaborador = {
  id: 'teste-variaveis', nome: 'Colaborador Teste', matricula: 'TESTE', brand: 'vw', ativo: true,
  itens: [{
    id: 'resultado', descricao: 'Participação no Resultado', tipo: 'variavel',
    baseCalculo: 'lucro_vd_direta', percentual: 1,
  }],
};
const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
function renderDemonstrativo(cadastro = colaborador, month = 11) {
  return render(<ColaboradorDemonstrativoPage colaborador={cadastro} isAdmin onBack={vi.fn()} initialYear={2026} initialMonth={month} />);
}
async function linhaResultado() {
  return (await screen.findByText('Participação no Resultado')).closest('tr')!;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadLancamento).mockResolvedValue(null);
  vi.mocked(loadDREDataAsync).mockResolvedValue(null);
  vi.mocked(kvGet).mockResolvedValue({ direta: { lucroLiquidoExercicio: '123' } });
  vi.mocked(loadBaseGerencialDreSnapshot).mockImplementation(async (_brand, _year, dept) => ({
    months: dept === 'vendaDireta' ? [{ month: 10, values: { lucroLiquidoExercicio: 123456.78 } }] : [],
  }));
});
afterEach(cleanup);

describe('base de cálculo exclusiva de Remunerações Variáveis', () => {
  it('usa a Base Gerencial em reais completos para o mês anterior, sem multiplicar valores truncados', async () => {
    renderDemonstrativo();
    const linha = await linhaResultado();
    expect(within(linha).getByText(brl(123456.78))).toBeInTheDocument();
    expect(within(linha).getByText(brl(1234.57))).toBeInTheDocument();
    expect(loadBaseGerencialDreSnapshot).toHaveBeenCalledWith('vw', 2026, 'vendaDireta');
    expect(kvGet).toHaveBeenCalledWith('resumo_dre:vw:2026-10');
    expect(saveLancamento).not.toHaveBeenCalled();
  });

  it('recalcula a base automática de um lançamento pendente já salvo', async () => {
    const lanc = buildLancamentoVazio(colaborador, 2026, 11);
    lanc.itens[0] = { ...lanc.itens[0], valorBaseCalculo: 123, percentualUsado: 1, valor: 1.23 };
    vi.mocked(loadLancamento).mockResolvedValue(lanc);
    renderDemonstrativo();
    expect(within(await linhaResultado()).getByText(brl(1234.57))).toBeInTheDocument();
    expect(saveLancamento).not.toHaveBeenCalled();
  });

  it.each([0, -2500])('respeita o resultado %s na Base Gerencial, sem substituí-lo pelo resumo positivo', async resultado => {
    vi.mocked(loadBaseGerencialDreSnapshot).mockResolvedValue({
      months: [{ month: 10, values: { lucroLiquidoExercicio: resultado } }],
    });
    renderDemonstrativo();
    const cells = within(await linhaResultado()).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('—');
    expect(cells[3]).toHaveTextContent('—');
  });

  it('preserva os valores e o cadastro congelados de demonstrativos pagos', async () => {
    const lanc = buildLancamentoVazio(colaborador, 2026, 11);
    lanc.status = 'pago';
    lanc.snapshotColaborador = { ...colaborador, nome: 'Snapshot Teste' };
    lanc.itens[0] = { ...lanc.itens[0], valorBaseCalculo: 87000, percentualUsado: 1, valor: 870 };
    vi.mocked(loadLancamento).mockResolvedValue(lanc);
    renderDemonstrativo();
    const linha = await linhaResultado();
    expect(within(linha).getByText(brl(87000))).toBeInTheDocument();
    expect(within(linha).getByText(brl(870))).toBeInTheDocument();
    expect(screen.getAllByText('Snapshot Teste')).not.toHaveLength(0);
    expect(loadBaseGerencialDreSnapshot).not.toHaveBeenCalled();
    expect(saveLancamento).not.toHaveBeenCalled();
  });

  it('mantém o fallback existente para resumo DRE se a Base Gerencial e o Executivo não têm dados', async () => {
    vi.mocked(loadBaseGerencialDreSnapshot).mockResolvedValue({ months: [] });
    vi.mocked(kvGet).mockResolvedValue({ direta: { lucroLiquidoExercicio: '98.765,43' } });
    renderDemonstrativo();
    const linha = await linhaResultado();
    expect(within(linha).getByText(brl(98765.43))).toBeInTheDocument();
    expect(within(linha).getByText(brl(987.65))).toBeInTheDocument();
  });

  it('mantém o fallback do Executivo, mas a Base Gerencial tem prioridade quando presente', async () => {
    vi.mocked(loadDREDataAsync).mockResolvedValue([{
      id: 'lucro', label: 'LUCRO LÍQUIDO DO EXERCÍCIO',
      values: Array.from({ length: 12 }, (_, i) => i === 9 ? 76543.21 : 0),
    }]);
    const { unmount } = renderDemonstrativo();
    expect(within(await linhaResultado()).getByText(brl(123456.78))).toBeInTheDocument();
    unmount();
    vi.mocked(loadBaseGerencialDreSnapshot).mockResolvedValue({ months: [] });
    renderDemonstrativo();
    expect(within(await linhaResultado()).getByText(brl(76543.21))).toBeInTheDocument();
  });

  it('mantém a regra do SIQ e as bases manuais sem substituí-las pelo resultado gerencial', async () => {
    const cadastro: Colaborador = {
      ...colaborador,
      itens: [
        { id: 'siq', descricao: 'Prêmio SIQ', tipo: 'variavel', baseCalculo: 'incentivo_siq', percentual: 1 },
        { id: 'manual', descricao: 'Base manual', tipo: 'variavel', percentual: 2 },
      ],
    };
    const lanc = buildLancamentoVazio(cadastro, 2026, 11);
    lanc.itens[1] = { ...lanc.itens[1], valorBaseCalculo: 5000, valor: 100 };
    vi.mocked(loadLancamento).mockResolvedValue(lanc);
    renderDemonstrativo(cadastro);
    const siq = (await screen.findByText('Prêmio SIQ')).closest('tr')!;
    expect(within(siq).getByText(brl(12000))).toBeInTheDocument();
    expect(within(siq).getByText(brl(120))).toBeInTheDocument();
    const manual = screen.getByText('Base manual').closest('tr')!;
    expect(within(manual).getByText(brl(5000))).toBeInTheDocument();
    expect(within(manual).getByText(brl(100))).toBeInTheDocument();
  });

  it('continua usando a base corrigida ao cancelar a edição de um lançamento antigo', async () => {
    const lanc = buildLancamentoVazio(colaborador, 2026, 11);
    lanc.itens[0] = { ...lanc.itens[0], valorBaseCalculo: 123, percentualUsado: 1, valor: 1.23 };
    vi.mocked(loadLancamento).mockResolvedValue(lanc);
    renderDemonstrativo();
    await linhaResultado();
    fireEvent.click(screen.getByRole('button', { name: 'Lançar valores' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(within(await linhaResultado()).getByText(brl(123456.78))).toBeInTheDocument();
    expect(within(await linhaResultado()).getByText(brl(1234.57))).toBeInTheDocument();
  });

  it('usa dezembro do ano anterior na competência de janeiro e respeita a marca', async () => {
    vi.mocked(loadBaseGerencialDreSnapshot).mockResolvedValue({
      months: [{ month: 12, values: { lucroLiquidoExercicio: 65432.1 } }],
    });
    renderDemonstrativo({ ...colaborador, brand: 'audi' }, 1);
    expect(within(await linhaResultado()).getByText(brl(65432.1))).toBeInTheDocument();
    expect(loadBaseGerencialDreSnapshot).toHaveBeenCalledWith('audi', 2025, 'vendaDireta');
    expect(kvGet).toHaveBeenCalledWith('resumo_dre:audi:2025-12');
  });

  it('mostra erro e impede pagamento se não conseguir carregar a Base Gerencial', async () => {
    vi.mocked(loadBaseGerencialDreSnapshot).mockRejectedValueOnce(new Error('Fonte indisponível'));
    renderDemonstrativo();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a base de cálculo.');
    expect(toast.error).toHaveBeenCalledWith('Não foi possível carregar a base de cálculo do demonstrativo.');
    expect(screen.queryByRole('button', { name: 'Marcar como pago' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir PDF' })).toBeDisabled();
    expect(saveLancamento).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(within(await linhaResultado()).getByText(brl(123456.78))).toBeInTheDocument();
  });
});
