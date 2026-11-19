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
    if (ano === 2025 && mes === 1) return raw(300, 50, 250);
    if (ano === 2025 && mes === 2) return raw(200, 40, 300);
    if (ano === 2024 && (mes === 1 || mes === 2)) return raw(100, 20, 75);
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
  fireEvent.change(dialogo.getByLabelText('Nome da linha *'), { target: { value: 'Lucro Bruto' } });
  fireEvent.change(dialogo.getByLabelText('Tipo de linha'), { target: { value: 'total' } });
  fireEvent.click(dialogo.getByRole('checkbox', { name: 'Receita líquida' }));
  fireEvent.click(dialogo.getByRole('checkbox', { name: 'Custos de vendas' }));
  expect(dialogo.queryByRole('combobox', { name: /^Operação de/ })).not.toBeInTheDocument();
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Subir Lucro Bruto' }));
  fireEvent.click(screen.getByRole('button', { name: 'Subir Lucro Bruto' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar assinante' }));
  fireEvent.change(screen.getByLabelText('Nome do assinante *'), { target: { value: 'Responsável exemplo' } });
  fireEvent.change(screen.getByLabelText('Cargo *'), { target: { value: 'Contador' } });
  fireEvent.change(screen.getByLabelText('Registro profissional (opcional)'), { target: { value: 'CRC exemplo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  expect(await screen.findByText('Cadastro salvo com sucesso.')).toBeInTheDocument();
  expect(mocks.cas).toHaveBeenCalledWith('fluxo_caixa_demonstracoes_cadastro', expect.objectContaining({ empresa: expect.objectContaining({ nome: 'Empresa exemplo' }) }), null);

  fireEvent.click(screen.getByRole('tab', { name: 'DRE' }));
  expect(await screen.findByRole('columnheader', { name: 'Fev/26' })).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Jan–Fev/26' })).not.toBeInTheDocument();
  const linhasDre = [...screen.getByRole('table').querySelectorAll('tbody tr')].map(linha => linha.querySelector('th')?.textContent);
  expect(linhasDre).toEqual(['Lucro Bruto', 'Receita líquida', 'Custos de vendas']);
  expect(within(screen.getByRole('row', { name: /Lucro Bruto/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['400']);
  fireEvent.change(screen.getByLabelText('Ano para adicionar à comparação'), { target: { value: '2025' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Fev/25' });
  expect(within(screen.getByRole('row', { name: /Lucro Bruto/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['400', '160']);
  fireEvent.click(screen.getByRole('button', { name: 'Acumulado (Jan–Fev/26)' }));
  expect(await screen.findByRole('columnheader', { name: 'Jan–Fev/26' })).toBeInTheDocument();
  expect(await screen.findByRole('columnheader', { name: 'Jan–Fev/25' })).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /Lucro Bruto/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['1.200', '410']);
  expect(screen.getByText('Responsável exemplo')).toBeInTheDocument();
  expect(screen.getByText('CRC exemplo')).toBeInTheDocument();

  tela.unmount();
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  expect(await screen.findByText('Empresa exemplo')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('row', { name: /Lucro Bruto/ })).toHaveTextContent('400'));
  await abrirCadastros();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Receita líquida' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/mesma demonstração/);
  expect(screen.getByRole('button', { name: 'Editar Receita líquida' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nome da empresa *'), { target: { value: 'Nome atualizado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  expect(mocks.cas.mock.calls[1][2]).toBe(mocks.cas.mock.calls[0][1].version);
});

it('arredonda valores apenas na exibição e apresenta negativos entre parênteses', async () => {
  mocks.raw.mockResolvedValue({
    rawText: 'R;3.1;Receita;0,00;0,00;594.251.675,97;0,00\nD;3.2;Custos;0,00;563.706.749,42;0,00;0,00',
  });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'receita', nome: 'Receita líquida', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }] },
    { id: 'custos', nome: 'Custos', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.2', operacao: 1 }] },
    { id: 'lucro', nome: 'Lucro Bruto', demonstracao: 'dre', tipo: 'total', itens: [{ referencia: 'receita', operacao: 1 }, { referencia: 'custos', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);

  expect(within(await screen.findByRole('row', { name: /Receita líquida/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['594.251.676']);
  expect(within(screen.getByRole('row', { name: /Custos/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['(563.706.749)']);
  expect(within(screen.getByRole('row', { name: /Lucro Bruto/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['30.544.927']);
});

it('compara saldos pontuais no mesmo mês sem acumular os valores patrimoniais', async () => {
  const monthlyRaw = (receita: number, custo: number, caixa: number, passivo: number) => ({
    rawText: `${raw(receita, custo, caixa).rawText}\nP;2.1;Fornecedores;0,00;0,00;0,00;${passivo},00`,
  });
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (ano === 2026 && mes === 2) return monthlyRaw(500, 100, 300, 90);
    if (ano === 2024 && mes === 2) return monthlyRaw(100, 20, 75, 60);
    return null;
  });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'caixa', nome: 'Disponibilidades', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.1', operacao: 1 }] },
    { id: 'fornecedores', nome: 'Fornecedores', demonstracao: 'passivo', tipo: 'contas', itens: [{ referencia: '2.1', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await screen.findByText('Empresa exemplo');
  fireEvent.click(screen.getByRole('tab', { name: 'Ativo' }));
  fireEvent.change(screen.getByLabelText('Ano para adicionar à comparação'), { target: { value: '2024' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Fev/24' });
  expect(within(screen.getByRole('row', { name: /Disponibilidades/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['300', '75']);
  expect(screen.queryByRole('columnheader', { name: 'Jan/24' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Passivo' }));
  await screen.findByRole('columnheader', { name: 'Fev/24' });
  expect(within(screen.getByRole('row', { name: /Fornecedores/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['90', '60']);
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'ativo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar Disponibilidades' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Operação de 1.1'), { target: { value: '-1' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Ativo' }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Disponibilidades/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['(300)', '(75)']));
});

it('cadastra Endividamento separadamente do Passivo e compara os saldos após recarregar', async () => {
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (mes !== 2) throw new Error('Endividamento não deve carregar outros meses');
    return { rawText: `P;2.1;Empréstimos;0;10;20;${ano === 2026 ? '90,75' : '60,25'}` };
  });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'passivo', nome: 'Obrigações', demonstracao: 'passivo', tipo: 'contas', itens: [{ referencia: '2.1', operacao: 1 }] },
  ] };
  const tela = render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['DRE', 'Ativo', 'Passivo', 'Endividamento', 'Cadastros']);
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'endividamento' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Tipo de linha'), { target: { value: 'contas' } });
  fireEvent.change(dialogo.getByLabelText('Nome da linha *'), { target: { value: 'Dívida bancária' } });
  fireEvent.click(await dialogo.findByRole('checkbox', { name: /^2\.1 —/ }));
  fireEvent.change(dialogo.getByLabelText('Operação de 2.1'), { target: { value: '-1' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));

  fireEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }));
  const novoDialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(novoDialogo.getByLabelText('Tipo de linha'), { target: { value: 'contas' } });
  expect(novoDialogo.getByRole('checkbox', { name: /já vinculada ao grupo "Dívida bancária"/ })).toBeDisabled();
  fireEvent.change(novoDialogo.getByLabelText('Nome da linha *'), { target: { value: 'Endividamento total' } });
  fireEvent.change(novoDialogo.getByLabelText('Tipo de linha'), { target: { value: 'total' } });
  expect(novoDialogo.queryByRole('checkbox', { name: 'Obrigações' })).not.toBeInTheDocument();
  fireEvent.click(novoDialogo.getByRole('checkbox', { name: 'Dívida bancária' }));
  fireEvent.click(novoDialogo.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');

  tela.unmount();
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Endividamento' }));
  await screen.findByRole('row', { name: /Endividamento total/ });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Fev/25' });
  expect(within(screen.getByRole('row', { name: /Endividamento total/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['(91)', '(60)']);
  expect(screen.queryByRole('row', { name: /Obrigações/ })).not.toBeInTheDocument();
});

it('salva bancos com contas próprias e exibe seus saldos abaixo do total da linha principal', async () => {
  mocks.raw.mockImplementation(async (ano: number) => ({
    rawText: `P;2.1;Credor A;0;0;0;${ano === 2026 ? '90,40' : '60,40'}\nP;2.2;Credor B;0;0;0;20,40\nP;2.3;Credor C;0;0;0;10,40`,
  }));
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' } };
  const tela = render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'endividamento' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Nome da linha principal *'), { target: { value: 'Endividamento bancário' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Adicionar banco ou dívida' }));
  fireEvent.change(dialogo.getByLabelText('Nome do banco ou dívida *'), { target: { value: 'Banco Itaú' } });
  fireEvent.click(await dialogo.findByRole('checkbox', { name: /^2\.1 —/ }));
  fireEvent.click(dialogo.getByRole('checkbox', { name: /^2\.2 —/ }));
  fireEvent.click(dialogo.getByRole('button', { name: 'Adicionar banco ou dívida' }));
  fireEvent.change(dialogo.getByLabelText('Nome do banco ou dívida *'), { target: { value: 'Banco Bradesco' } });
  expect(dialogo.getByRole('checkbox', { name: /^2\.1 —.*já vinculada ao grupo "Banco Itaú"/ })).toBeDisabled();
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  expect(dialogo.getByRole('alert')).toHaveTextContent('ao menos uma conta');
  fireEvent.click(dialogo.getByRole('checkbox', { name: /^2\.3 —/ }));
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');

  tela.unmount();
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Endividamento' }));
  await screen.findByRole('rowheader', { name: 'Banco Bradesco' });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Fev/25' });
  const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
  expect(linhas.map(linha => within(linha).getByRole('rowheader').textContent)).toEqual(['Endividamento bancário', 'Banco Itaú', 'Banco Bradesco']);
  expect(linhas.map(linha => within(linha).getAllByRole('cell').map(cell => within(cell).getByText(/^\d+$/).textContent))).toEqual([['121', '91'], ['111', '81'], ['10', '10']]);

  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'endividamento' } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar Endividamento bancário' }));
  const edicao = within(await screen.findByRole('dialog'));
  fireEvent.click(edicao.getByRole('button', { name: 'Banco Bradesco' }));
  expect(edicao.getByRole('checkbox', { name: /^2\.3 —/ })).toBeChecked();
});

it('preserva parcelas e juros provisionados por mês sem detalhar as colunas comparativas', async () => {
  const banco = 'Banco Itaú';
  mocks.raw.mockResolvedValue({ rawText: 'P;2.1;Empréstimos;0;0;0;1250,25' });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'principal', nome: 'Dívida bancária', demonstracao: 'endividamento', tipo: 'total', itens: [{ referencia: 'itau', operacao: 1 }] },
    { id: 'itau', nome: banco, demonstracao: 'endividamento', tipo: 'contas', itens: [{ referencia: '2.1', operacao: 1 }], bancoDe: 'principal' },
  ] };
  const tela = render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  const abrirCap = async () => {
    fireEvent.click(await screen.findByRole('button', { name: `Editar captação de ${banco}` }));
    return within(await screen.findByRole('dialog'));
  };
  const salvarCap = async (dialogo: ReturnType<typeof within>) => {
    fireEvent.click(dialogo.getByRole('button', { name: 'Salvar captação' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  };
  fireEvent.click(screen.getByRole('tab', { name: 'Endividamento' }));
  const dialogo = await abrirCap();
  fireEvent.change(dialogo.getByLabelText('Data da captação'), { target: { value: '2025-03-15' } });
  fireEvent.change(dialogo.getByLabelText('Valor da captação (R$)'), { target: { value: '5.000,25' } });
  fireEvent.change(dialogo.getByLabelText('Taxa'), { target: { value: 'CDI + 2% a.a.' } });
  fireEvent.change(dialogo.getByLabelText('Total de parcelas'), { target: { value: '24' } });
  fireEvent.change(dialogo.getByLabelText('Parcelas restantes'), { target: { value: '25' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Salvar captação' }));
  expect(dialogo.getByRole('alert')).toHaveTextContent('não podem exceder');
  expect(mocks.cas).not.toHaveBeenCalled();
  fireEvent.change(dialogo.getByLabelText('Parcelas restantes'), { target: { value: '8' } });
  fireEvent.change(dialogo.getByLabelText('Juros Provisionados (R$)'), { target: { value: '100,123' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Salvar captação' }));
  expect(dialogo.getByRole('alert')).toHaveTextContent('Informe os juros provisionados');
  expect(mocks.cas).not.toHaveBeenCalled();
  fireEvent.change(dialogo.getByLabelText('Juros Provisionados (R$)'), { target: { value: '1.234,56' } });
  await salvarCap(dialogo);

  tela.unmount();
  const recarregada = render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={3} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Endividamento' }));
  const marco = await abrirCap();
  expect(marco.getByLabelText('Parcelas restantes')).toHaveValue(null);
  expect(marco.getByLabelText('Taxa')).toHaveValue('CDI + 2% a.a.');
  expect(marco.getByLabelText('Juros Provisionados (R$)')).toHaveValue('');
  fireEvent.change(marco.getByLabelText('Parcelas restantes'), { target: { value: '0' } });
  fireEvent.change(marco.getByLabelText('Juros Provisionados (R$)'), { target: { value: '0' } });
  await salvarCap(marco);
  expect(screen.getByText('Parcelas restantes: 0')).toBeInTheDocument();
  expect(screen.getByText('Juros Provisionados: R$ 0,00')).toBeInTheDocument();

  recarregada.rerender(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await screen.findByText('Parcelas restantes: 8');
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Fev/25' });
  fireEvent.click(screen.getByRole('button', { name: 'Subir 2025' }));
  const linha = screen.getByRole('row', { name: /Banco Itaú/ });
  const [comparado, atual] = within(linha).getAllByRole('cell');
  expect(comparado.textContent).toBe('1.250');
  expect(atual).toHaveTextContent('Data da captação: 15/03/2025');
  expect(atual).toHaveTextContent('Valor da captação: R$ 5.000,25');
  expect(atual).toHaveTextContent('Taxa: CDI + 2% a.a.');
  expect(atual).toHaveTextContent('Total de parcelas: 24');
  expect(atual).toHaveTextContent('Parcelas restantes: 8');
  expect(atual).toHaveTextContent('Juros Provisionados: R$ 1.234,56');
  expect(within(atual).getByText('1.250')).toBeInTheDocument();
  recarregada.rerender(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={0} />);
  await screen.findByRole('columnheader', { name: 'Ano/2026' });
  expect(screen.queryByRole('button', { name: /Editar captação/ })).not.toBeInTheDocument();
});

it('considera conta ausente em um balancete importado como zero e mantém o saldo do grupo', async () => {
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (mes !== 2) return null;
    if (ano === 2026) return raw(500, 100, 300);
    if (ano === 2025) return { rawText: 'A;1.2;Banco;0,00;0,00;0,00;50,00' };
    return null;
  });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'circulante', nome: 'Circulante', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.1', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await screen.findByText('Empresa exemplo');
  fireEvent.click(screen.getByRole('tab', { name: 'Ativo' }));
  fireEvent.change(screen.getByLabelText('Ano para adicionar à comparação'), { target: { value: '2025' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));

  const linha = await screen.findByRole('row', { name: /Circulante/ });
  await screen.findByRole('columnheader', { name: 'Fev/25' });
  expect(within(linha).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['300', '0']);
  expect(screen.getByText(/Contas cadastradas ausentes/)).toHaveTextContent('considerado zero');
});

it('compara até três anos anuais em todas as demonstrações e permite reordenar as colunas', async () => {
  const annualRaw = (receita: number, custo: number, caixa: number, passivo: number) => ({
    rawText: `${raw(receita, custo, caixa).rawText}\nP;2.1;Fornecedores;0,00;0,00;0,00;${passivo},00`,
  });
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (mes !== 0) return null;
    if (ano === 2025) return annualRaw(1000, 200, 150, 90);
    if (ano === 2024) return annualRaw(800, 100, 100, 70);
    if (ano === 2023) return annualRaw(600, 50, 80, 50);
    return null;
  });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'receita', nome: 'Receita líquida', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }] },
    { id: 'caixa', nome: 'Disponibilidades', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.1', operacao: 1 }] },
    { id: 'fornecedores', nome: 'Fornecedores', demonstracao: 'passivo', tipo: 'contas', itens: [{ referencia: '2.1', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2025} selectedMonth={0} />);
  await screen.findByRole('columnheader', { name: 'Ano/2025' });
  fireEvent.change(screen.getByLabelText('Ano para adicionar à comparação'), { target: { value: '2024' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Ano/2024' });
  fireEvent.change(screen.getByLabelText('Ano para adicionar à comparação'), { target: { value: '2023' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Ano/2023' });
  fireEvent.click(screen.getByRole('button', { name: 'Subir 2024' }));
  const cabecalhosDre = within(screen.getByRole('table')).getAllByRole('columnheader').map(item => item.textContent);
  expect(cabecalhosDre).toEqual(['Descrição', 'Ano/2024', 'Ano/2025', 'Ano/2023']);
  expect(within(screen.getByRole('row', { name: /Receita líquida/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['800', '1.000', '600']);
  expect(screen.getByRole('button', { name: 'Adicionar ano' })).toBeDisabled();

  fireEvent.click(screen.getByRole('tab', { name: 'Ativo' }));
  await screen.findByRole('columnheader', { name: 'Ano/2023' });
  expect(within(screen.getByRole('row', { name: /Disponibilidades/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['100', '150', '80']);
  fireEvent.click(screen.getByRole('tab', { name: 'Passivo' }));
  await screen.findByRole('columnheader', { name: 'Ano/2023' });
  expect(within(screen.getByRole('row', { name: /Fornecedores/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['70', '90', '50']);
});

it('aplica os sinais automáticos da DRE a grupos e totalizações já salvos, sem recadastro', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'receita', nome: 'Receita', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: -1 }] },
    { id: 'custo', nome: 'Custos', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.2', operacao: 1 }] },
    { id: 'resultado', nome: 'Resultado', demonstracao: 'dre', tipo: 'total', itens: [{ referencia: 'receita', operacao: -1 }, { referencia: 'custo', operacao: -1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  const linha = await screen.findByRole('row', { name: /Resultado/ });
  expect(within(linha).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['400']);
  expect(within(screen.getByRole('row', { name: /^Custos/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['(100)']);
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
  fireEvent.click(await screen.findByRole('button', { name: 'Acumulado (Jan–Fev/26)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Jan/26');
  expect(within(screen.getByRole('row', { name: /Receita líquida/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—']);
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
  const dados = await loadDadosDemonstracoes({ ano: 2026, mes: 0 }, []);
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
  const dre = await loadDadosDemonstracoes({ ano: 2026, mes: 2 }, [{ ano: 2026, mes: 2 }], 'dre');
  expect(Object.keys(dre).sort()).toEqual(['2026_1', '2026_2']);
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (ano === 2026 && mes === 1) throw new Error('Janeiro inválido');
    return raw(500, 100, 300);
  });
  const patrimonio = await loadDadosDemonstracoes({ ano: 2026, mes: 2 }, { ano: 2024, mes: 1 }, 'patrimonial');
  expect(Object.keys(patrimonio)).toEqual(['2026_2', '2024_1']);
});

it('desabilita contas já vinculadas a outro grupo e mantém a edição do grupo atual', async () => {
  mocks.raw.mockResolvedValue({ rawText: '2;3.1;Receitas;0;0;100;0\n2;3.1;Receitas repetidas;0;0;200;0\nA;3.1.1;Receita completa;0;0;10;0\nA;3.1.1;Receita completa;0;0;15;0\nA;3.1.2;Outra receita completa;0;0;5;0\nS;3.2;Agrupadora sem filhas no arquivo;0;0;100;0' });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'receita', nome: 'Receita líquida', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1.1', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  const linha = await screen.findByRole('row', { name: /Receita líquida/ });
  expect(within(linha).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['15']);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await abrirCadastros();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }));
  const dialogo = within(await screen.findByRole('dialog'));
  expect(await dialogo.findByRole('checkbox', { name: /^3\.1 —/ })).toBeDisabled();
  expect(dialogo.getByRole('checkbox', { name: /^3\.1\.1 —/ })).toBeDisabled();
  expect(dialogo.getByRole('checkbox', { name: /^3\.1\.2 —/ })).toBeEnabled();
  expect(dialogo.getByRole('checkbox', { name: /^3\.2 —/ })).toBeDisabled();
  fireEvent.change(dialogo.getByLabelText('Pesquisar contas'), { target: { value: '3.1' } });
  expect(dialogo.getByRole('checkbox', { name: /^3\.1 —/ })).toBeDisabled();
  fireEvent.click(dialogo.getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar Receita líquida' }));
  const editor = within(await screen.findByRole('dialog'));
  expect(editor.getByRole('checkbox', { name: /^3\.1\.1 —/ })).toBeChecked();
  expect(editor.getByRole('checkbox', { name: /^3\.1\.1 —/ })).toBeEnabled();
});

it('avisa sobre agrupadoras já cadastradas e exige a substituição por contas completas', async () => {
  mocks.raw.mockResolvedValue({ rawText: '2;3.1;Receitas;0;0;100;0\nA;3.1.1;Receita completa;0;0;100;0\n2;3.2;Outra agrupadora;0;0;50;0\nA;3.2.1;Outra completa;0;0;50;0' });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'receita', nome: 'Receita antiga', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }] },
    { id: 'outra', nome: 'Outra linha antiga', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.2', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('contas incompletas/agrupadoras vinculadas: 3.1');
  expect(within(screen.getByRole('row', { name: /Receita antiga/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—']);
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
