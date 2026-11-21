import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { cadastroVazio } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import { ConferenciasTab } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/ConferenciasTab';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  keys: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  compareAndSet: vi.fn(),
  raw: vi.fn(),
}));

vi.mock('@/lib/kvClient', () => ({
  kvGet: mocks.get,
  kvKeys: mocks.keys,
  kvSet: mocks.set,
  kvDelete: mocks.delete,
  kvCompareAndSet: mocks.compareAndSet,
}));

vi.mock('@/components/FluxoCaixaDashboard/fluxoCaixaStorage', () => ({
  loadFluxoCaixaRaw: mocks.raw,
}));

describe('ConferenciasTab', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue(null);
    mocks.keys.mockReset().mockResolvedValue([]);
    mocks.set.mockReset().mockResolvedValue(true);
    mocks.delete.mockReset().mockResolvedValue(true);
    mocks.compareAndSet.mockReset().mockResolvedValue(undefined);
    mocks.raw.mockReset().mockImplementation(async (ano: number, mes: number) =>
      ano === 2026 && mes === 1
        ? { rawText: 'A;1.1.1.01;Caixa;0,00;0,00;0,00;0,00', timestamp: 1000 }
        : null);
  });

  afterEach(cleanup);

  it('carrega o balancete e exibe as conferências com semáforo', async () => {
    render(<ConferenciasTab selectedYear={2026} selectedMonth={1} cadastro={cadastroVazio()} />);

    expect(await screen.findByText('Painel de conferências · 01/2026')).toBeInTheDocument();
    expect(await screen.findByText('1. Balancete fecha')).toBeInTheDocument();
    expect(screen.getByText('9. Contas sem classificação ou duplicadas')).toBeInTheDocument();
    expect(screen.getByText('12. Alertas de sinal, PL, variação e arrendamento')).toBeInTheDocument();
  });
});
