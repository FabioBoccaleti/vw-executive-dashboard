import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { kvCompareAndSet, kvGet, kvKeys } from '@/lib/kvClient';
import { RegistroAnaliseVendasConsorcioDashboard } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio';
import { LancarVendaForm } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/LancarVendaForm';
import { VendasReceber } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/VendasReceber';
import {
  criarVendaConsorcio, loadVendasConsorcio, registrarRecebimentoConsorcio, resumoVenda, saveNovaVendaConsorcio,
  type DadosNovaVendaConsorcio,
} from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/vendasStorage';
import type { CadastroConsorcio } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/cadastroStorage';

const { records } = vi.hoisted(() => ({ records: new Map<string, unknown>() }));

vi.mock('@/lib/kvClient', () => ({
  kvGet: vi.fn(async (key: string) => structuredClone(records.get(key) ?? null)),
  kvKeys: vi.fn(async (pattern: string) => [...records.keys()].filter(key => key.startsWith(pattern.replace('*', '')))),
  kvCompareAndSet: vi.fn(async (key: string, value: { version: string }, expectedVersion: string | null) => {
    const current = records.get(key);
    const currentVersion = current && typeof current === 'object' && 'version' in current ? current.version : undefined;
    if (expectedVersion === null ? records.has(key) : currentVersion !== expectedVersion) throw new Error('Conflito de versão. Atualize as vendas.');
    records.set(key, structuredClone(value));
  }),
  kvSet: vi.fn(),
}));
vi.mock('@/contexts/useAuth', () => ({ useAuth: () => ({ isAdmin: () => true, canAccessVendasSub: () => true }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function cadastro(parcelas = 6): CadastroConsorcio {
  return {
    produtos: [{ id: 'produto', nome: 'Automovel', percentualSorana: '6%', parcelasSorana: parcelas }],
    cargos: [{ id: 'cargo', nome: 'Vendas' }],
    vendedores: [{ id: 'vendedor', nome: 'Vendedor teste', cargoId: 'cargo' }],
    regrasComissao: [{ id: 'regra', cargoId: 'cargo', produtoId: 'produto', base: 'valor_carta', pagamento: 'unica', percentual: '4' }],
    aliquotaImposto: '14,25%',
  };
}

function dados(): DadosNovaVendaConsorcio {
  return {
    id: 'venda-teste', dataVenda: '2026-11-18', cliente: 'Cliente teste', grupoCota: '123/456',
    valorCarta: 100000, produtoId: 'produto', vendedorId: 'vendedor',
  };
}

beforeEach(() => {
  records.clear();
  vi.clearAllMocks();
  records.set('consorcio_cadastros', cadastro());
});
afterEach(cleanup);

describe('persistência e contas a receber de consorcio', () => {
  it('congela o cadastro e distribui centavos restantes na última parcela da comissão bruta', async () => {
    const config = cadastro();
    const venda = criarVendaConsorcio({ ...dados(), valorCarta: 100000.17 }, config);
    config.produtos[0].nome = 'Alterado';
    config.produtos[0].percentualSorana = '99';
    config.aliquotaImposto = '99';
    expect(venda.produto.nome).toBe('Automovel');
    expect(venda.aliquotaImposto).toBe('14,25%');
    expect(venda.comissaoBrutaCentavos).toBe(600001);
    expect(venda.impostoCentavos).toBe(85500);
    expect(venda.comissaoLiquidaCentavos).toBe(514501);
    expect(venda.parcelas.map(item => item.valorCentavos)).toEqual([100000, 100000, 100000, 100000, 100000, 100001]);
    expect(venda.parcelas.reduce((sum, item) => sum + item.valorCentavos, 0)).toBe(venda.comissaoBrutaCentavos);
    await saveNovaVendaConsorcio(venda);
    expect(await loadVendasConsorcio()).toEqual([venda]);
    await expect(saveNovaVendaConsorcio(venda)).rejects.toThrow('Conflito');
  });

  it('mantém recebimentos parciais, impede excesso e torna uma repetição da mesma baixa idempotente', async () => {
    await saveNovaVendaConsorcio(criarVendaConsorcio(dados(), cadastro(1)));
    const recebimento = { id: 'baixa-1', data: '2026-11-18', valorCentavos: 200000 };
    const parcial = await registrarRecebimentoConsorcio('venda-teste', 1, recebimento);
    expect(resumoVenda(parcial)).toMatchObject({ recebidoCentavos: 200000, saldoCentavos: 400000, quitada: false });
    const repetida = await registrarRecebimentoConsorcio('venda-teste', 1, recebimento);
    expect(repetida).toEqual(parcial);
    await expect(registrarRecebimentoConsorcio('venda-teste', 1, { ...recebimento, id: 'excesso', valorCentavos: 400001 })).rejects.toThrow('não pode ultrapassar');
    const quitada = await registrarRecebimentoConsorcio('venda-teste', 1, { ...recebimento, id: 'baixa-2', valorCentavos: 400000 });
    expect(resumoVenda(quitada)).toMatchObject({ recebidoCentavos: 600000, saldoCentavos: 0, quitada: true });
    expect(quitada.parcelas[0].recebimentos).toHaveLength(2);
  });

  it('rejeita baixas concorrentes em vez de sobrescrever recebimentos', async () => {
    await saveNovaVendaConsorcio(criarVendaConsorcio(dados(), cadastro(1)));
    const results = await Promise.allSettled(['a', 'b'].map(id =>
      registrarRecebimentoConsorcio('venda-teste', 1, { id, data: '2026-11-18', valorCentavos: 400000 })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const [persistida] = await loadVendasConsorcio();
    expect(resumoVenda(persistida).recebidoCentavos).toBe(400000);
    expect(persistida.parcelas[0].recebimentos).toHaveLength(1);
  });

  it.each([0, -1, 1.5, 600001])('rejeita valor de recebimento inválido em centavos: %s', async valorCentavos => {
    await saveNovaVendaConsorcio(criarVendaConsorcio(dados(), cadastro(1)));
    await expect(registrarRecebimentoConsorcio('venda-teste', 1, { id: 'baixa', data: '2026-11-18', valorCentavos })).rejects.toThrow();
    expect(resumoVenda((await loadVendasConsorcio())[0]).recebidoCentavos).toBe(0);
  });

  it('não exibe uma lista vazia ou informa sucesso quando o armazenamento falha', async () => {
    vi.mocked(kvKeys).mockRejectedValueOnce(new Error('Rede indisponivel'));
    render(<VendasReceber situacao="a_receber" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Rede indisponivel');
    expect(screen.queryByText('Nenhuma venda a receber.')).not.toBeInTheDocument();
    cleanup();
    vi.mocked(kvCompareAndSet).mockRejectedValueOnce(new Error('Falha ao salvar'));
    render(<LancarVendaForm onOpenCadastros={vi.fn()} />);
    await preencherVenda();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar venda' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao salvar');
    expect(screen.getByRole('textbox', { name: 'Cliente *' })).toHaveValue('Cliente teste');
    expect([...records.keys()].filter(key => key.startsWith('consorcio_venda_'))).toHaveLength(0);
  });

  it('exibe cada parcela em Recebida desde a primeira baixa e mantém a venda em A Receber enquanto houver saldo', async () => {
    records.set('consorcio_cadastros', cadastro(2));
    const view = render(<RegistroAnaliseVendasConsorcioDashboard onChangeBrand={vi.fn()} onOpenCadastros={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lançar Vendas' }));
    await preencherVenda();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar venda' }));
    await screen.findByText('Cliente teste');
    expect(screen.queryByText(/remuneração do vendedor/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Parcelas de Cliente teste' }));
    expect(screen.queryByRole('columnheader', { name: /vencimento/i })).not.toBeInTheDocument();

    await receber('400,00');
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText('Histórico:', { exact: false })).toHaveTextContent('R$ 400,00');
    fireEvent.click(screen.getByRole('button', { name: /^Recebida$/ }));
    const recebidas = within(screen.getByRole('table', { name: 'Parcelas com recebimentos' }));
    expect(recebidas.getAllByRole('row')).toHaveLength(2);
    const parcial = within(recebidas.getAllByRole('row')[1]);
    expect(parcial.getByText('Cliente teste')).toBeInTheDocument();
    expect(parcial.getByText('123/456')).toBeInTheDocument();
    expect(parcial.getByText('1/2')).toBeInTheDocument();
    expect(parcial.queryByText('2/2')).not.toBeInTheDocument();
    expect(parcial.getByText('Parcial')).toBeInTheDocument();
    expect(parcial.getByText('R$ 400,00', { exact: true })).toBeInTheDocument();
    expect(parcial.getByText('R$ 2.600,00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'A Receber' }));
    await receber('2.600,00');
    expect(screen.getByText('Cliente teste')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Recebida$/ }));
    const quitadas = within(screen.getByRole('table', { name: 'Parcelas com recebimentos' }));
    expect(quitadas.getAllByRole('row')).toHaveLength(2);
    const primeira = within(quitadas.getAllByRole('row')[1]);
    expect(primeira.getByText('Recebida', { exact: true })).toBeInTheDocument();
    expect(primeira.getByText('R$ 0,00')).toBeInTheDocument();
    expect(primeira.getByText('18/11/2026 — R$ 400,00')).toBeInTheDocument();
    expect(primeira.getByText('18/11/2026 — R$ 2.600,00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'A Receber' }));
    await receber('3.000,00');
    expect(await screen.findByText('Nenhuma venda a receber.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Recebida$/ }));
    expect(await screen.findAllByText('Cliente teste')).toHaveLength(2);
    expect(within(screen.getByRole('table', { name: 'Parcelas com recebimentos' })).getAllByRole('row')).toHaveLength(3);
    expect((await loadVendasConsorcio())[0].parcelas.flatMap(item => item.recebimentos)).toHaveLength(3);

    view.unmount();
    records.set('consorcio_cadastros', cadastro(10));
    render(<RegistroAnaliseVendasConsorcioDashboard onChangeBrand={vi.fn()} onOpenCadastros={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Vendas$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Recebida$/ }));
    expect(await screen.findAllByText('Cliente teste')).toHaveLength(2);
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(kvGet).toHaveBeenCalledWith(expect.stringContaining('consorcio_venda_'), { throwOnError: true });
  });

  it('não lista parcelas sem recebimentos na aba Recebida', async () => {
    await saveNovaVendaConsorcio(criarVendaConsorcio(dados(), cadastro()));
    render(<VendasReceber situacao="recebida" />);
    expect(await screen.findByText('Nenhuma parcela com recebimento.')).toBeInTheDocument();
    expect(screen.queryByText('Cliente teste')).not.toBeInTheDocument();
  });
});

async function preencherVenda() {
  fireEvent.change(await screen.findByRole('combobox', { name: 'Produto / tipo de carta *' }), { target: { value: 'produto' } });
  fireEvent.change(screen.getByRole('combobox', { name: /Vendedor/ }), { target: { value: 'vendedor' } });
  fireEvent.change(screen.getByLabelText('Data da venda *'), { target: { value: '2026-11-18' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Cliente *' }), { target: { value: 'Cliente teste' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Grupo / cota *' }), { target: { value: '123/456' } });
  fireEvent.change(screen.getByRole('textbox', { name: /Valor da carta de crédito/ }), { target: { value: '100.000,00' } });
}

async function receber(valor: string) {
  fireEvent.click(screen.getAllByRole('button', { name: 'Registrar recebimento' })[0]);
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.change(dialog.getByRole('textbox', { name: 'Valor recebido (R$)' }), { target: { value: valor } });
  fireEvent.change(dialog.getByLabelText('Data do recebimento'), { target: { value: '2026-11-18' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Confirmar recebimento' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}
