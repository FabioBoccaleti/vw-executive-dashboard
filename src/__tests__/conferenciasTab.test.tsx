import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { aplicarModeloDfcPadrao, cadastroVazio } from '@/components/FluxoCaixaDashboard/DemonstracoesFinanceiras/modelo';
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

  it('exibe diferenças em reais com milhar e centavos nos resumos do painel', async () => {
    mocks.raw.mockResolvedValue({ rawText: 'A;1.1.1.01;Caixa;0;5.796,00;0;0' });
    render(<ConferenciasTab selectedYear={2026} selectedMonth={1} cadastro={cadastroVazio()} />);
    const titulo = await screen.findByText('1. Balancete fecha');
    const fechamento = within(titulo.closest('details')!);
    expect(await fechamento.findByText('Débitos R$ 5.796,00; créditos R$ 0,00; diferença R$ 5.796,00; soma dos saldos R$ 0,00.'))
      .toBeInTheDocument();
    expect(fechamento.getByText('Erro')).toBeInTheDocument();
  });

  it.each([[22400000, '12%'], [22500000, '12,5%']] as const)('exibe a variação de %s como percentual %s, não como fração', async (valorAtual, percentual) => {
    const cadastro = {
      ...cadastroVazio(),
      linhas: [{
        id: 'receita', nome: 'Receita', demonstracao: 'dre' as const, tipo: 'contas' as const,
        itens: [{ referencia: '3.1.01', operacao: 1 as const }],
      }],
    };
    mocks.raw.mockImplementation(async (ano: number, mes: number) => ano === 2026 && mes >= 1 && mes <= 4
      ? { rawText: `R;3.1.01;Receita;0;0;${mes === 4 ? valorAtual : 20000000};0` } : null);
    render(<ConferenciasTab selectedYear={2026} selectedMonth={4} cadastro={cadastro} />);
    const titulo = await screen.findByText('12. Alertas de sinal, PL, variação e arrendamento');
    const alertas = within(titulo.closest('details')!);
    expect(alertas.getByText(content => content.endsWith(`percentual ${percentual}`))).toBeInTheDocument();
  });

  it('mostra efeitos por conta e o valor não explicado por método da DFC no item 9', async () => {
    const padrao = aplicarModeloDfcPadrao(cadastroVazio());
    const cadastro = { ...padrao, linhas: padrao.linhas.map(linha => ({
      ...linha, itens: linha.itens.filter(item => !item.referencia.startsWith('1.1.2')),
    })) };
    mocks.raw.mockResolvedValue({ rawText: 'A;1.1.1.01;Caixa;100;0;25;65\nA;1.1.2.01;Estoques;0;25;0;25\nP;2.3.1.01;Capital;-100;0;0;-100' });
    render(<ConferenciasTab selectedYear={2026} selectedMonth={1} cadastro={cadastro} />);
    const titulo = await screen.findByText('9. Contas sem classificação ou duplicadas');
    const classificacao = within(titulo.closest('details')!);
    expect(classificacao.getByText('Efeito na diferença do item 6')).toBeInTheDocument();
    expect(classificacao.getAllByText('Diferença do item 6: R$ 35,00 · efeitos das contas sem linha: R$ 25,00 · valor não explicado: R$ 10,00'))
      .toHaveLength(2);
    const linha = within(classificacao.getByText('DFC Direta — com movimento').closest('tr')!);
    expect(linha.getByText('1.1.2.01')).toBeInTheDocument();
    expect(linha.getByText('-R$ 25,00')).toBeInTheDocument();
    expect(classificacao.getByText('Erro')).toBeInTheDocument();
  });

  it('mostra sinais invertidos abaixo do limite e destaca os maiores sem ocultar os saldos originais', async () => {
    mocks.get.mockImplementation(async (key: string) => key === 'fluxo_caixa_demonstracoes_conferencias'
      ? { ...CONFERENCIAS_CONFIG_PADRAO, limiteSinalCentavos: 200 } : null);
    mocks.raw.mockResolvedValue({ rawText: 'A;1.1.3.01.03.003;Débitos por devolução;-1,05;0;0;-1,05\nP;2.1.4.01;Contingência devedora;2,50;0;0;2,50' });
    render(<ConferenciasTab selectedYear={2026} selectedMonth={1} cadastro={cadastroVazio()} />);
    const titulo = await screen.findByText('12. Alertas de sinal, PL, variação e arrendamento');
    const alertas = within(titulo.closest('details')!);
    expect(await alertas.findByText('1.1.3.01.03.003')).toBeInTheDocument();
    expect(alertas.getByText('2.1.4.01')).toBeInTheDocument();
    expect(alertas.getByText('Esperada credora · Acima do limite de destaque')).toBeInTheDocument();
    expect(alertas.getByText('Esperada devedora')).toBeInTheDocument();
    expect(alertas.getAllByText('-R$ 1,05').length).toBeGreaterThan(0);
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
      estado: 'erro', resumo: expect.stringContaining('soma dos saldos R$\u00a010,00'),
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
