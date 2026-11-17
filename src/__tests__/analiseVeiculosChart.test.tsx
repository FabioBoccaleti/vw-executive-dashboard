import { cloneElement, type ReactElement } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnaliseVeiculosTab } from '@/components/EstoqueUsadosVwDashboard/AnaliseVeiculosTab';
import {
  getInventarioVeiculos,
  getLatestMonthVeiculos,
  type VeiculoRow,
} from '@/components/EstoqueUsadosVwDashboard/veiculosStorage';

vi.mock('@/components/EstoqueUsadosVwDashboard/veiculosStorage', () => ({
  getInventarioVeiculos: vi.fn(),
  getLatestMonthVeiculos: vi.fn(),
}));
vi.mock('@/components/EstoqueUsadosVwDashboard/veiculosExport', () => ({
  exportVeiculosExcel: vi.fn(),
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
