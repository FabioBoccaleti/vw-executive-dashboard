import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConsorcioCadastros } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/ConsorcioCadastros';
import { LancarVendaForm } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/LancarVendaForm';
import { calcularComissaoVendedor, validarCronograma } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/comissaoVendedor';
import { loadCadastroConsorcio, saveCadastroConsorcio, type CadastroConsorcio, type ProdutoConsorcio, type RegraComissaoConsorcio } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/cadastroStorage';
import { toast } from 'sonner';

vi.mock('@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/cadastroStorage', async importOriginal => ({
  ...await importOriginal<typeof import('@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/cadastroStorage')>(),
  loadCadastroConsorcio: vi.fn(),
  saveCadastroConsorcio: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const produto: ProdutoConsorcio = { id: 'produto', nome: 'Automovel', percentualSorana: '6%', parcelasSorana: 6 };
const regra: RegraComissaoConsorcio = {
  id: 'regra', cargoId: 'cargo', produtoId: produto.id, percentual: '0',
  base: 'valor_carta', pagamento: 'cronograma', percentuaisParcelas: ['1', '1%', '1', '1', '0', '0'],
};

function cadastro(regrasComissao: RegraComissaoConsorcio[] = [regra]): CadastroConsorcio {
  return {
    produtos: [produto],
    cargos: [{ id: 'cargo', nome: 'Vendas' }],
    vendedores: [{ id: 'vendedor', nome: 'Vendedor teste', cargoId: 'cargo' }],
    regrasComissao,
    aliquotaImposto: '14,25%',
  };
}

describe('cronograma de comissao do consorcio', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(loadCadastroConsorcio).mockResolvedValue(cadastro());
    vi.mocked(saveCadastroConsorcio).mockResolvedValue(true);
  });

  it('pays 1% of the letter only on the first four installments', () => {
    expect(calcularComissaoVendedor(regra, produto, 100000, 14.25)).toEqual({
      total: 4000, parcelas: [1000, 1000, 1000, 1000, 0, 0],
    });
  });

  it.each([
    ['bruta', [100, 0, 205, 0, 0, 0], 305],
    ['liquida', [85.75, 0, 175.7875, 0, 0, 0], 261.5375],
  ] as const)('uses the corresponding %s installment and accepts variable rates and gaps', (base, parcelas, total) => {
    const result = calcularComissaoVendedor({
      ...regra, base, percentuaisParcelas: ['10', '0', '20,5%', '0', '0', '0'],
    }, produto, 100000, 14.25);
    result.parcelas.forEach((value, index) => expect(value).toBeCloseTo(parcelas[index], 8));
    expect(result.total).toBeCloseTo(total, 8);
  });

  it.each(['unica', 'por_parcela'] as const)('preserves the existing %s mode without a schedule', pagamento => {
    const { percentuaisParcelas: _, ...legada } = regra;
    const result = calcularComissaoVendedor({ ...legada, pagamento, percentual: '4' }, produto, 100000, 14.25);
    expect(result.total).toBe(4000);
    expect(result.parcelas[0]).toBeCloseTo(pagamento === 'unica' ? 4000 : 4000 / 6);
    expect(result.parcelas[5]).toBeCloseTo(pagamento === 'unica' ? 0 : 4000 / 6);
  });

  it.each([
    undefined, ['1'], ['1', '1', '1', '1', '0', '0', '1'],
    ['', '1', '1', '1', '0', '0'], ['-1', '1', '1', '1', '0', '0'],
    ['101', '1', '1', '1', '0', '0'], ['abc', '1', '1', '1', '0', '0'],
  ].map(percentuaisParcelas => ({ percentuaisParcelas })))('rejects incomplete or invalid schedules ($percentuaisParcelas)', ({ percentuaisParcelas }) => {
    const invalid = { ...regra, percentuaisParcelas };
    expect(validarCronograma(invalid, 6)).not.toBeNull();
    expect(() => calcularComissaoVendedor(invalid, produto, 100000, 14.25)).toThrow();
  });

  it('creates, saves and reloads a schedule, then displays its total and installments in the sale form', async () => {
    vi.mocked(loadCadastroConsorcio).mockResolvedValue(cadastro([]));
    const view = render(<ConsorcioCadastros />);
    await screen.findByText('Comissão do vendedor por cargo e produto');
    let selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'cargo' } });
    fireEvent.change(selects[2], { target: { value: 'produto' } });
    fireEvent.change(selects[3], { target: { value: 'valor_carta' } });
    fireEvent.change(selects[4], { target: { value: 'cronograma' } });
    for (let parcela = 1; parcela <= 4; parcela++) {
      fireEvent.change(screen.getByLabelText(`${parcela}ª parcela (%)`), { target: { value: '1' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar regra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(saveCadastroConsorcio).toHaveBeenCalledOnce());
    const saved = vi.mocked(saveCadastroConsorcio).mock.calls[0][0];
    expect(saved.regrasComissao[0]).toMatchObject({
      pagamento: 'cronograma', base: 'valor_carta', percentuaisParcelas: ['1', '1', '1', '1', '0', '0'],
    });
    view.unmount();
    vi.mocked(loadCadastroConsorcio).mockResolvedValue(saved);
    const reloaded = render(<ConsorcioCadastros />);
    await screen.findByText('1ª: 1%');
    fireEvent.click(within(screen.getAllByRole('table')[1]).getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getAllByLabelText('2ª parcela (%)')[0], { target: { value: '0,5' } });
    fireEvent.click(within(screen.getAllByRole('table')[1]).getByRole('button', { name: /^Salvar$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(saveCadastroConsorcio).toHaveBeenCalledTimes(2));
    const updated = vi.mocked(saveCadastroConsorcio).mock.calls[1][0];
    expect(updated.regrasComissao[0].percentuaisParcelas).toEqual(['1', '0,5', '1', '1', '0', '0']);
    reloaded.unmount();
    vi.mocked(loadCadastroConsorcio).mockResolvedValue(updated);
    render(<LancarVendaForm onOpenCadastros={vi.fn()} />);
    await screen.findByRole('combobox', { name: 'Produto / tipo de carta *' });
    selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'produto' } });
    fireEvent.change(selects[1], { target: { value: 'vendedor' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100000' } });
    expect(screen.getByRole('textbox', { name: /Valor total da remuneração/ })).toHaveValue((3500).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(7);
    expect(rows[5]).toHaveTextContent('R$ 0,00');
    expect(rows[6]).toHaveTextContent('R$ 0,00');
    expect(screen.getByRole('button', { name: 'Registrar venda' })).toBeDisabled();
  });

  it('prevents dropping commissioned installments and adds zero-rate installments when the product grows', async () => {
    render(<ConsorcioCadastros />);
    await screen.findByText('Comissão do vendedor por cargo e produto');
    const table = within(screen.getAllByRole('table')[0]);
    fireEvent.click(table.getByRole('button', { name: 'Editar' }));
    fireEvent.change(table.getByRole('combobox'), { target: { value: '3' } });
    fireEvent.click(table.getByRole('button', { name: /^Salvar$/ }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Existem comissões nas parcelas'));
    fireEvent.change(table.getByRole('combobox'), { target: { value: '7' } });
    fireEvent.click(table.getByRole('button', { name: /^Salvar$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(saveCadastroConsorcio).toHaveBeenCalledOnce());
    expect(vi.mocked(saveCadastroConsorcio).mock.calls[0][0].regrasComissao[0].percentuaisParcelas).toEqual(['1', '1%', '1', '1', '0', '0', '0']);
  });
});
