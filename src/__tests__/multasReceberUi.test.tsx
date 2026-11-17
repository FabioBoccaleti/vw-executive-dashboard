import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { AnaliseMultasTab } from '@/components/MultasReceberDashboard/AnaliseMultasTab';
import { ImportacaoMultasTab } from '@/components/MultasReceberDashboard/ImportacaoMultasTab';
import { MultasReceberDashboard } from '@/components/MultasReceberDashboard/MultasReceberDashboard';
import { exportMultasExcel } from '@/components/MultasReceberDashboard/multasExport';
import {
  getMultas, getMultasBaseDate, getMultasMonths, parseMultasTxt, saveMultas, saveMultasBaseDate,
} from '@/components/MultasReceberDashboard/multasStorage';

vi.mock('@/components/MultasReceberDashboard/multasStorage', async original => ({
  ...await original<typeof import('@/components/MultasReceberDashboard/multasStorage')>(),
  getMultas: vi.fn(), getMultasBaseDate: vi.fn(), getMultasMonths: vi.fn(),
  saveMultas: vi.fn(), saveMultasBaseDate: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/MultasReceberDashboard/multasExport', () => ({ exportMultasExcel: vi.fn() }));
vi.mock('recharts', async original => ({
  ...await original<typeof import('recharts')>(),
  ResponsiveContainer: () => null,
}));

const txt = [
  'DEPARTAMENTO;NOME_DEPARTAMENTO;CLIENTE;NOME_CLIENTE;TITULO;VENCIDO;AVENCER;DTA_VENCIMENTO;',
  '102;USADOS;1;CLIENTE TESTE A;111;100;;16/11/2026;',
  '301;ADMIN;2;CLIENTE TESTE B;222;;200;18/11/2026;',
].join('\n');
const imported = { ...parseMultasTxt(txt), month: '2026-11', fileName: 'teste.txt', importedAt: 0 };
const brl = (text: string | null) => text?.replace(/\s/g, '');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMultas).mockResolvedValue(imported);
  vi.mocked(getMultasMonths).mockResolvedValue(['2026-11', '2026-10']);
  vi.mocked(getMultasBaseDate).mockResolvedValue('2026-11-17');
  vi.mocked(saveMultas).mockResolvedValue(undefined);
  vi.mocked(saveMultasBaseDate).mockResolvedValue(undefined);
  vi.mocked(exportMultasExcel).mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Multas a Receber — interface consolidada', () => {
  it('mostra apenas as duas abas solicitadas, sem cadastro nem marcas', async () => {
    const onBack = vi.fn();
    render(<MultasReceberDashboard onBack={onBack} />);
    await screen.findByRole('region', { name: 'Total a receber' });
    expect(screen.getAllByRole('tab').map(tab => tab.textContent?.trim())).toEqual(['Importação de Arquivo', 'Análise']);
    expect(screen.queryByText('Audi')).not.toBeInTheDocument();
    expect(screen.queryByText('VW')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumo por departamento' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('restaura e salva a data-base, recalcula vencimento e filtra os títulos', async () => {
    render(<AnaliseMultasTab />);
    const total = await screen.findByRole('region', { name: 'Total a receber' });
    expect(brl(total.textContent)).toContain('R$300,00');
    expect(brl(screen.getByRole('region', { name: 'Vencido' }).textContent)).toContain('R$100,00');
    expect(screen.getByRole('button', { name: 'Salvo' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Data-base (cálculo dos dias)'), { target: { value: '2026-11-19' } });
    expect(brl(screen.getByRole('region', { name: 'Vencido' }).textContent)).toContain('R$300,00');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(saveMultasBaseDate).toHaveBeenCalledWith('2026-11', '2026-11-19'));
    await screen.findByRole('button', { name: 'Salvo' });
    fireEvent.change(screen.getByLabelText('Buscar títulos'), { target: { value: '111' } });
    const details = screen.getByRole('region', { name: 'Títulos detalhados' });
    expect(within(details).getByText('CLIENTE TESTE A')).toBeInTheDocument();
    expect(within(details).queryByText('CLIENTE TESTE B')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Departamento'), { target: { value: 'ADMIN' } });
    expect(brl(total.textContent)).toContain('R$200,00');
    fireEvent.click(screen.getByRole('button', { name: 'CLIENTE TESTE B' }));
    expect(within(details).getByText('CLIENTE TESTE B')).toBeInTheDocument();
    expect(within(details).queryByText('CLIENTE TESTE A')).not.toBeInTheDocument();
    vi.mocked(getMultasBaseDate).mockResolvedValueOnce('2026-10-25');
    fireEvent.change(screen.getByLabelText('Mês de referência'), { target: { value: '2026-10' } });
    await screen.findByRole('region', { name: 'Total a receber' });
    expect(getMultasBaseDate).toHaveBeenLastCalledWith('2026-10');
    expect(screen.getByLabelText('Data-base (cálculo dos dias)')).toHaveValue('2026-10-25');
  });

  it('não indica salvo quando a gravação falha e permite tentar novamente', async () => {
    vi.mocked(saveMultasBaseDate).mockRejectedValueOnce(new Error('Falha ao salvar'));
    render(<AnaliseMultasTab />);
    await screen.findByRole('region', { name: 'Total a receber' });
    fireEvent.change(screen.getByLabelText('Data-base (cálculo dos dias)'), { target: { value: '2026-11-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falha ao salvar'));
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Salvo' })).not.toBeInTheDocument();
  });

  it('exporta o mês completo com a data-base selecionada, mesmo com filtros, e bloqueia cliques durante a geração', async () => {
    let finish!: () => void;
    vi.mocked(exportMultasExcel).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<AnaliseMultasTab />);
    await screen.findByRole('region', { name: 'Total a receber' });
    fireEvent.change(screen.getByLabelText('Data-base (cálculo dos dias)'), { target: { value: '2026-11-19' } });
    fireEvent.change(screen.getByLabelText('Departamento'), { target: { value: 'ADMIN' } });
    fireEvent.change(screen.getByLabelText('Buscar títulos'), { target: { value: '222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
    expect(screen.getByRole('button', { name: 'Gerando...' })).toBeDisabled();
    expect(exportMultasExcel).toHaveBeenCalledOnce();
    expect(exportMultasExcel).toHaveBeenCalledWith({
      month: '2026-11',
      referenceDate: new Date(2026, 10, 19),
      titulos: [
        expect.objectContaining({ titulo: '111', valor: 100, vencido: true, diasAtraso: 3 }),
        expect.objectContaining({ titulo: '222', valor: 200, vencido: true, diasAtraso: 1 }),
      ],
    });
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar Excel' })).toBeEnabled());
  });

  it('notifica erro na exportação e permite tentar novamente', async () => {
    vi.mocked(exportMultasExcel).mockRejectedValueOnce(new Error('Falha ao gerar arquivo'));
    render(<AnaliseMultasTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Exportar Excel' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao gerar o Excel de multas.'));
    expect(screen.getByRole('button', { name: 'Exportar Excel' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
    await waitFor(() => expect(exportMultasExcel).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar Excel' })).toBeEnabled());
  });

  it('importa TXT e só apresenta sucesso após persistir os dados', async () => {
    vi.mocked(getMultas).mockResolvedValue(null);
    render(<ImportacaoMultasTab />);
    await screen.findByText('Nenhuma posição de multas importada para este mês.');
    const month = screen.getByLabelText('Mês de referência');
    fireEvent.change(month, { target: { value: '2026-11' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Importar Multas a Receber (TXT)' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Arquivo TXT de multas'), {
      target: { files: [new File([txt], 'teste.txt', { type: 'text/plain' })] },
    });
    await waitFor(() => expect(saveMultas).toHaveBeenCalledWith(expect.objectContaining({ month: '2026-11', fileName: 'teste.txt', rows: imported.rows })));
    await screen.findByText('2 títulos');
    expect(toast.success).toHaveBeenCalledWith('2 títulos importados com sucesso.');
  });

  it('exibe falha de leitura com tentativa novamente, sem apresentar análise vazia como sucesso', async () => {
    vi.mocked(getMultas).mockRejectedValueOnce(new Error('Sem conexão'));
    render(<AnaliseMultasTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('region', { name: 'Total a receber' });
  });

  it('mantém a posição anterior e notifica falha quando o TXT não pode ser salvo', async () => {
    vi.mocked(saveMultas).mockRejectedValueOnce(new Error('Não foi possível salvar as multas.'));
    render(<ImportacaoMultasTab />);
    await screen.findByText('2 títulos');
    fireEvent.change(screen.getByLabelText('Arquivo TXT de multas'), {
      target: { files: [new File([txt], 'novo.txt', { type: 'text/plain' })] },
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar as multas.'));
    expect(screen.getByText(/teste\.txt/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
