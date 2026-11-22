import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { kvCompareAndSet, kvGet, kvKeys } from '@/lib/kvClient';
import { RegistroAnaliseVendasConsorcioDashboard } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio';
import { LancarVendaForm } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/LancarVendaForm';
import { VendasReceber } from '@/components/VendasBonificacoesDashboard/RegistroAnaliseVendasConsorcio/VendasReceber';
import {
  criarVendaConsorcio, estornarRecebimentoConsorcio, loadVendasConsorcio, registrarRecebimentoConsorcio, resumoVenda, saveNovaVendaConsorcio,
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
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('persistência e contas a receber de consorcio', () => {
  it('identifica os valores e rentabilidades das parcelas nos cabeçalhos da tabela', () => {
    render(<RegistroAnaliseVendasConsorcioDashboard onChangeBrand={vi.fn()} onOpenCadastros={vi.fn()} />);
    for (const nome of [
      'Valor da Parcela de Comissão de Venda Bruta',
      '% Rentabilidade Bruta da Parcela',
      'Impostos s/ a Parcela da Comissão',
      'Total da Parcela da Comissão Líquida',
      '% Rentabilidade Líquida da Parcela',
    ]) {
      expect(screen.getByRole('columnheader', { name: nome })).toBeInTheDocument();
    }
  });

  it('lista cada recebimento com seus dados na tabela e remove apenas o estornado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ ok: true }) }));
    const venda = criarVendaConsorcio(dados(), cadastro(2));
    venda.parcelas[0].recebimentos.push(
      { id: 'antigo', data: '2026-11-17', valorCentavos: 10000 },
      { id: 'novo', data: '2026-11-19', valorCentavos: 20000, numeroBordero: '001-A' },
    );
    await saveNovaVendaConsorcio(venda);
    await saveNovaVendaConsorcio(criarVendaConsorcio({ ...dados(), id: 'sem-recebimento', cliente: 'Sem baixa' }, cadastro(1)));
    const cadastroAtualizado = cadastro();
    cadastroAtualizado.produtos[0].percentualSorana = '9';
    cadastroAtualizado.aliquotaImposto = '99';
    records.set('consorcio_cadastros', cadastroAtualizado);
    render(<RegistroAnaliseVendasConsorcioDashboard onChangeBrand={vi.fn()} onOpenCadastros={vi.fn()} />);
    await screen.findByText('001-A');
    let tabela = within(screen.getByRole('table'));
    expect(tabela.getAllByRole('columnheader').slice(0, 5).map(item => item.textContent)).toEqual([
      '#', 'Data da Venda', 'Data do Borderô', 'Número do Borderô', 'Produto',
    ]);
    let linhas = tabela.getAllByRole('row').slice(2);
    expect(linhas).toHaveLength(2);
    const valores = (linha: HTMLElement) => within(linha).getAllByRole('cell').map(cell => (cell.textContent ?? '').replace(/\s/g, ' '));
    expect(tabela.getByRole('columnheader', { name: '% Total da Comissão s/ Venda' })).toBeInTheDocument();
    expect(valores(linhas[0])).toEqual(['1', '18/11/2026', '17/11/2026', '', 'Automovel', '2', '1', '123/456', 'Cliente teste', 'R$ 100.000,00', '6%', 'R$ 100,00', '0,10%', 'R$ 14,25', 'R$ 85,75', '0,09%']);
    expect(valores(linhas[1])).toEqual(['2', '18/11/2026', '19/11/2026', '001-A', 'Automovel', '2', '1', '123/456', 'Cliente teste', 'R$ 100.000,00', '6%', 'R$ 200,00', '0,20%', 'R$ 28,50', 'R$ 171,50', '0,17%']);
    expect(screen.queryByText('Sem baixa')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Vendas$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Recebida$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Estornar recebimento.*19\/11\/2026/ }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Senha de estorno'), { target: { value: 'senha-teste' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Confirmar estorno' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Tabela$/ }));
    await screen.findByText('17/11/2026');
    tabela = within(screen.getByRole('table'));
    linhas = tabela.getAllByRole('row').slice(2);
    expect(linhas).toHaveLength(1);
    expect(valores(linhas[0])[11]).toBe('R$ 100,00');
    expect(tabela.queryByText('001-A')).not.toBeInTheDocument();
  });

  it('calcula rentabilidades e imposto sobre cada baixa, arredondando imposto em centavos', async () => {
    const config = cadastro();
    const venda = criarVendaConsorcio({ ...dados(), valorCarta: 250000 }, config);
    venda.parcelas[0].recebimentos.push({ id: 'principal', data: '2026-11-18', valorCentavos: 250000, numeroBordero: 'principal' });
    const configTaxa = cadastro(1);
    configTaxa.aliquotaImposto = '10%';
    const vendaCentavos = criarVendaConsorcio({ ...dados(), id: 'centavos', cliente: 'Centavos' }, configTaxa);
    vendaCentavos.parcelas[0].recebimentos.push({ id: 'fracao', data: '2026-11-18', valorCentavos: 5, numeroBordero: 'fracao' });
    await saveNovaVendaConsorcio(venda);
    await saveNovaVendaConsorcio(vendaCentavos);
    render(<RegistroAnaliseVendasConsorcioDashboard onChangeBrand={vi.fn()} onOpenCadastros={vi.fn()} />);
    await screen.findByText('principal');
    const principal = within(screen.getByRole('row', { name: /principal/ }));
    expect(principal.getAllByRole('cell').slice(12).map(cell => (cell.textContent ?? '').replace(/\s/g, ' ')))
      .toEqual(['1,00%', 'R$ 356,25', 'R$ 2.143,75', '0,86%']);
    const fracao = within(screen.getByRole('row', { name: /fracao/ }));
    expect(fracao.getAllByRole('cell').slice(12).map(cell => (cell.textContent ?? '').replace(/\s/g, ' ')))
      .toEqual(['0,00%', 'R$ 0,01', 'R$ 0,04', '0,00%']);
  });

  it('informa erro ao calcular recebimento com alíquota histórica inválida', async () => {
    const venda = criarVendaConsorcio(dados(), cadastro(1));
    venda.aliquotaImposto = '';
    venda.parcelas[0].recebimentos.push({ id: 'baixa', data: '2026-11-18', valorCentavos: 10000 });
    await saveNovaVendaConsorcio(venda);
    render(<RegistroAnaliseVendasConsorcioDashboard onChangeBrand={vi.fn()} onOpenCadastros={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Alíquota de imposto inválida');
    expect(screen.queryByText('Nenhum registro cadastrado')).not.toBeInTheDocument();
  });

  it.each(['6,25', '6,25%'])('mostra o percentual cadastrado %s com símbolo de porcentagem', async percentual => {
    const config = cadastro(1);
    config.produtos[0].percentualSorana = percentual;
    const venda = criarVendaConsorcio(dados(), config);
    venda.parcelas[0].recebimentos.push({ id: 'antigo', data: '2026-11-17', valorCentavos: 10000 });
    await saveNovaVendaConsorcio(venda);
    render(<RegistroAnaliseVendasConsorcioDashboard onChangeBrand={vi.fn()} onOpenCadastros={vi.fn()} />);
    expect(await screen.findByText('6,25%')).toBeInTheDocument();
  });

  it('informa falha de carregamento da tabela e permite tentar novamente', async () => {
    vi.mocked(kvKeys).mockRejectedValueOnce(new Error('Rede indisponível'));
    render(<RegistroAnaliseVendasConsorcioDashboard onChangeBrand={vi.fn()} onOpenCadastros={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Rede indisponível');
    expect(screen.queryByText('Nenhum registro cadastrado')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByText('Nenhum registro cadastrado')).toBeInTheDocument();
  });

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
    const recebimento = { id: 'baixa-1', data: '2026-11-18', valorCentavos: 200000, numeroBordero: ' 001-A ' };
    const parcial = await registrarRecebimentoConsorcio('venda-teste', 1, recebimento);
    expect(resumoVenda(parcial)).toMatchObject({ recebidoCentavos: 200000, saldoCentavos: 400000, quitada: false });
    expect(parcial.parcelas[0].recebimentos[0].numeroBordero).toBe('001-A');
    const repetida = await registrarRecebimentoConsorcio('venda-teste', 1, recebimento);
    expect(repetida).toEqual(parcial);
    await expect(registrarRecebimentoConsorcio('venda-teste', 1, { ...recebimento, numeroBordero: 'outro' })).rejects.toThrow('outros dados');
    await expect(registrarRecebimentoConsorcio('venda-teste', 1, { ...recebimento, id: 'excesso', valorCentavos: 400001 })).rejects.toThrow('não pode ultrapassar');
    const quitada = await registrarRecebimentoConsorcio('venda-teste', 1, { ...recebimento, id: 'baixa-2', valorCentavos: 400000 });
    expect(resumoVenda(quitada)).toMatchObject({ recebidoCentavos: 600000, saldoCentavos: 0, quitada: true });
    expect(quitada.parcelas[0].recebimentos).toHaveLength(2);
  });

  it('rejeita baixas concorrentes em vez de sobrescrever recebimentos', async () => {
    await saveNovaVendaConsorcio(criarVendaConsorcio(dados(), cadastro(1)));
    const results = await Promise.allSettled(['a', 'b'].map(id =>
      registrarRecebimentoConsorcio('venda-teste', 1, { id, data: '2026-11-18', valorCentavos: 400000, numeroBordero: '123' })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const [persistida] = await loadVendasConsorcio();
    expect(resumoVenda(persistida).recebidoCentavos).toBe(400000);
    expect(persistida.parcelas[0].recebimentos).toHaveLength(1);
  });

  it.each([0, -1, 1.5, 600001])('rejeita valor de recebimento inválido em centavos: %s', async valorCentavos => {
    await saveNovaVendaConsorcio(criarVendaConsorcio(dados(), cadastro(1)));
    await expect(registrarRecebimentoConsorcio('venda-teste', 1, { id: 'baixa', data: '2026-11-18', valorCentavos, numeroBordero: '123' })).rejects.toThrow();
    expect(resumoVenda((await loadVendasConsorcio())[0]).recebidoCentavos).toBe(0);
  });

  it('rejeita borderô vazio e mantém recebimentos antigos sem borderô', async () => {
    const venda = criarVendaConsorcio(dados(), cadastro(1));
    venda.parcelas[0].recebimentos.push({ id: 'antigo', data: '2026-11-17', valorCentavos: 10000 });
    await saveNovaVendaConsorcio(venda);
    await expect(registrarRecebimentoConsorcio('venda-teste', 1, {
      id: 'novo', data: '2026-11-18', valorCentavos: 10000, numeroBordero: '   ',
    })).rejects.toThrow('Informe o número do borderô');
    render(<VendasReceber situacao="recebida" />);
    expect(await screen.findByText('17/11/2026 — R$ 100,00')).toBeInTheDocument();
    expect((await loadVendasConsorcio())[0].parcelas[0].recebimentos).toHaveLength(1);
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar recebimento' })[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar recebimento' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o número do borderô');
    expect((await loadVendasConsorcio())[0].parcelas[0].recebimentos).toHaveLength(0);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    await receber('400,00', '001-A');
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText('Histórico:', { exact: false })).toHaveTextContent('R$ 400,00');
    expect(screen.getByText('Histórico:', { exact: false })).toHaveTextContent('Borderô: 001-A');
    fireEvent.click(screen.getByRole('button', { name: /^Recebida$/ }));
    const recebidas = within(screen.getByRole('table', { name: 'Parcelas com recebimentos' }));
    expect(recebidas.getAllByRole('row')).toHaveLength(2);
    const parcial = within(recebidas.getAllByRole('row')[1]);
    expect(parcial.getByText('Cliente teste')).toBeInTheDocument();
    expect(parcial.getByText('123/456')).toBeInTheDocument();
    expect(parcial.getByText('R$ 100.000,00')).toBeInTheDocument();
    expect(parcial.getByText('1/2')).toBeInTheDocument();
    expect(parcial.queryByText('2/2')).not.toBeInTheDocument();
    expect(parcial.getByText('Parcial')).toBeInTheDocument();
    expect(parcial.getByText('R$ 400,00', { exact: true })).toBeInTheDocument();
    expect(parcial.getByText('R$ 2.600,00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'A Receber' }));
    await receber('2.600,00', '002');
    expect(screen.getByText('Cliente teste')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Recebida$/ }));
    const quitadas = within(screen.getByRole('table', { name: 'Parcelas com recebimentos' }));
    expect(quitadas.getAllByRole('row')).toHaveLength(2);
    const primeira = within(quitadas.getAllByRole('row')[1]);
    expect(quitadas.getAllByRole('columnheader').slice(0, 4).map(item => item.textContent)).toEqual([
      'Data da venda', 'Data do recebimento', 'Número do borderô', 'Cliente / Grupo e cota',
    ]);
    expect(primeira.getAllByRole('cell')[2]).toHaveTextContent('001-A · 002');
    expect(primeira.getByText('Recebida', { exact: true })).toBeInTheDocument();
    expect(primeira.getByText('R$ 0,00')).toBeInTheDocument();
    expect(primeira.getByText('18/11/2026 — R$ 400,00')).toBeInTheDocument();
    expect(primeira.getByText('18/11/2026 — R$ 2.600,00')).toBeInTheDocument();
    expect(quitadas.getAllByRole('columnheader').slice(-2).map(item => item.textContent)).toEqual(['Histórico de recebimentos', 'Ação']);
    const celulas = primeira.getAllByRole('cell');
    expect(quitadas.getAllByRole('columnheader')[5]).toHaveTextContent('Valor da carta');
    expect(celulas[5]).toHaveTextContent('R$ 100.000,00');
    expect(celulas[11]).not.toHaveTextContent('Borderô');
    expect(within(celulas[11]).queryByRole('button')).not.toBeInTheDocument();
    const botoesEstorno = within(celulas[12]).getAllByRole('button');
    expect(botoesEstorno).toHaveLength(2);
    expect(botoesEstorno[0]).toHaveAccessibleName(/400,00 — Borderô: 001-A/);
    expect(botoesEstorno[1]).toHaveAccessibleName(/2\.600,00 — Borderô: 002/);
    fireEvent.click(screen.getByRole('button', { name: 'A Receber' }));
    await receber('3.000,00', '003');
    expect(await screen.findByText('Nenhuma venda a receber.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Recebida$/ }));
    expect(await screen.findAllByText('Cliente teste')).toHaveLength(2);
    expect(screen.getAllByText('R$ 100.000,00')).toHaveLength(2);
    expect(within(screen.getByRole('table', { name: 'Parcelas com recebimentos' })).getAllByRole('row')).toHaveLength(3);
    expect((await loadVendasConsorcio())[0].parcelas.flatMap(item => item.recebimentos)).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /^Tabela$/ }));
    await screen.findByText('003');
    const tabela = within(screen.getByRole('table'));
    expect(tabela.getAllByRole('row').slice(2)).toHaveLength(3);
    expect(tabela.getByText('001-A')).toBeInTheDocument();
    expect(tabela.getByText('002')).toBeInTheDocument();

    view.unmount();
    records.set('consorcio_cadastros', cadastro(10));
    render(<RegistroAnaliseVendasConsorcioDashboard onChangeBrand={vi.fn()} onOpenCadastros={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Vendas$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Recebida$/ }));
    expect(await screen.findAllByText('Cliente teste')).toHaveLength(2);
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('18/11/2026 — R$ 400,00')).toBeInTheDocument();
    expect(kvGet).toHaveBeenCalledWith(expect.stringContaining('consorcio_venda_'), { throwOnError: true });
  });

  it('não lista parcelas sem recebimentos na aba Recebida', async () => {
    await saveNovaVendaConsorcio(criarVendaConsorcio(dados(), cadastro()));
    render(<VendasReceber situacao="recebida" />);
    expect(await screen.findByText('Nenhuma parcela com recebimento.')).toBeInTheDocument();
    expect(screen.queryByText('Cliente teste')).not.toBeInTheDocument();
  });

  it('estorna apenas o recebimento escolhido, atualizando saldo e histórico após validar a senha', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 403, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const venda = criarVendaConsorcio(dados(), cadastro(1));
    venda.parcelas[0].recebimentos.push(
      { id: 'antigo', data: '2026-11-17', valorCentavos: 10000 },
      { id: 'novo', data: '2026-11-18', valorCentavos: 590000, numeroBordero: '001' },
    );
    await saveNovaVendaConsorcio(venda);
    const view = render(<VendasReceber situacao="recebida" />);
    const row = within((await screen.findAllByRole('row'))[1]);
    expect(within(row.getAllByRole('cell')[1]).getAllByText(/2026/).map(item => item.textContent)).toEqual(['17/11/2026', '18/11/2026']);
    expect(row.getAllByRole('cell')[2]).toHaveTextContent('— · 001');
    fireEvent.click(row.getByRole('button', { name: /Estornar recebimento.*17\/11\/2026/ }));
    let dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Senha de estorno'), { target: { value: 'incorreta' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Confirmar estorno' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Senha de estorno incorreta');
    expect((await loadVendasConsorcio())[0].parcelas[0].recebimentos).toHaveLength(2);
    fireEvent.change(dialog.getByLabelText('Senha de estorno'), { target: { value: 'senha-teste' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Confirmar estorno' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(row.getAllByRole('cell')[1]).toHaveTextContent('18/11/2026');
    expect(row.getAllByRole('cell')[1]).not.toHaveTextContent('17/11/2026');
    expect(row.getAllByRole('cell')[2]).toHaveTextContent('001');
    expect(row.queryByText('17/11/2026 — R$ 100,00')).not.toBeInTheDocument();
    expect(row.getByText('Parcial')).toBeInTheDocument();
    expect(resumoVenda((await loadVendasConsorcio())[0])).toMatchObject({ recebidoCentavos: 590000, saldoCentavos: 10000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    view.unmount();
    render(<VendasReceber situacao="a_receber" />);
    expect(await screen.findByText('Cliente teste')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 100,00').length).toBeGreaterThan(0);
  });

  it('não estorna quando o armazenamento detecta alteração concorrente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ ok: true }) }));
    const venda = criarVendaConsorcio(dados(), cadastro(1));
    venda.parcelas[0].recebimentos.push({ id: 'baixa', data: '2026-11-18', valorCentavos: 10000 });
    await saveNovaVendaConsorcio(venda);
    vi.mocked(kvCompareAndSet).mockRejectedValueOnce(new Error('Conflito de versão'));
    await expect(estornarRecebimentoConsorcio(venda.id, 1, 'baixa', 'senha-teste')).rejects.toThrow('Conflito');
    expect((await loadVendasConsorcio())[0].parcelas[0].recebimentos).toHaveLength(1);
  });

  it('não estorna se a validação retornar uma resposta inválida e remove a parcela de Recebida após o último estorno', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const venda = criarVendaConsorcio(dados(), cadastro(1));
    venda.parcelas[0].recebimentos.push({ id: 'baixa', data: '2026-11-18', valorCentavos: 600000, numeroBordero: '123' });
    await saveNovaVendaConsorcio(venda);
    await expect(estornarRecebimentoConsorcio(venda.id, 1, 'baixa', 'senha-teste')).rejects.toThrow('Resposta inválida');
    expect((await loadVendasConsorcio())[0].parcelas[0].recebimentos).toHaveLength(1);
    render(<VendasReceber situacao="recebida" />);
    fireEvent.click(await screen.findByRole('button', { name: /Estornar recebimento/ }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Senha de estorno'), { target: { value: 'senha-teste' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Confirmar estorno' }));
    expect(await screen.findByText('Nenhuma parcela com recebimento.')).toBeInTheDocument();
    expect(resumoVenda((await loadVendasConsorcio())[0])).toMatchObject({ recebidoCentavos: 0, saldoCentavos: 600000, quitada: false });
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

async function receber(valor: string, numeroBordero: string) {
  fireEvent.click(screen.getAllByRole('button', { name: 'Registrar recebimento' })[0]);
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.change(dialog.getByRole('textbox', { name: 'Valor recebido (R$)' }), { target: { value: valor } });
  fireEvent.change(dialog.getByLabelText('Data do recebimento'), { target: { value: '2026-11-18' } });
  fireEvent.change(dialog.getByRole('textbox', { name: 'Número do borderô *' }), { target: { value: numeroBordero } });
  fireEvent.click(dialog.getByRole('button', { name: 'Confirmar recebimento' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}
