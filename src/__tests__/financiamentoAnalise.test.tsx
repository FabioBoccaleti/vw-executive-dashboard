import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { FinanciamentoBancoVolksDashboard } from '@/components/VendasBonificacoesDashboard/FinanciamentoBancoVolksDashboard';
import { getFinanciamentoMes } from '@/components/VendasBonificacoesDashboard/financiamentoBancoVolksStorage';
import { loadRemuneracaoRegras } from '@/components/VendasBonificacoesDashboard/financiamentoRemuneracaoStorage';
import { loadVendasDsr } from '@/components/VendasBonificacoesDashboard/vendedoresRemuneracaoStorage';
import {
  getAnaliseAliquota, getAnaliseDeducao, getAnaliseRemGerencia, getAnaliseDeducaoSeguros,
  setAnaliseDeducaoSeguros, type AnaliseDeducao,
} from '@/components/VendasBonificacoesDashboard/financiamentoAnaliseStorage';

const auth = vi.hoisted(() => ({ admin: true }));
vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({ isAdmin: () => auth.admin, canAccessVendasSub: () => true, session: null }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/authClient', () => ({ apiLogin: vi.fn() }));
vi.mock('@/lib/kvClient', () => ({ kvGet: vi.fn().mockResolvedValue(null), kvSet: vi.fn().mockResolvedValue(true) }));
vi.mock('@/components/VendasBonificacoesDashboard/financiamentoBancoVolksStorage', () => ({
  getFinanciamentoMes: vi.fn(), setFinanciamentoMes: vi.fn(), deleteFinanciamentoMes: vi.fn(),
}));
vi.mock('@/components/VendasBonificacoesDashboard/financiamentoRemuneracaoStorage', () => ({
  loadRemuneracaoRegras: vi.fn(), saveRemuneracaoRegras: vi.fn(),
}));
vi.mock('@/components/VendasBonificacoesDashboard/vendedoresRemuneracaoStorage', () => ({ loadVendasDsr: vi.fn() }));
vi.mock('@/components/VendasBonificacoesDashboard/financiamentoAnaliseStorage', () => ({
  getAnaliseAliquota: vi.fn(), setAnaliseAliquota: vi.fn(),
  getAnaliseDeducao: vi.fn(), setAnaliseDeducao: vi.fn(),
  getAnaliseRemGerencia: vi.fn(), setAnaliseRemGerencia: vi.fn(),
  getAnaliseDeducaoSeguros: vi.fn(), setAnaliseDeducaoSeguros: vi.fn(),
}));

let valores: Map<number, AnaliseDeducao>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 17));
  auth.admin = true;
  valores = new Map([[10, { novos: 10, usados: 20 }], [11, { novos: 0, usados: 0 }]]);
  vi.mocked(getFinanciamentoMes).mockImplementation(async (_year, month) => [10, 11].includes(month) ? {
    columns: [], fileName: 'teste.xlsx', importedAt: '',
    rows: [
      { 'Tipo de Plano': 'Novo', 'Vendedor CDC, PPS AV, GE, SEGUROS': 'VENDEDOR TESTE', 'Valor Bruto do Bônus Ajustado': 10000 },
      { 'Tipo de Plano': 'Semi-novo', 'Vendedor CDC, PPS AV, GE, SEGUROS': 'VENDEDOR TESTE', 'Valor Bruto do Bônus Ajustado': 5000 },
    ],
  } : null);
  vi.mocked(loadRemuneracaoRegras).mockResolvedValue([{ id: 'retorno', produto: 'Retorno', tipoPremio: 'percentual', valorPremio: '1' }]);
  vi.mocked(loadVendasDsr).mockResolvedValue([
    { id: 'out', ano: 2026, mes: 10, percentual: '20' }, { id: 'nov', ano: 2026, mes: 11, percentual: '20' },
  ]);
  vi.mocked(getAnaliseAliquota).mockResolvedValue(10);
  vi.mocked(getAnaliseDeducao).mockResolvedValue({ novos: 1000, usados: 500 });
  vi.mocked(getAnaliseRemGerencia).mockResolvedValue({ novos: 100, usados: 50 });
  vi.mocked(getAnaliseDeducaoSeguros).mockImplementation(async (_year, month) => valores.get(month) ?? { novos: 0, usados: 0 });
  vi.mocked(setAnaliseDeducaoSeguros).mockImplementation(async (_year, month, valor) => { valores.set(month, valor); });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function abrirAnalise() {
  render(<FinanciamentoBancoVolksDashboard onBack={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Análise de Resultado' }));
  return screen.findByRole('group', { name: 'Deduções Custos Seguros' });
}
const linha = (label: string) => screen.getByText(label, { exact: true }).closest('tr')!;
const celulas = (label: string) => within(linha(label)).getAllByRole('cell').slice(1).map(cell => cell.textContent?.replace(/\s/g, ''));
const numeros = (label: string) => celulas(label).map(text => Number(text?.replace(/[^\d,-]/g, '').replace(',', '.')));
function preencher(novos = '1.250,75', usados = '500,25') {
  fireEvent.change(screen.getByLabelText('Deduções Custos Seguros - Novos'), { target: { value: novos } });
  fireEvent.change(screen.getByLabelText('Deduções Custos Seguros - Usados'), { target: { value: usados } });
}

describe('deduções de custos de seguros na Análise de Resultado', () => {
  it('insere a linha na posição solicitada e reduz somente resultado e margem, preservando cálculo por vendedor', async () => {
    const campos = await abrirAnalise();
    const receita = celulas('(=) Receita Líquida de Financiamento');
    const impostos = celulas('(−) Impostos (10,00%)');
    const remuneracao = celulas('(=) Total Remuneração + Encargos');
    const antes = numeros('(=) Resultado da Operação');
    expect(numeros('(=) Receita Líquida de Financiamento')).toEqual([8100, 4050, 12150]);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar resultado por vendedor' }));
    const vendedorAntes = within(screen.getByText('VENDEDOR TESTE').closest('tr')!).getAllByRole('cell').map(cell => cell.textContent);
    preencher();
    fireEvent.click(within(campos).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(celulas('(−) Deduções Custo Seguros')).toEqual(['-R$1.250,75', '-R$500,25', '-R$1.751,00']));
    expect(setAnaliseDeducaoSeguros).toHaveBeenCalledWith(2026, 11, { novos: 1250.75, usados: 500.25 });
    numeros('(=) Resultado da Operação').forEach((value, i) => expect(value).toBeCloseTo(antes[i] - [1250.75, 500.25, 1751][i], 2));
    expect(celulas('(=) Receita Líquida de Financiamento')).toEqual(receita);
    expect(celulas('(−) Impostos (10,00%)')).toEqual(impostos);
    expect(celulas('(=) Total Remuneração + Encargos')).toEqual(remuneracao);
    expect(linha('(−) Deduções Custo Seguros').previousElementSibling).toBe(linha('(=) Total Remuneração + Encargos'));
    const vendedorDepois = within(screen.getByText('VENDEDOR TESTE').closest('tr')!).getAllByRole('cell').map(cell => cell.textContent);
    expect(vendedorDepois).toEqual(vendedorAntes);
    expect(celulas('Margem sobre Receita Líquida')[2]).toBe('82,0%');
  });

  it('restaura valores por mês e soma Novos e Usados no Ano todo, sem permitir edição anual', async () => {
    const campos = await abrirAnalise();
    preencher();
    fireEvent.click(within(campos).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(celulas('(−) Deduções Custo Seguros')[2]).toBe('-R$1.751,00'));
    fireEvent.click(screen.getByRole('button', { name: 'Out' }));
    await waitFor(() => expect(screen.getByLabelText('Deduções Custos Seguros - Novos')).toHaveValue('10'));
    fireEvent.click(screen.getByRole('button', { name: 'Nov' }));
    await waitFor(() => expect(screen.getByLabelText('Deduções Custos Seguros - Novos')).toHaveValue('1250,75'));
    fireEvent.click(screen.getByRole('button', { name: 'Ano todo' }));
    await waitFor(() => expect(celulas('(−) Deduções Custo Seguros')).toEqual(['-R$1.260,75', '-R$520,25', '-R$1.781,00']));
    expect(screen.queryByLabelText('Deduções Custos Seguros - Novos')).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Deduções Custos Seguros' })).queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });

  it('mantém o resultado anterior e notifica falha se a gravação não concluir', async () => {
    const campos = await abrirAnalise();
    const antes = celulas('(=) Resultado da Operação');
    vi.mocked(setAnaliseDeducaoSeguros).mockRejectedValueOnce(new Error('Sem conexão'));
    preencher();
    fireEvent.click(within(campos).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao salvar as deduções de custos de seguros.'));
    expect(celulas('(=) Resultado da Operação')).toEqual(antes);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('mostra erro de leitura sem apresentar custos zerados como sucesso e permite recarregar', async () => {
    await abrirAnalise();
    vi.mocked(getAnaliseDeducaoSeguros).mockRejectedValueOnce(new Error('Sem conexão'));
    fireEvent.click(screen.getByRole('button', { name: 'Out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a análise de resultado.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('group', { name: 'Deduções Custos Seguros' });
    expect(celulas('(−) Deduções Custo Seguros')).toEqual(['-R$10,00', '-R$20,00', '-R$30,00']);
  });

  it('mantém os custos somente para leitura quando o usuário não é administrador', async () => {
    auth.admin = false;
    const campos = await abrirAnalise();
    expect(within(campos).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(campos).queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });
});
