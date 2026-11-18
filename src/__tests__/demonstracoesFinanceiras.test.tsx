import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DemonstracoesFinanceiras } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras';
import { cadastroVazio, type CadastroDemonstracoes } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import { loadCadastroDemonstracoes, loadDadosDemonstracoes } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/storage';

const mocks = vi.hoisted(() => ({ get: vi.fn(), cas: vi.fn(), raw: vi.fn() }));
vi.mock('@/lib/kvClient', () => ({ kvGet: mocks.get, kvCompareAndSet: mocks.cas }));
vi.mock('@/components/FluxoCaixaDashboard/fluxoCaixaStorage', () => ({ loadFluxoCaixaRaw: mocks.raw }));

let persistido: CadastroDemonstracoes | null;
const raw = (receita: number, custo: number, caixa: number) => ({
  rawText: `R;3.1;Receita;0,00;0,00;${receita},00;0,00\nD;3.2;Custos;0,00;${custo},00;0,00;0,00\nA;1.1;Caixa;0,00;0,00;0,00;${caixa},00`,
});

beforeEach(() => {
  mocks.get.mockReset();
  mocks.cas.mockReset();
  mocks.raw.mockReset();
  persistido = null;
  mocks.get.mockImplementation(async () => persistido);
  mocks.cas.mockImplementation(async (_key, value: CadastroDemonstracoes) => { persistido = value; });
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (ano === 2026 && mes === 1) return raw(1000, 200, 150);
    if (ano === 2026 && mes === 2) return raw(500, 100, 300);
    if (ano === 2024 && mes === 1) return raw(100, 20, 75);
    return null;
  });
});
afterEach(cleanup);

async function abrirCadastros() {
  fireEvent.click(screen.getByRole('tab', { name: 'Cadastros' }));
  await screen.findByLabelText('Nome da empresa *');
}

async function adicionarGrupo(nome: string, conta: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Nome da linha *'), { target: { value: nome } });
  fireEvent.click(await dialogo.findByRole('checkbox', { name: new RegExp(`^${conta.replace('.', '\\.')} —`) }));
  expect(dialogo.queryByLabelText(`Operação de ${conta}`)).not.toBeInTheDocument();
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

it('cadastra empresa, grupos, totalização e assinante; salva e recarrega DRE com mês e acumulado', async () => {
  const tela = render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Nome da empresa *'), { target: { value: 'Empresa exemplo' } });
  fireEvent.change(screen.getByLabelText('CNPJ *'), { target: { value: '00.000.000/0001-00' } });
  await adicionarGrupo('Receita líquida', '3.1');
  await adicionarGrupo('Custos de vendas', '3.2');
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Nome da linha *'), { target: { value: 'Resultado' } });
  fireEvent.change(dialogo.getByLabelText('Tipo de linha'), { target: { value: 'total' } });
  fireEvent.click(dialogo.getByRole('checkbox', { name: 'Receita líquida' }));
  fireEvent.click(dialogo.getByRole('checkbox', { name: 'Custos de vendas' }));
  expect(dialogo.queryByRole('combobox', { name: /^Operação de/ })).not.toBeInTheDocument();
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar assinante' }));
  fireEvent.change(screen.getByLabelText('Nome do assinante *'), { target: { value: 'Responsável exemplo' } });
  fireEvent.change(screen.getByLabelText('Cargo *'), { target: { value: 'Contador' } });
  fireEvent.change(screen.getByLabelText('Registro profissional (opcional)'), { target: { value: 'CRC exemplo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  expect(await screen.findByText('Cadastro salvo com sucesso.')).toBeInTheDocument();
  expect(mocks.cas).toHaveBeenCalledWith('fluxo_caixa_demonstracoes_cadastro', expect.objectContaining({ empresa: expect.objectContaining({ nome: 'Empresa exemplo' }) }), null);

  fireEvent.click(screen.getByRole('tab', { name: 'DRE' }));
  expect(await screen.findByRole('columnheader', { name: 'Fev/26' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Jan–Fev/26' })).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /Resultado/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['400,00', '1.200,00']);
  expect(screen.getByText('Responsável exemplo')).toBeInTheDocument();
  expect(screen.getByText('CRC exemplo')).toBeInTheDocument();

  tela.unmount();
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  expect(await screen.findByText('Empresa exemplo')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('row', { name: /Resultado/ })).toHaveTextContent('1.200,00'));
  await abrirCadastros();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Receita líquida' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/grupos anteriores/);
  expect(screen.getByRole('button', { name: 'Editar Receita líquida' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nome da empresa *'), { target: { value: 'Nome atualizado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  expect(mocks.cas.mock.calls[1][2]).toBe(mocks.cas.mock.calls[0][1].version);
});

it('permite escolher a data comparativa e mantém saldos separados dos movimentos da DRE', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'caixa', nome: 'Disponibilidades', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.1', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await screen.findByText('Empresa exemplo');
  fireEvent.click(screen.getByRole('tab', { name: 'Ativo' }));
  fireEvent.change(screen.getByLabelText('Mês de comparação'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Ano de comparação'), { target: { value: '2024' } });
  fireEvent.click(screen.getByRole('button', { name: 'Comparar' }));
  await waitFor(() => expect(screen.getByRole('row', { name: /Disponibilidades/ })).toHaveTextContent('75,00'));
  expect(within(screen.getByRole('row', { name: /Disponibilidades/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['300,00', '75,00']);
  expect(screen.getByRole('columnheader', { name: 'Jan/24' })).toBeInTheDocument();
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'ativo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar Disponibilidades' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Operação de 1.1'), { target: { value: '-1' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Ativo' }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Disponibilidades/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['-300,00', '-75,00']));
});

it('aplica os sinais automáticos da DRE a grupos e totalizações já salvos, sem recadastro', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'receita', nome: 'Receita', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: -1 }] },
    { id: 'custo', nome: 'Custos', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.2', operacao: 1 }] },
    { id: 'resultado', nome: 'Resultado', demonstracao: 'dre', tipo: 'total', itens: [{ referencia: 'receita', operacao: -1 }, { referencia: 'custo', operacao: -1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  const linha = await screen.findByRole('row', { name: /Resultado/ });
  expect(within(linha).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['400,00', '1.200,00']);
  expect(within(screen.getByRole('row', { name: /^Custos/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['-100,00', '-300,00']);
  expect(mocks.cas).not.toHaveBeenCalled();
  await abrirCadastros();
  fireEvent.click(screen.getByRole('button', { name: 'Editar Resultado' }));
  const dialogo = within(await screen.findByRole('dialog'));
  expect(dialogo.getByText(/Na DRE, os sinais são automáticos/)).toBeInTheDocument();
  expect(dialogo.queryByRole('combobox', { name: /^Operação de/ })).not.toBeInTheDocument();
});

it('mostra mês ausente sem apresentar acumulado incompleto como zero ou total válido', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'receita', nome: 'Receita líquida', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }] },
  ] };
  mocks.raw.mockImplementation(async (ano: number, mes: number) => ano === 2026 && mes === 2 ? raw(500, 100, 300) : null);
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Jan/26');
  expect(within(screen.getByRole('row', { name: /Receita líquida/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['500,00', '—']);
});

it('bloqueia edição após falha na carga do cadastro e preserva alterações se a gravação falhar', async () => {
  mocks.get.mockRejectedValueOnce(new Error('Rede indisponível'));
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Rede indisponível');
  expect(screen.queryByRole('button', { name: 'Salvar cadastro' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar carregar cadastro novamente' }));
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Nome da empresa *'), { target: { value: 'Empresa exemplo' } });
  fireEvent.change(screen.getByLabelText('CNPJ *'), { target: { value: '00.000.000/0001-00' } });
  mocks.cas.mockRejectedValueOnce(new Error('Cadastro alterado em outra operação. Recarregue a página.'));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('outra operação');
  expect(screen.getByLabelText('Nome da empresa *')).toHaveValue('Empresa exemplo');
  expect(screen.getByText(/Alterações não salvas/)).toBeInTheDocument();
  expect(persistido).toBeNull();
});

it('não mascara falha de balancete como arquivo inexistente e usa o arquivo anual sem somar saldos mensais', async () => {
  mocks.raw.mockRejectedValueOnce(new Error('Falha ao ler o período'));
  await expect(loadDadosDemonstracoes({ ano: 2026, mes: 2 }, { ano: 2024, mes: 1 })).rejects.toThrow('Falha ao ler o período');
  mocks.raw.mockReset().mockResolvedValue(raw(12000, 2000, 5000));
  const dados = await loadDadosDemonstracoes({ ano: 2026, mes: 0 }, { ano: 2024, mes: 0 });
  expect(Object.keys(dados)).toEqual(['2026_0']);
  expect(mocks.raw).toHaveBeenCalledTimes(1);
  expect(mocks.raw).toHaveBeenCalledWith(2026, 0, { throwOnError: true });
  mocks.get.mockResolvedValue({ version: 'corrompido' });
  await expect(loadCadastroDemonstracoes()).rejects.toThrow(/inválido/);
});

it('carrega apenas os períodos necessários, sem bloquear uma demonstração por um arquivo que ela não utiliza', async () => {
  mocks.raw.mockImplementation(async (ano: number) => {
    if (ano === 2025) throw new Error('Comparativo inválido');
    return raw(500, 100, 300);
  });
  const dre = await loadDadosDemonstracoes({ ano: 2026, mes: 2 }, { ano: 2025, mes: 12 }, 'dre');
  expect(Object.keys(dre).sort()).toEqual(['2026_1', '2026_2']);
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (ano === 2026 && mes === 1) throw new Error('Janeiro inválido');
    return raw(500, 100, 300);
  });
  const patrimonio = await loadDadosDemonstracoes({ ano: 2026, mes: 2 }, { ano: 2024, mes: 1 }, 'patrimonial');
  expect(Object.keys(patrimonio)).toEqual(['2026_2', '2024_1']);
});

it('carrega códigos repetidos e permite selecionar somente as contas completas', async () => {
  mocks.raw.mockResolvedValue({ rawText: '2;3.1;Receitas;0;0;100;0\n2;3.1;Receitas repetidas;0;0;200;0\nA;3.1.1;Receita completa;0;0;10;0\nA;3.1.1;Receita completa;0;0;15;0\nS;3.2;Agrupadora sem filhas no arquivo;0;0;100;0' });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'receita', nome: 'Receita líquida', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1.1', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  const linha = await screen.findByRole('row', { name: /Receita líquida/ });
  expect(within(linha).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['15,00', '30,00']);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await abrirCadastros();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }));
  const dialogo = within(await screen.findByRole('dialog'));
  expect(await dialogo.findByRole('checkbox', { name: /^3\.1 —/ })).toBeDisabled();
  expect(dialogo.getByRole('checkbox', { name: /^3\.1\.1 —/ })).toBeEnabled();
  expect(dialogo.getByRole('checkbox', { name: /^3\.2 —/ })).toBeDisabled();
  fireEvent.change(dialogo.getByLabelText('Pesquisar contas'), { target: { value: '3.1' } });
  expect(dialogo.getByRole('checkbox', { name: /^3\.1 —/ })).toBeDisabled();
});

it('avisa sobre agrupadoras já cadastradas e exige a substituição por contas completas', async () => {
  mocks.raw.mockResolvedValue({ rawText: '2;3.1;Receitas;0;0;100;0\nA;3.1.1;Receita completa;0;0;100;0\n2;3.2;Outra agrupadora;0;0;50;0\nA;3.2.1;Outra completa;0;0;50;0' });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'receita', nome: 'Receita antiga', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }] },
    { id: 'outra', nome: 'Outra linha antiga', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.2', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('contas incompletas/agrupadoras vinculadas: 3.1');
  expect(within(screen.getByRole('row', { name: /Receita antiga/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '—']);
  await abrirCadastros();
  await waitFor(() => expect(screen.queryByText('Carregando balancetes...')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Editar Receita antiga' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  expect(await dialogo.findByRole('alert')).toHaveTextContent('Selecione apenas contas completas');
  fireEvent.click(dialogo.getByRole('button', { name: 'Remover item 3.1' }));
  fireEvent.click(dialogo.getByRole('checkbox', { name: /^3\.1\.1 —/ }));
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A conta 3.2 está incompleta');
  expect(mocks.cas).not.toHaveBeenCalled();
});
