import { cloneElement, type ReactElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnaliseVeiculosTab } from '@/components/EstoqueUsadosVwDashboard/AnaliseVeiculosTab';
import {
  getInventarioVeiculos,
  getLatestMonthVeiculos,
  type VeiculoRow,
} from '@/components/EstoqueUsadosVwDashboard/veiculosStorage';
import { exportVeiculosExcel } from '@/components/EstoqueUsadosVwDashboard/veiculosExport';
import { getVeiculos, type VeiculoGrade } from '@/components/VendasBonificacoesDashboard/GradeTestDriveAudi/gradeTestDriveStorage';

vi.mock('@/components/EstoqueUsadosVwDashboard/veiculosStorage', () => ({
  getInventarioVeiculos: vi.fn(),
  getLatestMonthVeiculos: vi.fn(),
}));
vi.mock('@/components/EstoqueUsadosVwDashboard/veiculosExport', () => ({
  exportVeiculosExcel: vi.fn(),
}));
vi.mock('@/components/VendasBonificacoesDashboard/GradeTestDriveAudi/gradeTestDriveStorage', async original => ({
  ...await original<typeof import('@/components/VendasBonificacoesDashboard/GradeTestDriveAudi/gradeTestDriveStorage')>(),
  getVeiculos: vi.fn(),
}));
vi.mock('recharts', async importOriginal => ({
  ...await importOriginal<typeof import('recharts')>(),
  ResponsiveContainer: ({ children, height }: {
    children: ReactElement<{ width: number; height: number }>;
    height: number;
  }) => cloneElement(children, { width: 800, height }),
}));

const carros = ['T-CROSS', 'POLO', 'NIVUS', 'TERA', 'TAOS', 'TIGUAN', 'JETTA', 'VIRTUS', 'AMAROK', 'SAVEIRO', 'GOLF', 'GOL'];
const modelos = carros.map(carro => `NOVO ${carro} HIGHLINE TSI`);
const veiculos: VeiculoRow[] = modelos.flatMap((modelo, i) =>
  Array.from({ length: 12 - i }, (_, j) => ({
    veiculo: `${i}-${j}`,
    chassi: `CHASSI-${i}-${j}`,
    modelo,
    marca: `MARCA ${i + 1}`,
    nf: '',
    identificacao: '',
    entrada: '2026-11-01',
    valor: 100_000,
  })));
veiculos.push({ ...veiculos[0], veiculo: 'extra', chassi: 'OUTRA-VERSAO', modelo: 'VW T-CROSS COMFORTLINE 200 TSI' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVeiculos).mockResolvedValue([]);
  vi.mocked(getLatestMonthVeiculos).mockResolvedValue('2026-11');
  vi.mocked(getInventarioVeiculos).mockImplementation(async (_, month) =>
    month === '2026-11'
      ? { month, fileName: 'estoque.xlsx', importedAt: 0, headers: [], rows: [], veiculos }
      : null);
});
afterEach(cleanup);

describe('apresentação do gráfico de estoque', () => {
  it('agrupa versões no gráfico e resumo sem limitar a dez e expande as descrições completas', async () => {
    render(<AnaliseVeiculosTab brand="vw_novos" name="Novos VW" primary="#001e50" primaryLight="#e8f4fc" />);
    const heading = await screen.findByText('Veículos em estoque por modelo');
    const chart = heading.parentElement!;
    const labels = Array.from(chart.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value'));

    expect(labels.map(label => label.textContent)).toEqual(carros);
    expect(chart.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(12);
    const summary = screen.getByText('Resumo por modelo').parentElement!;
    expect(within(summary).getByText('GOL')).toBeInTheDocument();
    expect(within(summary).getAllByRole('row')).toHaveLength(13);
    const row = within(summary).getByText('T-CROSS').closest('tr')!;
    expect(within(row).getAllByRole('cell').map(cell => cell.textContent?.replace(/\s/g, ''))).toEqual([
      'T-CROSS', '13', 'R$1.300.000,00',
    ]);
    fireEvent.click(row);
    expect(within(summary).getAllByText('NOVO T-CROSS HIGHLINE TSI')).toHaveLength(12);
    expect(within(summary).getByText('VW T-CROSS COMFORTLINE 200 TSI')).toBeInTheDocument();
    expect(within(summary).queryByText('NOVO POLO HIGHLINE TSI')).not.toBeInTheDocument();
  });

  it('apresenta novos Audi por carro e expande as versões completas', async () => {
    const audiVeiculos = [
      { ...veiculos[0], modelo: 'AUDI Q3 PERFORMANCE', valor: 200_000 },
      { ...veiculos[1], modelo: 'Q3 SPORTBACK S LINE', valor: 300_000 },
      { ...veiculos[2], modelo: 'AUDI A3 SEDAN', valor: 150_000 },
    ];
    vi.mocked(getInventarioVeiculos).mockImplementation(async (_, month) =>
      month === '2026-11'
        ? { month, fileName: 'audi.xlsx', importedAt: 0, headers: [], rows: [], veiculos: audiVeiculos }
        : null);
    render(<AnaliseVeiculosTab brand="audi_novos" name="Novos Audi" primary="#bb0a30" primaryLight="#fce8ec" />);
    const heading = await screen.findByText('Veículos em estoque por modelo');
    const chart = heading.parentElement!;
    const labels = Array.from(chart.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value'));
    expect(labels.map(label => label.textContent)).toEqual(['Q3', 'A3']);
    const summary = screen.getByText('Resumo por modelo').parentElement!;
    fireEvent.click(within(summary).getByText('Q3'));
    expect(within(summary).getByText('AUDI Q3 PERFORMANCE')).toBeInTheDocument();
    expect(within(summary).getByText('Q3 SPORTBACK S LINE')).toBeInTheDocument();
    expect(getLatestMonthVeiculos).toHaveBeenLastCalledWith('audi_novos');
    expect(getInventarioVeiculos).toHaveBeenCalledWith('audi_novos', '2026-11');
  });

  it.each(['vw', 'audi'] as const)('mantém todas as marcas no gráfico de usados %s', async brand => {
    render(<AnaliseVeiculosTab brand={brand} name="Usados" primary="#001e50" primaryLight="#e8f4fc" />);
    const heading = await screen.findByText('Veículos em estoque por marca');
    const chart = heading.parentElement!;

    expect(chart.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(12);
    expect(within(chart).getByText('MARCA 12')).toBeInTheDocument();
    expect(screen.getByText('Resumo por marca')).toBeInTheDocument();
    expect(screen.queryByText('Veículos pagos em Estoque')).not.toBeInTheDocument();
    expect(getVeiculos).not.toHaveBeenCalled();
  });

  describe('estoque de Novos Audi separado da Grade', () => {
    const novos = { ...veiculos[0], veiculo: 'novo', chassi: 'VIN-NOVO', modelo: 'AUDI A3 NOVO', entrada: '2026-06-03', valor: 100 };
    const testDrive = { ...veiculos[0], veiculo: 'td', chassi: 'vin-td', modelo: 'AUDI Q5 TEST DRIVE', entrada: '2026-01-01', valor: 200 };
    const courtesy = { ...veiculos[0], veiculo: 'cc', chassi: 'VIN-CC', modelo: 'AUDI Q7 COURTESY', entrada: null, valor: 300 };
    function registro(chassi: string, classificacao: VeiculoGrade['classificacao'], vendido = false): VeiculoGrade {
      return {
        id: chassi, chassi, modelo: 'Q5', classificacao, vendido, dataVenda: vendido ? '2026-12-01' : null,
        dataCompra: '2026-01-01', valorCompra: 9999, condicaoPagamento: 'a_vista', dataVencimentoPagamento: null,
        valorVenda: null, valorImpostos: null, creditoICMS: null, custoEmplacamento: null,
        custoIPVA: null, jurosEstoque: null, cortesia: null, criadoEm: '',
      };
    }
    function mockAudi(itens = [novos, testDrive, courtesy]) {
      vi.mocked(getVeiculos).mockResolvedValue([
        registro(' VIN-TD ', 'test_drive', true),
        registro('VIN-CC', 'courtesy_car'),
        registro('FORA-DO-ESTOQUE', 'test_drive'),
      ]);
      vi.mocked(getInventarioVeiculos).mockImplementation(async (_, month) => ({
        month, fileName: 'audi.xlsx', importedAt: 0, headers: [], rows: [],
        veiculos: month === '2026-11' ? itens : [{ ...novos, valor: 80 }, { ...testDrive, valor: 400 }],
      }));
    }
    const audi = <AnaliseVeiculosTab brand="audi_novos" name="Novos Audi" primary="#bb0a30" primaryLight="#fce8ec" />;
    const card = (label: string) => screen.getByText(label).parentElement!.parentElement!;
    const compact = (element: HTMLElement) => element.textContent?.replace(/\s/g, '');

    it('concilia cards, separa vendidos cadastrados e exclui a Grade dos indicadores, gráficos, tabelas e comparação', async () => {
      mockAudi();
      render(audi);
      await screen.findByRole('region', { name: 'Composição do estoque' });
      expect(compact(card('Estoque total'))).toContain('R$600,003veículos');
      expect(compact(card('Estoque de Novos'))).toContain('R$100,001veículonovo');
      expect(compact(card('Estoque de Test Drive / Courtesy Car'))).toContain('R$500,002veículos');
      expect(compact(card('Ticket médio'))).toContain('R$100,00');
      expect(card('Idade média')).toHaveTextContent('180 dias');
      expect(card('Parados (> 90 dias)').querySelector('p')).toHaveTextContent('1');
      const pagos = screen.getByRole('region', { name: 'Veículos pagos em Estoque' });
      expect(within(pagos).getByText(novos.chassi)).toBeInTheDocument();
      expect(within(pagos).queryByText(testDrive.chassi)).not.toBeInTheDocument();
      const tabelaGrade = screen.getByRole('region', { name: 'Veículos Test Drive / Courtesy Car' });
      expect(within(tabelaGrade).getByText('Test Drive')).toBeInTheDocument();
      expect(within(tabelaGrade).getByText('Courtesy Car')).toBeInTheDocument();
      expect(compact(tabelaGrade)).toContain('Total:R$500,00');
      expect(screen.getAllByText(testDrive.modelo)).toHaveLength(1);
      expect(screen.getAllByText(courtesy.modelo)).toHaveLength(1);
      const chart = screen.getByText('Veículos em estoque por modelo').parentElement!;
      expect(Array.from(chart.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value')).map(el => el.textContent)).toEqual(['A3']);
      expect(screen.getByText('Variação vs mês anterior').parentElement!.parentElement).toHaveTextContent('Anterior: R$ 80,00');
      expect(getVeiculos).toHaveBeenCalledWith({ throwOnError: true });
      fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
      await waitFor(() => expect(exportVeiculosExcel).toHaveBeenCalledWith(expect.objectContaining({
        analise: expect.objectContaining({ totalVeiculos: 1, totalValor: 100, itens: [expect.objectContaining({ chassi: novos.chassi })] }),
        testDrive: [
          expect.objectContaining({ chassi: testDrive.chassi, classificacao: 'test_drive', valor: 200 }),
          expect.objectContaining({ chassi: courtesy.chassi, classificacao: 'courtesy_car', valor: 300 }),
        ],
      })));
    });

    it('mantém a análise acessível quando todo o estoque é Test Drive / Courtesy Car', async () => {
      mockAudi([testDrive, courtesy]);
      render(audi);
      await screen.findByRole('region', { name: 'Composição do estoque' });
      expect(compact(card('Estoque total'))).toContain('R$500,00');
      expect(compact(card('Estoque de Novos'))).toContain('R$0,000veículosnovos');
      expect(screen.getByRole('region', { name: 'Veículos Test Drive / Courtesy Car' })).toHaveTextContent(testDrive.modelo);
      expect(screen.queryByText('Nenhum inventário disponível para análise.')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Exportar Excel' })).toBeEnabled();
    });

    it('bloqueia a análise se a Grade falhar e permite recarregar sem assumir veículos novos', async () => {
      mockAudi();
      vi.mocked(getVeiculos).mockRejectedValueOnce(new Error('Grade indisponível'));
      const { container } = render(audi);
      expect(await screen.findByRole('alert')).toHaveTextContent('A separação do estoque não pode ser calculada.');
      expect(screen.queryByRole('button', { name: 'Exportar Excel' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      await screen.findByRole('region', { name: 'Composição do estoque' });
      expect(compact(card('Estoque de Novos'))).toContain('R$100,00');
      vi.mocked(getVeiculos).mockRejectedValueOnce(new Error('Grade indisponível em outubro'));
      fireEvent.change(container.querySelector<HTMLInputElement>('input[type="month"]')!, { target: { value: '2026-10' } });
      await screen.findByRole('alert');
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      await screen.findByRole('region', { name: 'Composição do estoque' });
      expect(container.querySelector('input[type="month"]')).toHaveValue('2026-10');
    });

    it('não consulta nem separa a Grade no estoque de Novos VW', async () => {
      mockAudi();
      render(<AnaliseVeiculosTab brand="vw_novos" name="Novos VW" primary="#001e50" primaryLight="#e8f4fc" />);
      await screen.findByText('Veículos em estoque por modelo');
      expect(getVeiculos).not.toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: 'Composição do estoque' })).not.toBeInTheDocument();
      expect(compact(card('Valor total em estoque'))).toContain('R$600,00');
    });
  });
});

describe.each(['vw_novos', 'audi_novos'] as const)('veículos pagos em estoque de %s', brand => {
  function mockInventarioPago() {
    const itens = [
      { modelo: 'POLO TRACK 179', entrada: '2026-06-04', valor: 100 },
      { modelo: 'T-CROSS HIGHLINE 180', entrada: '2026-06-03', valor: 200 },
      { modelo: 'NIVUS COMFORTLINE 181', entrada: '2026-06-02', valor: 300 },
      { modelo: 'TERA SEM DATA', entrada: null, valor: 400 },
      { modelo: 'JETTA SEM VALOR', entrada: '2026-01-01', valor: 0 },
    ].map((item, i) => ({ ...veiculos[0], ...item, veiculo: String(i), chassi: `VIN-${i}` }));
    vi.mocked(getInventarioVeiculos).mockImplementation(async (_, month) =>
      month === '2026-11'
        ? { month, fileName: 'estoque.xlsx', importedAt: 0, headers: [], rows: [], veiculos: itens }
        : null);
  }

  it('inclui exatamente 180 dias e mantém card e tabela consistentes ao mudar os dias da análise', async () => {
    mockInventarioPago();
    const { container } = render(
      <AnaliseVeiculosTab brand={brand} name="Novos" primary="#001e50" primaryLight="#e8f4fc" />);
    const section = await screen.findByRole('region', { name: 'Veículos pagos em Estoque' });
    const table = within(section).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
      'Modelo', 'Chassi', 'Dias', 'Valor',
    ]);
    expect(within(table).getAllByRole('row').slice(1).map(row =>
      within(row).getAllByRole('cell').map(cell => cell.textContent?.replace(/\s/g, '')))).toEqual([
      ['NIVUSCOMFORTLINE181', 'VIN-2', '181', 'R$300,00'],
      ['T-CROSSHIGHLINE180', 'VIN-1', '180', 'R$200,00'],
    ]);
    const kpi = screen.getAllByText('Veículos pagos em Estoque').find(el => !section.contains(el))!.parentElement!.parentElement!;
    const [valorPrincipal, quantidadeSecundaria] = kpi.querySelectorAll('p');
    expect(valorPrincipal.textContent?.replace(/\s/g, '')).toBe('R$500,00');
    expect(quantidadeSecundaria).toHaveTextContent('2 veículos · 180 dias ou mais');
    expect(section.previousElementSibling).toHaveTextContent('Top modelos em estoque');

    const threshold = container.querySelector<HTMLInputElement>('input[type="number"]')!;
    fireEvent.change(threshold, { target: { value: '365' } });
    fireEvent.blur(threshold);
    expect(within(table).getAllByRole('row')).toHaveLength(3);

    const baseDate = container.querySelector<HTMLInputElement>('input[type="date"]')!;
    fireEvent.change(baseDate, { target: { value: '2026-11-29' } });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).queryByText('T-CROSS HIGHLINE 180')).not.toBeInTheDocument();
    expect(valorPrincipal.textContent?.replace(/\s/g, '')).toBe('R$300,00');
    expect(quantidadeSecundaria).toHaveTextContent('1 veículo · 180 dias ou mais');
  });

  it('mostra card zerado e mensagem explícita quando não há veículos elegíveis', async () => {
    render(<AnaliseVeiculosTab brand={brand} name="Novos" primary="#001e50" primaryLight="#e8f4fc" />);
    const section = await screen.findByRole('region', { name: 'Veículos pagos em Estoque' });
    expect(within(section).getByText('Nenhum veículo com 180 dias ou mais em estoque.')).toBeInTheDocument();
    expect(section.textContent?.replace(/\s/g, '')).toContain('0veículos·Total:R$0,00');
  });
});
