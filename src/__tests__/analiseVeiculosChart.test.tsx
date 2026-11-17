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

  it('mantém todas as marcas no gráfico de usados', async () => {
    render(<AnaliseVeiculosTab brand="vw" name="Usados VW" primary="#001e50" primaryLight="#e8f4fc" />);
    const heading = await screen.findByText('Veículos em estoque por marca');
    const chart = heading.parentElement!;

    expect(chart.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(12);
    expect(within(chart).getByText('MARCA 12')).toBeInTheDocument();
    expect(screen.getByText('Resumo por marca')).toBeInTheDocument();
  });
});
