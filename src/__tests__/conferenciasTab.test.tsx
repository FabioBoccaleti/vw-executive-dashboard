import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { cadastroVazio } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
import { ConferenciasTab } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/ConferenciasTab';
import { carregarConferenciasExportacao, carregarConferenciasPeriodosExportacao } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/conferenciasDados';
import { CONFERENCIAS_CONFIG_PADRAO } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/conferenciasStorage';

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

  it('exporta as mesmas conferências do mês, com parâmetros salvos e referências de versões', async () => {
    const actor = { userId: 'user-1', username: 'conferente' };
    const snapshot = (id: string, importedAt: number, emittedAt?: number) => ({
      version: id, id, year: 2026, month: 3, importedAt, importedBy: actor,
      status: 'imported', chunkCount: 1, emittedAt, emittedBy: emittedAt ? actor : undefined,
    });
    const emitida = snapshot('11111111-1111-4111-8111-111111111111', 1000, 1500);
    const anterior = snapshot('22222222-2222-4222-8222-222222222222', 2000);
    const atual = snapshot('33333333-3333-4333-8333-333333333333', 3000);
    const config = { ...CONFERENCIAS_CONFIG_PADRAO, toleranciaConferenciaCentavos: 200 };
    mocks.keys.mockResolvedValue(['emitida_meta', 'anterior_meta', 'atual_meta']);
    mocks.get.mockImplementation(async (key: string) => {
      if (key === 'fluxo_caixa_demonstracoes_conferencias') return config;
      if (key === 'emitida_meta') return emitida;
      if (key === 'anterior_meta') return anterior;
      if (key === 'atual_meta') return atual;
      if (key.includes(emitida.id)) return 'A;1.1.1.01;Caixa;0;0;0;10';
      if (key.includes(anterior.id)) return 'A;1.1.1.01;Caixa;0;0;0;20';
      return null;
    });
    mocks.raw.mockImplementation(async (ano: number, mes: number) => ano === 2026 && mes === 3
      ? { rawText: 'A;1.1.1.01;Caixa;0;0;0;30', snapshotId: atual.id, timestamp: 3000 } : null);
    const exportacao = await carregarConferenciasExportacao(2026, 3, cadastroVazio());
    expect(exportacao).toMatchObject({ ano: 2026, mes: 3, config });
    expect(exportacao.resultados).toHaveLength(12);
    expect(exportacao.comparacoes.map(item => item.referencia.id)).toEqual([emitida.id, anterior.id]);
    expect(exportacao.comparacoes[0].contas[0]).toMatchObject({ antes: { saldoAtual: 10 }, depois: { saldoAtual: 30 } });
    expect(exportacao.comparacoes[1].contas[0]).toMatchObject({ antes: { saldoAtual: 20 }, depois: { saldoAtual: 30 } });
    expect(mocks.compareAndSet).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('usa o balancete anual nas conferências e não substitui pelo saldo de dezembro', async () => {
    mocks.raw.mockImplementation(async (ano: number, mes: number) => ano === 2026
      ? { rawText: `A;1.1.1.01;Caixa;0;0;0;${mes === 0 ? 10 : 0}` } : null);
    const exportacao = await carregarConferenciasExportacao(2026, 0, cadastroVazio());
    expect(exportacao.mes).toBe(0);
    expect(exportacao.resultados.find(item => item.id === 'fechamento-balancete')).toMatchObject({
      estado: 'erro', resumo: expect.stringContaining('soma dos saldos 10.00'),
    });
  });

  it('confere todos os meses dos anos comparados, preserva ausências e reutiliza as leituras', async () => {
    const exportacao = await carregarConferenciasPeriodosExportacao([2026, 2025], 2, cadastroVazio());
    expect(exportacao.map(({ ano, mes }) => [ano, mes])).toEqual([[2026, 1], [2026, 2], [2025, 1], [2025, 2]]);
    expect(exportacao.every(periodo => periodo.resultados.length === 12)).toBe(true);
    expect(exportacao[0].resultados.find(item => item.id === 'fechamento-balancete')?.estado).toBe('ok');
    expect(exportacao[1].resultados.find(item => item.id === 'fechamento-balancete')?.estado).toBe('indisponivel');
    const leituras = mocks.raw.mock.calls.map(([ano, mes]) => `${ano}_${mes}`);
    expect(new Set(leituras).size).toBe(leituras.length);
    expect(mocks.get.mock.calls.filter(([key]) => key === 'fluxo_caixa_demonstracoes_conferencias')).toHaveLength(1);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.compareAndSet).not.toHaveBeenCalled();
  });

  it('propaga a falha do histórico de qualquer mês em vez de entregar conferências parciais', async () => {
    mocks.keys.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Histórico indisponível'));
    await expect(carregarConferenciasPeriodosExportacao([2026], 2, cadastroVazio())).rejects.toThrow('Histórico indisponível');
  });
});
