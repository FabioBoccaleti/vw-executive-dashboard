import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DemonstracoesFinanceiras } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras';
import {
  aplicarModeloBalancoSorana, aplicarModeloDfcPadrao, calcularLinhas, cadastroVazio, LINHA_PL_ID, LINHA_RESULTADO_PERIODO_ID,
  type CadastroDemonstracoes, type TipoDemonstracao,
} from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import { CONFERENCIAS_CONFIG_PADRAO } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/conferenciasStorage';
import {
  loadCadastroDemonstracoes, loadDadosDemonstracoes, type DocumentoNotasDfc,
} from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/storage';

const mocks = vi.hoisted(() => ({ get: vi.fn(), cas: vi.fn(), raw: vi.fn(), exportExcel: vi.fn(), conferencias: vi.fn() }));
vi.mock('@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/conferenciasDados', async importOriginal => ({
  ...await importOriginal<typeof import('@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/conferenciasDados')>(),
  carregarConferenciasPeriodosExportacao: mocks.conferencias,
}));
vi.mock('@/lib/kvClient', () => ({ kvGet: mocks.get, kvCompareAndSet: mocks.cas }));
vi.mock('@/components/FluxoCaixaDashboard/fluxoCaixaStorage', () => ({ loadFluxoCaixaRaw: mocks.raw }));
vi.mock('@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/exportacaoExcel', () => ({
  exportarDemonstracoesFinanceirasExcel: mocks.exportExcel,
}));

let persistido: CadastroDemonstracoes | null;
let persistidoNotas: Record<string, DocumentoNotasDfc>;
const raw = (receita: number, custo: number, caixa: number) => ({
  rawText: `R;3.1;Receita;0,00;0,00;${receita},00;0,00\nD;3.2;Custos;0,00;${custo},00;0,00;0,00\nA;1.1;Caixa;0,00;0,00;0,00;${caixa},00`,
});

beforeEach(() => {
  mocks.get.mockReset();
  mocks.cas.mockReset();
  mocks.raw.mockReset();
  mocks.exportExcel.mockReset().mockResolvedValue(undefined);
  mocks.conferencias.mockReset().mockImplementation(async (anos: number[], mesLimite: number) =>
    anos.flatMap(ano => Array.from({ length: mesLimite }, (_, indice) => ({
      ano, mes: indice + 1, config: CONFERENCIAS_CONFIG_PADRAO, resultados: [], snapshots: [], comparacoes: [],
    }))));
  persistido = null;
  persistidoNotas = {};
  mocks.get.mockImplementation(async (key: string) => key.startsWith('fluxo_caixa_dfc_notas_') ? persistidoNotas[key] ?? null : persistido);
  mocks.cas.mockImplementation(async (key: string, value: { version: string }) => {
    if (key.startsWith('fluxo_caixa_dfc_notas_')) persistidoNotas[key] = value as DocumentoNotasDfc;
    else persistido = value as CadastroDemonstracoes;
  });
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

it('mantém saldos negativos das contas a receber e reduz o Passivo por contas devedoras nos grupos e detalhes', async () => {
  persistido = {
    ...cadastroVazio(), version: 'v1', modeloBalancoSoranaAplicado: true,
    empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' },
    linhas: [
      { id: 'receber', nome: 'Contas a receber', demonstracao: 'ativo', tipo: 'contas', contasPorPrefixo: true, saldoInvertido: true, itens: [{ referencia: '1.1.3', operacao: -1 }] },
      { id: 'passivo', nome: 'Passivo Circulante', demonstracao: 'passivo', tipo: 'contas', contasPorPrefixo: true, itens: [{ referencia: '2.1', operacao: -1 }] },
    ],
  };
  mocks.raw.mockResolvedValue({ rawText: [
    'A;1.1.3.01.03.001;Clientes;0;0;0;120',
    'A;1.1.3.01.03.003;Débitos por devolução;0;0;0;-30',
    'A;1.1.3.01.03.006;Créditos a identificar;0;0;0;-10',
    'P;2.1.1.01;Fornecedores;0;0;0;-100',
    'P;2.1.4.01;Outras contingências devedoras;0;0;0;20',
  ].join('\n') });
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Ativo' }));
  expect(within(await screen.findByRole('row', { name: /Contas a receber/ })).getByRole('cell')).toHaveTextContent('80');
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Contas a receber' }));
  expect(within(await screen.findByRole('row', { name: /1\.1\.3\.01\.03\.003 —/ })).getByRole('cell')).toHaveTextContent('(30)');
  expect(within(screen.getByRole('row', { name: /1\.1\.3\.01\.03\.006 —/ })).getByRole('cell')).toHaveTextContent('(10)');
  fireEvent.click(screen.getByRole('tab', { name: 'Passivo' }));
  expect(within(await screen.findByRole('row', { name: /Passivo Circulante/ })).getByRole('cell')).toHaveTextContent('80');
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Passivo Circulante' }));
  expect(within(await screen.findByRole('row', { name: /2\.1\.1\.01 —/ })).getByRole('cell')).toHaveTextContent('100');
  expect(within(screen.getByRole('row', { name: /2\.1\.4\.01 —/ })).getByRole('cell')).toHaveTextContent('(20)');
});

it('preserva amortizações 1.5.7.02 negativas na tela sem modificar operações do cadastro legado', async () => {
  persistido = {
    ...cadastroVazio(), version: 'v1', modeloBalancoSoranaAplicado: true,
    empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' },
    linhas: [
      { id: 'intangivel', nome: 'Intangível', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.5.7.01.001', operacao: 1 }] },
      { id: 'amortizacoes', nome: 'Amortizações acumuladas', demonstracao: 'ativo', tipo: 'contas', itens: [{ referencia: '1.5.7.02.001', operacao: 1 }] },
      { id: 'nao-circulante', nome: 'Não Circulante', demonstracao: 'ativo', tipo: 'total', itens: [
        { referencia: 'intangivel', operacao: 1 }, { referencia: 'amortizacoes', operacao: 1 },
      ] },
    ],
  };
  mocks.raw.mockResolvedValue({ rawText: 'A;1.5.7.01.001;Intangível;0;0;0;100\nA;1.5.7.02.001;Amortização intangível;0;0;0;-20' });
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Ativo' }));
  const amortizacoes = await screen.findByRole('row', { name: /Amortizações acumuladas/ });
  expect(within(amortizacoes).getByRole('cell')).toHaveTextContent('(20)');
  expect(within(screen.getByRole('row', { name: /Não Circulante/ })).getByRole('cell')).toHaveTextContent('80');
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Amortizações acumuladas' }));
  expect(within(await screen.findByRole('row', { name: /1\.5\.7\.02\.001 —/ })).getByRole('cell')).toHaveTextContent('(20)');
  expect(mocks.cas).not.toHaveBeenCalled();
  await abrirCadastros();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  const recarregado = await loadCadastroDemonstracoes();
  expect(recarregado.linhas.find(linha => linha.id === 'amortizacoes')?.itens[0].operacao).toBe(1);
  expect(recarregado.linhas.find(linha => linha.id === 'intangivel')?.itens[0].operacao).toBe(1);
  expect(recarregado.linhas.some(linha => linha.id === LINHA_PL_ID)).toBe(false);
});

it('edita e recarrega o Patrimônio Líquido com sublinhas, prefixos e resultado automático preservados', async () => {
  persistido = aplicarModeloBalancoSorana({
    ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' },
  });
  mocks.raw.mockResolvedValue({ rawText: [
    'P;2.3.1;Capital total;-100;0;0;-100',
    'P;2.3.1.01;Capital integralizado;-100;0;0;-100',
    'P;2.3.2.01.01;Reserva de capital;-10;0;0;-10',
    'P;2.3.2.02.01;Reserva de lucros;-20;0;0;-20',
    'P;2.3.3.01;Prejuízos acumulados;5;0;0;5',
    'P;2.3.4.01;Ajuste devedor;15;0;0;15',
    'R;3.1;Receita;0;0;40;-40',
  ].join('\n') });
  const tela = render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'passivo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar Patrimônio Líquido' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Nome da linha principal *'), { target: { value: 'Patrimônio Líquido ajustado' } });
  fireEvent.change(dialogo.getByLabelText('Nome da sublinha *'), { target: { value: 'Capital integralizado' } });
  const prefixo = await dialogo.findByRole('checkbox', { name: /^2\.3\.1 — Capital total/ });
  expect(prefixo).toBeEnabled();
  fireEvent.click(prefixo);
  fireEvent.click(dialogo.getByRole('checkbox', { name: /^2\.3\.1\.01 —/ }));

  fireEvent.click(dialogo.getByRole('button', { name: 'Resultado do Período' }));
  expect(dialogo.getByText(/Resultado calculado automaticamente/)).toBeInTheDocument();
  expect(dialogo.queryByLabelText('Pesquisar contas')).not.toBeInTheDocument();
  fireEvent.change(dialogo.getByLabelText('Nome da sublinha *'), { target: { value: 'Resultado apurado' } });
  fireEvent.change(dialogo.getByLabelText('Tipo de linha'), { target: { value: 'contas' } });
  expect(dialogo.getByRole('alert')).toHaveTextContent('preservar o cálculo automático');
  expect(dialogo.getByLabelText('Tipo de linha')).toHaveValue('bancos');
  fireEvent.click(dialogo.getByRole('button', { name: 'Reservas de Capital' }));
  fireEvent.click(dialogo.getByRole('button', { name: 'Remover sublinha' }));
  fireEvent.click(dialogo.getByRole('button', { name: 'Adicionar sublinha' }));
  fireEvent.change(dialogo.getByLabelText('Nome da sublinha *'), { target: { value: 'Ajustes de patrimônio' } });
  fireEvent.click(dialogo.getByRole('checkbox', { name: /^2\.3\.4\.01 —/ }));
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  tela.unmount();

  const recarregado = await loadCadastroDemonstracoes();
  const resultado = recarregado.linhas.find(linha => linha.id === LINHA_RESULTADO_PERIODO_ID);
  expect(resultado).toMatchObject({ nome: 'Resultado apurado', calculo: 'resultadoBalancete', itens: [] });
  expect(recarregado.linhas.find(linha => linha.id === LINHA_PL_ID)?.nome).toBe('Patrimônio Líquido ajustado');
  expect(recarregado.linhas.some(linha => linha.id === 'passivo-pl-reservas-capital')).toBe(false);
  const dados = await loadDadosDemonstracoes({ ano: 2026, mes: 2 }, [], 'patrimonial');
  const valores = calcularLinhas(recarregado.linhas, 'passivo', [dados['2026_2']]);
  expect(valores.get(LINHA_RESULTADO_PERIODO_ID)).toBe(40);
  expect(valores.get(LINHA_PL_ID)).toBe(140);
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'passivo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar Patrimônio Líquido ajustado' }));
  expect(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ajustes de patrimônio' })).toBeInTheDocument();
});

it('move e exclui o Patrimônio Líquido com confirmação, sem recriar o grupo ao recarregar', async () => {
  persistido = aplicarModeloBalancoSorana({
    ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' },
    linhas: [{ id: 'obrigacoes', nome: 'Obrigações', demonstracao: 'passivo', tipo: 'contas', itens: [{ referencia: '2.1.1', operacao: 1 }] }],
  });
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'passivo' } });
  expect(screen.getByRole('button', { name: 'Subir Patrimônio Líquido' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Subir Patrimônio Líquido' }));
  expect(screen.getByRole('button', { name: 'Subir Patrimônio Líquido' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Descer Patrimônio Líquido' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  expect(persistido?.linhas.filter(linha => linha.demonstracao === 'passivo' && !linha.sublinhaDe)[0].id).toBe(LINHA_PL_ID);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Patrimônio Líquido' }));
  const confirmacao = within(await screen.findByRole('alertdialog'));
  expect(confirmacao.getByText(/Deseja excluir a linha/)).toHaveTextContent('sublinhas ou bancos vinculados');
  fireEvent.click(confirmacao.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByRole('button', { name: 'Editar Patrimônio Líquido' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Patrimônio Líquido' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir linha' }));
  expect(screen.queryByRole('button', { name: 'Editar Patrimônio Líquido' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  const recarregado = await loadCadastroDemonstracoes();
  expect(recarregado.linhas.some(linha => linha.id === LINHA_PL_ID || linha.sublinhaDe === LINHA_PL_ID)).toBe(false);
  expect(recarregado.linhas.find(linha => linha.id === 'obrigacoes')).toBeDefined();
});

it.each(['dre', 'endividamento'] as const)('confirma a exclusão de linhas de %s, preservando o cadastro ao cancelar', async demonstracao => {
  persistido = {
    ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' },
    linhas: [
      { id: 'grupo', nome: 'Grupo para excluir', demonstracao, tipo: 'total', itens: [{ referencia: 'filha', operacao: 1 }] },
      {
        id: 'filha', nome: 'Linha vinculada', demonstracao, tipo: 'contas',
        ...(demonstracao === 'endividamento' ? { bancoDe: 'grupo' } : { sublinhaDe: 'grupo' }),
        itens: [{ referencia: demonstracao === 'endividamento' ? '2.1.1' : '3.1', operacao: 1 }],
      },
      { id: 'preservada', nome: 'Linha preservada', demonstracao, tipo: 'contas', itens: [{ referencia: '9.1', operacao: 1 }] },
    ],
  };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: demonstracao } });
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Grupo para excluir' }));
  const confirmacao = within(await screen.findByRole('alertdialog', { name: 'Excluir linha?' }));
  expect(confirmacao.getByText(/Deseja excluir a linha “Grupo para excluir”/)).toHaveTextContent('sublinhas ou bancos vinculados');
  expect(mocks.cas).not.toHaveBeenCalled();
  expect(screen.queryByText(/Alterações não salvas/)).not.toBeInTheDocument();
  fireEvent.click(confirmacao.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Editar Grupo para excluir' })).toBeInTheDocument();
  expect(screen.queryByText(/Alterações não salvas/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Excluir Grupo para excluir' }));
  fireEvent.keyDown(await screen.findByRole('alertdialog'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Editar Grupo para excluir' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Excluir Grupo para excluir' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir linha' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Editar Grupo para excluir' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Editar Linha preservada' })).toBeInTheDocument();
  expect(screen.getByText(/Alterações não salvas/)).toBeInTheDocument();
  expect(mocks.cas).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  expect(persistido?.linhas.some(linha => linha.id === 'grupo' || linha.id === 'filha')).toBe(false);
  expect(persistido?.linhas.find(linha => linha.id === 'preservada')).toBeDefined();
});

it('mantém a confirmação aberta e informa o erro ao excluir uma linha usada em totalização', async () => {
  const demonstracao: TipoDemonstracao = 'dre';
  persistido = {
    ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' },
    linhas: [
      { id: 'receita', nome: 'Receita vinculada', demonstracao, tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }] },
      { id: 'total', nome: 'Total dependente', demonstracao, tipo: 'total', itens: [{ referencia: 'receita', operacao: 1 }] },
    ],
  };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Receita vinculada' }));
  const confirmacao = within(await screen.findByRole('alertdialog'));
  expect(confirmacao.getByText(/Deseja excluir a linha/)).not.toHaveTextContent('sublinhas ou bancos vinculados');
  fireEvent.click(confirmacao.getByRole('button', { name: 'Excluir linha' }));
  expect(await confirmacao.findByRole('alert')).toHaveTextContent(/mesma demonstração/);
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(mocks.cas).not.toHaveBeenCalled();
  fireEvent.click(confirmacao.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByRole('button', { name: 'Editar Receita vinculada' })).toBeInTheDocument();
  expect(screen.queryByText(/Alterações não salvas/)).not.toBeInTheDocument();
});

it('exporta as demonstrações com anos comparativos, período e notas selecionados', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' } };
  persistidoNotas['fluxo_caixa_dfc_notas_2026_1_mes_direto'] = {
    version: 'nota-v1',
    notas: [{ id: 'nota-1', linhaId: 'dfc-op01', linhaNome: 'Recebimentos de clientes', texto: 'Recebimento extraordinário.' }],
  };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await screen.findByRole('button', { name: 'Exportar Excel' });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Fev/25' });

  fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
  await waitFor(() => expect(mocks.exportExcel).toHaveBeenCalledOnce());
  expect(mocks.exportExcel).toHaveBeenCalledWith(expect.objectContaining({
    anos: [2026, 2025],
    mesLimite: 2,
    incluirNotasAnuais: false,
    conferencias: [
      expect.objectContaining({ ano: 2026, mes: 1 }),
      expect.objectContaining({ ano: 2026, mes: 2 }),
      expect.objectContaining({ ano: 2025, mes: 1 }),
      expect.objectContaining({ ano: 2025, mes: 2 }),
    ],
    notas: expect.arrayContaining([expect.objectContaining({
      escopo: { ano: 2026, mes: 1, periodo: 'mes', metodo: 'direto' },
      notas: [{ id: 'nota-1', linhaId: 'dfc-op01', linhaNome: 'Recebimentos de clientes', texto: 'Recebimento extraordinário.' }],
    })]),
  }), 'Demonstracoes_Financeiras_2026_Jan-Fev.xlsx');
  expect(await screen.findByText('Arquivo Excel gerado com sucesso.')).toBeInTheDocument();
  expect(mocks.conferencias).toHaveBeenCalledWith([2026, 2025], 2, expect.objectContaining({ empresa: persistido.empresa }));
});

it('informa a falha de carga das conferências sem gerar um Excel parcial', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' } };
  mocks.conferencias.mockRejectedValueOnce(new Error('Histórico indisponível'));
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={0} />);
  await screen.findByRole('button', { name: 'Adicionar ano' });
  fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
  expect(await screen.findByText('Não foi possível exportar as demonstrações: Histórico indisponível')).toBeInTheDocument();
  expect(mocks.conferencias).toHaveBeenCalledWith([2026], 12, expect.anything());
  expect(mocks.exportExcel).not.toHaveBeenCalled();
});

it('exporta conferências de janeiro a dezembro na seleção anual', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' } };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={0} />);
  await screen.findByRole('button', { name: 'Adicionar ano' });
  fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
  await waitFor(() => expect(mocks.exportExcel).toHaveBeenCalledOnce());
  expect(mocks.conferencias).toHaveBeenCalledWith([2026], 12, expect.anything());
  const parametros = mocks.exportExcel.mock.calls[0][0];
  expect(parametros.conferencias.map(({ mes }: { mes: number }) => mes)).toEqual(
    Array.from({ length: 12 }, (_, indice) => indice + 1),
  );
  expect(parametros.incluirNotasAnuais).toBe(true);
});

it('expande em Cadastros os grupos e suas sublinhas, sem detalhar totalizações', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'grupo', nome: 'Receita', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }, { referencia: '9.9', operacao: 1 }] },
    { id: 'principal', nome: 'Despesas', demonstracao: 'dre', tipo: 'total', itens: [{ referencia: 'sub', operacao: 1 }] },
    { id: 'sub', nome: 'Custos', demonstracao: 'dre', tipo: 'contas', sublinhaDe: 'principal', itens: [{ referencia: '3.2', operacao: 1 }] },
    { id: 'total', nome: 'Resultado', demonstracao: 'dre', tipo: 'total', itens: [{ referencia: 'grupo', operacao: 1 }, { referencia: 'principal', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  await screen.findByRole('button', { name: 'Exibir contas de Receita' });
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Receita' }));
  expect(await screen.findByText('3.1 — Receita')).toBeInTheDocument();
  expect(screen.getByText('9.9 — Descrição indisponível no balancete carregado')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Despesas' }));
  expect(screen.getByText('Custos')).toBeInTheDocument();
  expect(screen.getByText('3.2 — Custos')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Exibir contas de Resultado' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar contas de Receita' }));
  expect(screen.queryByText('3.1 — Receita')).not.toBeInTheDocument();
});

it('detalha valores da DRE por conta para cada ano e no acumulado, preservando a indisponibilidade', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'grupo', nome: 'Resultado operacional', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: -1 }, { referencia: '3.2', operacao: 1 }, { referencia: '9.9', operacao: 1 }] },
    { id: 'total', nome: 'Resultado final', demonstracao: 'dre', tipo: 'total', itens: [{ referencia: 'grupo', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await screen.findByRole('rowheader', { name: 'Resultado operacional' });
  expect(screen.queryByRole('button', { name: 'Exibir contas de Resultado final' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Resultado operacional' }));
  expect(within(await screen.findByRole('row', { name: /3\.1 — Receita/ })).getByRole('cell')).toHaveTextContent('500');
  expect(within(screen.getByRole('row', { name: /3\.2 — Custos/ })).getByRole('cell')).toHaveTextContent('(100)');
  expect(within(screen.getByRole('row', { name: /9\.9 — Descrição indisponível/ })).getByRole('cell')).toHaveTextContent('0');
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Fev/25' });
  await waitFor(() => expect(within(screen.getByRole('row', { name: /3\.1 — Receita/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['500', '200']));
  fireEvent.click(screen.getByRole('button', { name: 'Acumulado (Jan–Fev/26)' }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /3\.2 — Custos/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['(300)', '(90)']));
  fireEvent.change(screen.getByLabelText('Ano para adicionar à comparação'), { target: { value: '2023' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /3\.1 — Receita/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['1.500', '500', '—']));
  expect(within(screen.getByRole('row', { name: /9\.9 — Descrição indisponível/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0', '0', '—']);
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar contas de Resultado operacional' }));
  expect(screen.queryByRole('row', { name: /3\.1 — Receita/ })).not.toBeInTheDocument();
});

it('exibe percentuais da DRE por padrão e permite ocultá-los', async () => {
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (ano === 2025 && mes === 2) return raw(200, 20, 300);
    if (ano === 2026 && mes === 1) return raw(1000, 200, 150);
    if (ano === 2026 && mes === 2) return raw(500, 100, 300);
    return null;
  });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'receita', nome: 'Receita Líquida de Vendas', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }] },
    { id: 'custos', nome: 'Custos', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.2', operacao: 1 }] },
    { id: 'resultado', nome: 'Resultado', demonstracao: 'dre', tipo: 'total', itens: [{ referencia: 'receita', operacao: 1 }, { referencia: 'custos', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  const linhaReceita = await screen.findByRole('row', { name: /Receita Líquida de Vendas/ });
  expect(await within(linhaReceita).findByText('100,0%')).toBeInTheDocument();
  const ocultar = screen.getByRole('button', { name: 'Ocultar % da Receita Líquida de Vendas' });
  expect(ocultar).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(ocultar);
  expect(within(linhaReceita).queryByText('100,0%')).not.toBeInTheDocument();

  const mostrar = screen.getByRole('button', { name: 'Mostrar % da Receita Líquida de Vendas' });
  expect(mostrar).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(mostrar);
  expect(await within(linhaReceita).findByText('100,0%')).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /Custos/ })).getByText('-20,0%')).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /Resultado/ })).getByText('80,0%')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Fev/25' });
  await waitFor(() => {
    expect(within(screen.getByRole('row', { name: /Custos/ })).getByText('-10,0%')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Custos' }));
  const contaCustos = await screen.findByRole('row', { name: /3\.2 — Custos/ });
  expect(within(contaCustos).queryByText(/%/)).not.toBeInTheDocument();
});

it('oculta detalhes zerados da DFC nos dois métodos, considera o acumulado mensal e reapresenta linhas com valor', async () => {
  persistido = { ...aplicarModeloDfcPadrao(cadastroVazio()), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' } };
  const idsCadastros = persistido.linhas.map(linha => linha.id);
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (ano !== 2026 || mes < 1 || mes > 3) return null;
    return { rawText: [
      `R;3.1.01;Receita;0;0;${mes === 1 ? 100 : 0};0`,
      `D;5.1.1.01;Empregados;0;${mes === 3 ? 5 : 0};0;0`,
      `D;5.1.3.04.01;Depreciação;0;${mes === 3 ? '0,01' : 0};0;0`,
    ].join('\n') };
  });
  const { rerender } = render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  const recebimentos = await screen.findByRole('rowheader', { name: 'Recebimentos de clientes' });
  expect(within(recebimentos.closest('tr')!).getByRole('cell')).toHaveTextContent('0');
  expect(screen.queryByRole('rowheader', { name: 'Pagamentos a empregados' })).not.toBeInTheDocument();
  expect(screen.getByRole('rowheader', { name: 'Atividades de Investimento' })).toBeInTheDocument();
  expect(screen.getByRole('rowheader', { name: 'CAIXA LÍQUIDO DAS ATIVIDADES DE INVESTIMENTO' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Indireto' }));
  expect(await screen.findByRole('rowheader', { name: /Resultado líquido do período/ })).toBeInTheDocument();
  expect(screen.queryByRole('rowheader', { name: '(+) Depreciação e amortização' })).not.toBeInTheDocument();
  expect(screen.getByRole('rowheader', { name: 'Ajustes ao resultado' })).toBeInTheDocument();
  expect(screen.getByRole('rowheader', { name: 'Resultado ajustado' })).toBeInTheDocument();
  rerender(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={3} />);
  expect(await screen.findByRole('rowheader', { name: '(+) Depreciação e amortização' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Direto' }));
  expect(await screen.findByRole('rowheader', { name: 'Pagamentos a empregados' })).toBeInTheDocument();
  expect(persistido.linhas.map(linha => linha.id)).toEqual(idsCadastros);
  expect(mocks.cas).not.toHaveBeenCalled();
});

it('mantém detalhes com acumulado indisponível na DFC em vez de tratar o período ausente como zero', async () => {
  persistido = { ...aplicarModeloDfcPadrao(cadastroVazio()), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' } };
  mocks.raw.mockImplementation(async (ano: number, mes: number) =>
    ano === 2026 && mes === 2 ? { rawText: 'R;3.1.01;Receita;0;0;0;0' } : null);
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  expect(await screen.findByRole('rowheader', { name: 'Pagamentos a empregados' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Indireto' }));
  expect(await screen.findByRole('rowheader', { name: '(+) Depreciação e amortização' })).toBeInTheDocument();
});

it.each([0, 2])('mantém detalhes da DFC com valor em outro ano comparado, na seleção de mês %s', async mes => {
  persistido = { ...aplicarModeloDfcPadrao(cadastroVazio()), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' } };
  mocks.raw.mockImplementation(async (ano: number) => ({
    rawText: `R;3.1.01;Receita;0;0;${ano === 2025 ? 10 : 0};0`,
  }));
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={mes} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  await screen.findByRole('rowheader', { name: 'Atividades Operacionais' });
  expect(screen.queryByRole('rowheader', { name: 'Recebimentos de clientes' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Ano para adicionar à comparação'), { target: { value: '2025' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Recebimentos de clientes/ }))
    .getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0', '10']));
  fireEvent.click(screen.getByRole('button', { name: 'Indireto' }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Resultado líquido do período/ }))
    .getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0', '10']));
});

it('exibe DFC Direto por mês e no acumulado de janeiro até o mês selecionado', async () => {
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (ano !== 2026) return null;
    if (mes === 1) return { rawText: [
      'A;3.1;Receita;0;0;1000;-1000',
      'A;4.1;Custo;0;300;0;300',
      'A;1.1;Caixa;100;50;0;150',
      'P;2.1;Fornecedores;10;0;30;40',
    ].join('\n') };
    if (mes === 2) return { rawText: [
      'A;3.1;Receita;-1000;0;500;-1500',
      'A;4.1;Custo;300;100;0;400',
      'A;1.1;Caixa;150;25;0;175',
      'P;2.1;Fornecedores;40;0;10;50',
    ].join('\n') };
    return null;
  });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'fluxo', nome: 'Fluxo operacional', demonstracao: 'dfc', tipo: 'contas', itens: [
      { referencia: '3.1', operacao: 1 }, { referencia: '4.1', operacao: 1 },
      { referencia: '1.1', operacao: 1 }, { referencia: '2.1', operacao: 1 },
    ] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  await screen.findByRole('rowheader', { name: 'Fluxo operacional' });
  const tabelaDfc = within(screen.getByRole('region', { name: 'Demonstração DFC' })).getAllByRole('table')[0];
  expect(within(tabelaDfc).getByRole('columnheader', { name: 'Fev/26' })).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /Fluxo operacional/ })).getByRole('cell')).toHaveTextContent('385');
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Fluxo operacional' }));
  expect(within(await screen.findByRole('row', { name: /3\.1 — Receita/ })).getByRole('cell')).toHaveTextContent('500');
  expect(within(screen.getByRole('row', { name: /4\.1 — Custo/ })).getByRole('cell')).toHaveTextContent('(100)');
  fireEvent.click(screen.getByRole('button', { name: 'Acumulado (Jan–Fev/26)' }));
  await waitFor(() => {
    expect(within(screen.getByRole('row', { name: /Fluxo operacional/ })).getByRole('cell')).toHaveTextContent('1.065');
    expect(within(screen.getByRole('row', { name: /1\.1 — Caixa/ })).getByRole('cell')).toHaveTextContent('(75)');
  });
});

it('permite alternar para o DFC Indireto e confere o subtotal operacional com o método direto', async () => {
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  await screen.findByRole('rowheader', { name: 'Atividades Operacionais' });
  fireEvent.click(screen.getByRole('button', { name: 'Indireto' }));

  const resultado = await screen.findByRole('row', { name: /Resultado líquido do período/ });
  expect(within(resultado).getByRole('cell')).toHaveTextContent('400');
  expect(screen.queryByRole('rowheader', { name: /Outros itens de resultado de investimento\/financiamento/ })).not.toBeInTheDocument();
  const tabelaIndireta = screen.getByRole('table', { name: /DFC Indireto/ });
  expect(within(tabelaIndireta).queryByText(/^(?:RES|AJ\d{2}|V\d{2})$/)).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Conferência da DFC indireta' })).toHaveTextContent('OK — métodos convergem');

  fireEvent.click(screen.getByRole('tab', { name: 'Cadastros' }));
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'dfc' } });
  await screen.findByRole('button', { name: 'Método Indireto' });
  fireEvent.click(screen.getByRole('button', { name: 'Método Indireto' }));
  expect(await screen.findByRole('button', { name: 'Editar regras V03' })).toBeInTheDocument();
});

it('salva notas gerais e vinculadas às linhas por método e período, permitindo editar e excluir', async () => {
  persistido = {
    ...cadastroVazio(),
    version: 'v1',
    dfcModeloInicializado: true,
    dfcIndiretoModeloInicializado: true,
    empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' },
    linhas: [{ id: 'fluxo', nome: 'Fluxo operacional', demonstracao: 'dfc', tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }] }],
  };
  mocks.raw.mockResolvedValue({ rawText: 'A;3.1;Receita;0;0;100;0' });
  const tela = render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  const notas = await screen.findByRole('region', { name: 'Notas explicativas da DFC' });
  const adicionar = await within(notas).findByRole('button', { name: 'Adicionar nota' });

  fireEvent.click(adicionar);
  let dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Texto da nota explicativa'), { target: { value: 'Contexto geral do período.' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Salvar nota' }));
  expect(await within(notas).findByText('Contexto geral do período.')).toBeInTheDocument();
  expect(persistidoNotas['fluxo_caixa_dfc_notas_2026_2_mes_direto'].notas[0]).toMatchObject({
    texto: 'Contexto geral do período.',
    linhaId: undefined,
  });

  fireEvent.click(within(notas).getByRole('button', { name: 'Adicionar nota' }));
  dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Linha da DFC (opcional)'), { target: { value: 'fluxo' } });
  fireEvent.change(dialogo.getByLabelText('Texto da nota explicativa'), { target: { value: 'Variação excepcional nesta linha.' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Salvar nota' }));
  expect(await within(notas).findByText('Variação excepcional nesta linha.')).toBeInTheDocument();
  expect(persistidoNotas['fluxo_caixa_dfc_notas_2026_2_mes_direto'].notas[1]).toMatchObject({
    linhaId: 'fluxo',
    linhaNome: 'Fluxo operacional',
  });

  fireEvent.click(screen.getByRole('button', { name: 'Indireto' }));
  expect(await within(notas).findByText('Nenhuma nota explicativa cadastrada para este método e período.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Direto' }));
  expect(await within(notas).findByText('Contexto geral do período.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Acumulado (Jan–Fev/26)' }));
  expect(await within(notas).findByText('Nenhuma nota explicativa cadastrada para este método e período.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mês (Fev/26)' }));
  expect(await within(notas).findByText('Contexto geral do período.')).toBeInTheDocument();

  fireEvent.click(within(notas).getByRole('button', { name: 'Editar nota 1' }));
  dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Texto da nota explicativa'), { target: { value: 'Contexto geral revisado.' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Salvar nota' }));
  expect(await within(notas).findByText('Contexto geral revisado.')).toBeInTheDocument();

  fireEvent.click(within(notas).getByRole('button', { name: 'Excluir nota 1' }));
  const confirmacao = within(await screen.findByRole('alertdialog'));
  fireEvent.click(confirmacao.getByRole('button', { name: 'Excluir nota' }));
  await waitFor(() => expect(mocks.cas).toHaveBeenCalledTimes(4));
  await waitFor(() => expect(within(notas).queryByText('Contexto geral revisado.')).not.toBeInTheDocument());
  expect(within(notas).getByText('Variação excepcional nesta linha.')).toBeInTheDocument();

  tela.unmount();
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  expect(await screen.findByText('Variação excepcional nesta linha.')).toBeInTheDocument();
});

it('pré-carrega o mapeamento DFC, mostra contas fora da DFC e destaca contas sem prefixo', async () => {
  mocks.raw.mockResolvedValue({ rawText: [
    'A;3.1.1;Receita detalhada;0;0;100;0',
    'A;1.1.1.01.01.001;Caixa;0;20;10;0',
    'A;9.9.9;Conta sem regra;0;5;0;0',
  ].join('\n') });
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  await screen.findByRole('rowheader', { name: 'Atividades Operacionais' });
  expect(screen.getByRole('rowheader', { name: 'Recebimentos de clientes' })).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /Atividades Operacionais/ })).getAllByRole('cell')[0]).toBeEmptyDOMElement();
  expect(within(screen.getByRole('row', { name: /CAIXA LÍQUIDO DAS ATIVIDADES OPERACIONAIS/ })).getAllByRole('cell')[0]).toHaveTextContent('100');
  expect(screen.getByRole('rowheader', { name: 'CAIXA LÍQUIDO DAS ATIVIDADES DE INVESTIMENTO' })).toBeInTheDocument();
  expect(screen.getByRole('rowheader', { name: 'CAIXA LÍQUIDO DAS ATIVIDADES DE FINANCIAMENTO' })).toBeInTheDocument();
  expect(screen.queryByRole('rowheader', { name: 'Contas fora da DFC' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Recebimentos de clientes' }));
  expect(await screen.findByRole('row', { name: /3\.1\.1 — Receita detalhada/ })).toBeInTheDocument();
  const foraDfc = screen.getByRole('region', { name: 'Contas fora da DFC' });
  fireEvent.click(within(foraDfc).getByText('Caixa (1 conta)'));
  expect(await screen.findByRole('row', { name: /1\.1\.1\.01\.01\.001 — Caixa/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Contas com movimento sem classificação na DFC (1)' }));
  expect(screen.getByRole('row', { name: /9\.9\.9 — Conta sem regra/ })).toBeInTheDocument();
});

it('mostra sugestões para contas pendentes nos dois métodos e só as salva após confirmação', async () => {
  mocks.raw.mockResolvedValue({ rawText: [
    'A;1.1.2.01;Clientes diversos A;0;0;0;0',
    'A;1.1.2.02;Clientes diversos B;0;0;0;0',
    'A;1.1.2.03;Clientes diversos C;0;20;0;20',
  ].join('\n') });
  persistido = {
    ...cadastroVazio(),
    version: 'v1',
    empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' },
    dfcModeloInicializado: true,
    dfcIndiretoModeloInicializado: true,
    dfcIndiretoRegras: [
      { referencia: '1.1.2.01', linha: 'V03' },
      { referencia: '1.1.2.02', linha: 'V03' },
    ],
    linhas: [
      { id: 'dfc-operacional', nome: 'Operacional', demonstracao: 'dfc', tipo: 'total', itens: [{ referencia: 'dfc-op01', operacao: 1 }] },
      { id: 'dfc-op01', nome: 'Ativos operacionais', demonstracao: 'dfc', tipo: 'contas', sublinhaDe: 'dfc-operacional', itens: [
        { referencia: '1.1.2.01', operacao: 1 }, { referencia: '1.1.2.02', operacao: 1 },
      ] },
    ],
  };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  const pendencias = await screen.findByRole('button', { name: 'Contas com movimento sem classificação na DFC (1)' });
  fireEvent.click(pendencias);
  const contaPendente = await screen.findByRole('row', { name: /1\.1\.2\.03 — Clientes diversos C/ });
  expect(contaPendente).toHaveTextContent('Sem classificação');
  expect(contaPendente).toHaveTextContent('Direto: Ativos operacionais — Operacional');
  expect(contaPendente).toHaveTextContent('Indireto: V03 · Estoques');

  fireEvent.click(screen.getByRole('button', { name: 'Indireto' }));
  expect(await screen.findByRole('row', { name: /1\.1\.2\.03 — Clientes diversos C/ })).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('row', { name: /1\.1\.2\.03 — Clientes diversos C/ }))
    .getByRole('button', { name: 'Aceitar e salvar' }));
  expect(await screen.findByText('Cadastro salvo com sucesso.')).toBeInTheDocument();
  expect(persistido?.linhas.find(linha => linha.id === 'dfc-op01')?.itens)
    .toContainEqual({ referencia: '1.1.2.03', operacao: 1 });
  expect(persistido?.dfcIndiretoRegras).toContainEqual({ referencia: '1.1.2.03', linha: 'V03' });
  await waitFor(() => expect(screen.queryByRole('row', { name: /1\.1\.2\.03 — Clientes diversos C/ })).not.toBeInTheDocument());
});

it('permite editar o nome do subtotal da seção da DFC', async () => {
  persistido = {
    ...cadastroVazio(),
    version: 'v1',
    empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' },
  };
  mocks.raw.mockResolvedValue({ rawText: 'A;3.1.1;Receita detalhada;0;0;100;0' });
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  await screen.findByRole('rowheader', { name: 'Atividades Operacionais' });
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'dfc' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Atividades Operacionais' }));

  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Nome da linha de subtotal'), { target: { value: 'Caixa operacional líquido' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  expect(await screen.findByText('Cadastro salvo com sucesso.')).toBeInTheDocument();
  expect(persistido?.linhas.find(linha => linha.id === 'dfc-operacional')?.dfcSubtotalNome).toBe('Caixa operacional líquido');

  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  expect(await screen.findByRole('rowheader', { name: 'Caixa operacional líquido' })).toBeInTheDocument();
  const subtotal = await screen.findByRole('row', { name: /Caixa operacional líquido/ });
  expect(within(subtotal).getAllByRole('cell')[0]).toHaveTextContent('100');
});

it('concilia o caixa pelo mês ou acumulado e mantém as contas de caixa personalizadas após salvar', async () => {
  persistido = {
    ...cadastroVazio(),
    version: 'v1',
    empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' },
  };
  mocks.raw.mockImplementation(async (_ano: number, mes: number) => {
    if (mes === 1) return { rawText: [
      'A;3.1.1;Receita;0;0;80;0',
      'A;1.1.1.01.01.001;Banco A;100;0;0;150',
      'A;1.1.1.02.01.001;Banco B;200;0;0;200',
    ].join('\n') };
    if (mes === 2) return { rawText: [
      'A;3.1.1;Receita;0;0;50;0',
      'A;1.1.1.01.01.001;Banco A;150;0;0;200',
      'A;1.1.1.02.01.001;Banco B;200;0;0;250',
    ].join('\n') };
    return null;
  });
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'DFC' }));
  const linhaVariacaoDfc = await screen.findByRole('row', { name: /Variação de caixa pela DFC/ });
  expect(within(linhaVariacaoDfc).getByRole('cell')).toHaveTextContent('50,00');
  expect(within(screen.getByRole('row', { name: /Saldo de caixa — início/ })).getByRole('cell')).toHaveTextContent('350,00');
  expect(within(screen.getByRole('row', { name: /Saldo de caixa — fim/ })).getByRole('cell')).toHaveTextContent('450,00');
  expect(within(screen.getByRole('row', { name: /Variação real de caixa/ })).getByRole('cell')).toHaveTextContent('100,00');

  fireEvent.click(screen.getByRole('button', { name: 'Acumulado (Jan–Fev/26)' }));
  await waitFor(() => {
    expect(within(screen.getByRole('row', { name: /Variação de caixa pela DFC/ })).getByRole('cell')).toHaveTextContent('130,00');
    expect(within(screen.getByRole('row', { name: /Saldo de caixa — início/ })).getByRole('cell')).toHaveTextContent('300,00');
    expect(within(screen.getByRole('row', { name: /Saldo de caixa — fim/ })).getByRole('cell')).toHaveTextContent('450,00');
    expect(within(screen.getByRole('row', { name: /Variação real de caixa/ })).getByRole('cell')).toHaveTextContent('150,00');
  });

  fireEvent.click(screen.getByRole('button', { name: 'Editar contas de caixa/equivalentes' }));
  const editor = within(await screen.findByRole('dialog'));
  fireEvent.click(editor.getByRole('button', { name: 'Remover regra 1.1.1' }));
  fireEvent.click(editor.getByRole('checkbox', { name: /^1\.1\.1\.01\.01\.001 — Banco A/ }));
  fireEvent.click(editor.getByRole('button', { name: 'Salvar contas' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  expect(persistido?.dfcContasCaixaEquivalentes).toEqual(['1.1.1.01.01.001']);

  await waitFor(() => {
    expect(within(screen.getByRole('row', { name: /Saldo de caixa — início/ })).getByRole('cell')).toHaveTextContent('100,00');
    expect(within(screen.getByRole('row', { name: /Saldo de caixa — fim/ })).getByRole('cell')).toHaveTextContent('200,00');
    expect(within(screen.getByRole('row', { name: /Variação real de caixa/ })).getByRole('cell')).toHaveTextContent('100,00');
  });
});

it('marca como indisponível o detalhe de uma conta agrupadora vinculada em cadastro antigo', async () => {
  mocks.raw.mockResolvedValue({ rawText: 'S;3.1;Conta agrupadora;0;0;100;0\nA;3.1.1;Conta analítica;0;0;100;0' });
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'grupo', nome: 'Grupo antigo', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await screen.findByText(/Existem contas incompletas\/agrupadoras vinculadas/);
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Grupo antigo' }));
  expect(within(screen.getByRole('row', { name: /3\.1 — Conta agrupadora/ })).getByRole('cell')).toHaveTextContent('—');
});

it('usa o balancete anual no detalhamento das contas da DRE', async () => {
  mocks.raw.mockImplementation(async (ano: number, mes: number) => mes === 0 ? raw(ano === 2026 ? 1500 : 500, 300, 0) : null);
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'grupo', nome: 'Receitas', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.1', operacao: 1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={0} />);
  await screen.findByRole('rowheader', { name: 'Receitas' });
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Receitas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Ano/2025' });
  await waitFor(() => expect(within(screen.getByRole('row', { name: /3\.1 — Receita/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['1.500', '500']));
});

it.each([
  { demonstracao: 'ativo' as const, titulo: 'Ativo', vinculo: 'sublinhaDe' as const },
  { demonstracao: 'passivo' as const, titulo: 'Passivo', vinculo: 'sublinhaDe' as const },
  { demonstracao: 'endividamento' as const, titulo: 'Endividamento', vinculo: 'bancoDe' as const },
])('detalha sublinhas de $titulo com sinais contábeis e saldos comparativos', async ({ demonstracao, titulo, vinculo }) => {
  mocks.raw.mockImplementation(async (ano: number) => ({
    rawText: `A;1.1;Conta detalhada;0;0;0;${ano === 2026 ? '-120' : '60'}`,
  }));
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'principal', nome: 'Principal', demonstracao, tipo: 'total', itens: [{ referencia: 'sub', operacao: 1 }] },
    { id: 'sub', nome: 'Grupo detalhado', demonstracao, tipo: 'contas', [vinculo]: 'principal', itens: [{ referencia: '1.1', operacao: -1 }] },
  ] };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: titulo }));
  await screen.findByRole('rowheader', { name: 'Grupo detalhado' });
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Grupo detalhado' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Fev/25' });
  await waitFor(() => expect(within(screen.getByRole('row', { name: /1\.1 — Conta detalhada/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(
    demonstracao === 'ativo' ? ['(120)', '60'] : ['120', '(60)'],
  ));
  expect(screen.getByRole('button', { name: 'Ocultar contas de Grupo detalhado' })).toHaveAttribute('aria-expanded', 'true');
});

it('permite transformar uma linha da DRE em sublinhas e voltar sem perder suas contas', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'despesas', nome: 'Despesas Operacionais', demonstracao: 'dre', tipo: 'contas', itens: [{ referencia: '3.2', operacao: 1 }] },
    { id: 'resultado', nome: 'Resultado', demonstracao: 'dre', tipo: 'total', itens: [{ referencia: 'despesas', operacao: 1 }] },
  ] };
  const tela = render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  fireEvent.click(screen.getByRole('button', { name: 'Editar Despesas Operacionais' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Tipo de linha'), { target: { value: 'bancos' } });
  expect(dialogo.getByRole('checkbox', { name: /^3\.2 —/ })).toBeChecked();
  fireEvent.change(dialogo.getByLabelText('Nome da sublinha *'), { target: { value: 'Despesas gerais' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Adicionar sublinha' }));
  fireEvent.change(dialogo.getByLabelText('Nome da sublinha *'), { target: { value: 'Outras despesas' } });
  expect(dialogo.getByRole('checkbox', { name: /^3\.2 —.*já vinculada/ })).toBeDisabled();
  fireEvent.click(dialogo.getByRole('checkbox', { name: /^3\.1 —/ }));
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  tela.unmount();

  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await screen.findByRole('rowheader', { name: 'Outras despesas' });
  const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
  expect(linhas.map(linha => within(linha).getByRole('rowheader').textContent)).toEqual([
    'Despesas Operacionais', 'Despesas gerais', 'Outras despesas', 'Resultado',
  ]);
  expect(linhas.map(linha => within(linha).getByRole('cell').textContent)).toEqual(['400', '(100)', '500', '400']);
  fireEvent.click(screen.getByRole('button', { name: 'Acumulado (Jan–Fev/26)' }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Resultado/ })).getByRole('cell')).toHaveTextContent('1.200'));

  await abrirCadastros();
  fireEvent.click(screen.getByRole('button', { name: 'Editar Despesas Operacionais' }));
  const edicao = within(await screen.findByRole('dialog'));
  fireEvent.change(edicao.getByLabelText('Tipo de linha'), { target: { value: 'contas' } });
  expect(edicao.getByRole('checkbox', { name: /^3\.1 —/ })).toBeChecked();
  expect(edicao.getByRole('checkbox', { name: /^3\.2 —/ })).toBeChecked();
  fireEvent.click(edicao.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  expect(persistido?.linhas.filter(linha => linha.demonstracao === 'dre')).toHaveLength(2);
  expect(persistido?.linhas.filter(linha => linha.demonstracao === 'dfc')).toHaveLength(25);
  fireEvent.click(screen.getByRole('tab', { name: 'DRE' }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Resultado/ })).getByRole('cell')).toHaveTextContent('1.200'));
});

it('cadastra uma linha nova da DRE com sublinhas opcionais', async () => {
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' } };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Nome da linha *'), { target: { value: 'Despesas Operacionais' } });
  fireEvent.change(dialogo.getByLabelText('Tipo de linha'), { target: { value: 'bancos' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  expect(dialogo.getByRole('alert')).toHaveTextContent('ao menos uma conta');
  fireEvent.click(dialogo.getByRole('button', { name: 'Adicionar sublinha' }));
  fireEvent.change(dialogo.getByLabelText('Nome da sublinha *'), { target: { value: 'Despesas gerais' } });
  fireEvent.click(await dialogo.findByRole('checkbox', { name: /^3\.2 —/ }));
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('tab', { name: 'DRE' }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Despesas Operacionais/ })).getByRole('cell')).toHaveTextContent('(100)'));
  expect(screen.getByRole('rowheader', { name: 'Despesas gerais' })).toBeInTheDocument();
});

it.each([
  { demonstracao: 'ativo' as const, titulo: 'Ativo', codigo: '1' },
  { demonstracao: 'passivo' as const, titulo: 'Passivo', codigo: '2' },
])('permite sublinhas em $titulo preservando sinais, totalizações e comparação', async ({ demonstracao, titulo, codigo }) => {
  mocks.raw.mockImplementation(async (ano: number) => ({
    rawText: `A;${codigo}.1;Conta principal;0;0;0;${ano === 2026 ? 100 : 50}\nA;${codigo}.2;Outra conta;0;0;0;${ano === 2026 ? -20 : -10}`,
  }));
  persistido = { ...cadastroVazio(), version: 'v1', empresa: { nome: 'Empresa exemplo', cnpj: 'exemplo', nire: '' }, linhas: [
    { id: 'principal', nome: 'Circulante', demonstracao, tipo: 'contas', itens: [{ referencia: `${codigo}.1`, operacao: -1 }] },
    { id: 'total', nome: 'Total geral', demonstracao, tipo: 'total', itens: [{ referencia: 'principal', operacao: 1 }] },
  ] };
  const tela = render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: demonstracao } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar Circulante' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Tipo de linha'), { target: { value: 'bancos' } });
  expect(dialogo.queryByLabelText(`Operação de ${codigo}.1`)).not.toBeInTheDocument();
  fireEvent.change(dialogo.getByLabelText('Nome da sublinha *'), { target: { value: 'Primeiro grupo' } });
  fireEvent.click(dialogo.getByRole('button', { name: 'Adicionar sublinha' }));
  fireEvent.change(dialogo.getByLabelText('Nome da sublinha *'), { target: { value: 'Segundo grupo' } });
  expect(dialogo.getByRole('checkbox', { name: new RegExp(`^${codigo}\\.1 —.*já vinculada`) })).toBeDisabled();
  fireEvent.click(dialogo.getByRole('checkbox', { name: new RegExp(`^${codigo}\\.2 —`) }));
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  tela.unmount();

  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: titulo }));
  await screen.findByRole('rowheader', { name: 'Segundo grupo' });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ano' }));
  await screen.findByRole('columnheader', { name: 'Fev/25' });
  const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    .filter(linha => !/^(?:Patrimônio Líquido|Capital Social|Reservas de Capital|Reservas de Lucros|Lucros \(Prejuízos\) Acumulados|Resultado do Período)$/.test(within(linha).getByRole('rowheader').textContent ?? ''));
  expect(linhas.map(linha => within(linha).getByRole('rowheader').textContent)).toEqual([
    'Circulante', 'Primeiro grupo', 'Segundo grupo', 'Total geral',
  ]);
  expect(linhas.map(linha => within(linha).getAllByRole('cell').map(cell => cell.textContent))).toEqual(
    demonstracao === 'ativo'
      ? [['80', '40'], ['100', '50'], ['(20)', '(10)'], ['80', '40']]
      : [['(80)', '(40)'], ['(100)', '(50)'], ['20', '10'], ['(80)', '(40)']],
  );

  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: demonstracao } });
  fireEvent.click(screen.getByRole('button', { name: 'Editar Circulante' }));
  const edicao = within(await screen.findByRole('dialog'));
  fireEvent.change(edicao.getByLabelText('Tipo de linha'), { target: { value: 'contas' } });
  expect(edicao.queryByLabelText(`Operação de ${codigo}.1`)).not.toBeInTheDocument();
  expect(edicao.queryByLabelText(`Operação de ${codigo}.2`)).not.toBeInTheDocument();
  fireEvent.click(edicao.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Cadastro salvo com sucesso.');
  expect(persistido?.linhas.filter(linha => linha.demonstracao === demonstracao && !linha.modeloProtegido)).toHaveLength(2);
  expect(persistido?.linhas.filter(linha => linha.demonstracao === 'dfc')).toHaveLength(25);
  fireEvent.click(screen.getByRole('tab', { name: titulo }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Total geral/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(
    demonstracao === 'ativo' ? ['80', '40'] : ['(80)', '(40)'],
  ));
});

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
  const confirmacao = within(await screen.findByRole('alertdialog'));
  fireEvent.click(confirmacao.getByRole('button', { name: 'Excluir linha' }));
  expect(await confirmacao.findByRole('alert')).toHaveTextContent(/mesma demonstração/);
  fireEvent.click(confirmacao.getByRole('button', { name: 'Cancelar' }));
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
    rawText: `${raw(receita, custo, caixa).rawText}\nP;2.1;Fornecedores;0,00;0,00;0,00;-${passivo},00`,
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
  expect(dialogo.queryByLabelText('Operação de 1.1')).not.toBeInTheDocument();
  fireEvent.click(dialogo.getByRole('button', { name: 'Aplicar linha' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Ativo' }));
  await waitFor(() => expect(within(screen.getByRole('row', { name: /Disponibilidades/ })).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['300', '75']));
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
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['DRE', 'Ativo', 'Passivo', 'DFC', 'Endividamento', 'Cadastros', 'Conferências']);
  await abrirCadastros();
  fireEvent.change(screen.getByLabelText('Demonstração do cadastro'), { target: { value: 'endividamento' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }));
  const dialogo = within(await screen.findByRole('dialog'));
  fireEvent.change(dialogo.getByLabelText('Tipo de linha'), { target: { value: 'contas' } });
  fireEvent.change(dialogo.getByLabelText('Nome da linha *'), { target: { value: 'Dívida bancária' } });
  fireEvent.click(await dialogo.findByRole('checkbox', { name: /^2\.1 —/ }));
  expect(dialogo.queryByLabelText('Operação de 2.1')).not.toBeInTheDocument();
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
    rawText: `P;2.1;Credor A;0;0;0;${ano === 2026 ? '-90,40' : '-60,40'}\nP;2.2;Credor B;0;0;0;-20,40\nP;2.3;Credor C;0;0;0;-10,40`,
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
  mocks.raw.mockResolvedValue({ rawText: 'P;2.1;Empréstimos;0;0;0;-1250,25' });
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

it('carrega o acumulado do ano para as conferências do balanço sem ampliar outras telas patrimoniais', async () => {
  mocks.raw.mockResolvedValue(raw(500, 100, 300));
  const balanco = await loadDadosDemonstracoes({ ano: 2026, mes: 2 }, { ano: 2024, mes: 1 }, 'balanco');
  expect(Object.keys(balanco).sort()).toEqual(['2024_1', '2026_1', '2026_2']);
  expect(mocks.raw).toHaveBeenCalledTimes(3);

  mocks.raw.mockClear();
  const anual = await loadDadosDemonstracoes({ ano: 2026, mes: 0 }, { ano: 2026, mes: 0 }, 'balanco');
  expect(Object.keys(anual)).toEqual(['2026_0']);
  expect(mocks.raw).toHaveBeenCalledTimes(1);
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

it('exibe as contas do Capital Social e concilia o resultado do balancete com a DRE acumulada', async () => {
  mocks.raw.mockImplementation(async (ano: number, mes: number) => {
    if (ano !== 2026 || ![1, 2].includes(mes)) return null;
    const receita = mes === 1 ? 100 : 200;
    const custo = mes === 1 ? 20 : 40;
    const despesaNaoClassificada = mes === 1 ? 0 : 10;
    return { rawText: [
      'A;1.1.1.01;Caixa;0;0;0;1000',
      'A;1.5.5.02.01.001;Depreciação acumulada;0;0;0;-10',
      'P;2.1.1;Passivo circulante;0;0;0;-100',
      'P;2.3.1.01.01.001;Capital social;0;0;0;-740',
      `R;3.1.1;Receita;0;0;100;-${receita}`,
      `D;4.1.1;Custo;0;${mes === 1 ? 20 : 20};0;${custo}`,
      `D;5.1.1;Despesa não classificada;0;${despesaNaoClassificada};0;${despesaNaoClassificada}`,
    ].join('\n') };
  });
  persistido = {
    ...cadastroVazio(),
    version: 'v1',
    empresa: { nome: 'Empresa exemplo', cnpj: '00.000.000/0001-00', nire: '' },
    linhas: [
      { id: 'ativo-total', nome: 'Ativo', demonstracao: 'ativo', tipo: 'total', itens: [
        { referencia: 'ativo-caixa', operacao: 1 }, { referencia: 'ativo-depreciacao', operacao: 1 },
      ] },
      { id: 'ativo-caixa', nome: 'Caixa', demonstracao: 'ativo', tipo: 'contas', sublinhaDe: 'ativo-total', itens: [
        { referencia: '1.1.1.01', operacao: 1 },
      ] },
      { id: 'ativo-depreciacao', nome: 'Depreciação acumulada', demonstracao: 'ativo', tipo: 'contas', sublinhaDe: 'ativo-total', itens: [
        { referencia: '1.5.5.02.01.001', operacao: 1 },
      ] },
      { id: 'passivo-total', nome: 'Passivo', demonstracao: 'passivo', tipo: 'total', itens: [
        { referencia: 'passivo-nao-circulante', operacao: 1 },
      ] },
      { id: 'passivo-nao-circulante', nome: 'Passivo Não Circulante', demonstracao: 'passivo', tipo: 'contas', sublinhaDe: 'passivo-total', itens: [
        { referencia: '2.1.1', operacao: 1 }, { referencia: '2.3.1.01.01.001', operacao: 1 },
      ] },
      { id: 'dre-receita', nome: 'Receita', demonstracao: 'dre', tipo: 'contas', itens: [
        { referencia: '3.1.1', operacao: 1 },
      ] },
      { id: 'dre-custo', nome: 'Custos', demonstracao: 'dre', tipo: 'contas', itens: [
        { referencia: '4.1.1', operacao: 1 },
      ] },
      { id: 'dre-lucro', nome: 'LUCRO LÍQUIDO DO EXERCÍCIO', demonstracao: 'dre', tipo: 'total', itens: [
        { referencia: 'dre-receita', operacao: 1 }, { referencia: 'dre-custo', operacao: 1 },
      ] },
    ],
  };
  render(<DemonstracoesFinanceiras selectedYear={2026} selectedMonth={2} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Passivo' }));

  const linhaCapital = await screen.findByRole('row', { name: /Capital Social/ });
  expect(within(linhaCapital).getByRole('cell')).toHaveTextContent('740');
  fireEvent.click(screen.getByRole('button', { name: 'Exibir contas de Capital Social' }));
  const contaCapital = await screen.findByRole('row', { name: /2\.3\.1\.01\.01\.001 — Capital social/ });
  expect(within(contaCapital).getByRole('cell')).toHaveTextContent('740');

  const conferencias = within(screen.getByRole('region', { name: 'Conferências do balanço' }));
  expect(conferencias.getByText('Ativo – (Passivo + PL)').parentElement).toHaveTextContent('0,00');
  expect(conferencias.getByText('Resultado do balancete – Lucro líquido da DRE').parentElement).toHaveTextContent('(10,00)');
  fireEvent.click(conferencias.getByText('Contas de resultado sem linha na DRE (1)'));
  expect(await conferencias.findByText(/5\.1\.1 — Despesa não classificada/)).toBeInTheDocument();
});
