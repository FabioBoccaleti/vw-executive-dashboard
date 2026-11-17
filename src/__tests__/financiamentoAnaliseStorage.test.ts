import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kvGet, kvSet } from '@/lib/kvClient';
import { getAnaliseDeducaoSeguros, setAnaliseDeducaoSeguros } from '@/components/VendasBonificacoesDashboard/financiamentoAnaliseStorage';

vi.mock('@/lib/kvClient', () => ({ kvGet: vi.fn(), kvSet: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(kvGet).mockResolvedValue(null);
  vi.mocked(kvSet).mockResolvedValue(true);
});

describe('deduções de custos de seguros por período', () => {
  it('salva Novos/Usados em chave própria, isolada por mês e ano, e carrega o mesmo valor', async () => {
    const valor = { novos: 1250.75, usados: 500.25 };
    await setAnaliseDeducaoSeguros(2026, 11, valor);
    await setAnaliseDeducaoSeguros(2026, 10, { novos: 10, usados: 20 });
    await setAnaliseDeducaoSeguros(2025, 11, { novos: 30, usados: 40 });
    expect(vi.mocked(kvSet).mock.calls.map(([key]) => key)).toEqual([
      'financiamento_analise:deducao_custo_seguros:2026:11',
      'financiamento_analise:deducao_custo_seguros:2026:10',
      'financiamento_analise:deducao_custo_seguros:2025:11',
    ]);
    vi.mocked(kvGet).mockResolvedValue(valor);
    expect(await getAnaliseDeducaoSeguros(2026, 11)).toEqual(valor);
    expect(kvGet).toHaveBeenCalledWith('financiamento_analise:deducao_custo_seguros:2026:11', { throwOnError: true });
  });

  it('considera zero quando não há lançamento, mas não mascara erros de leitura', async () => {
    expect(await getAnaliseDeducaoSeguros(2026, 11)).toEqual({ novos: 0, usados: 0 });
    const erro = new Error('Sem conexão');
    vi.mocked(kvGet).mockRejectedValueOnce(erro);
    await expect(getAnaliseDeducaoSeguros(2026, 11)).rejects.toBe(erro);
  });

  it('não informa sucesso quando o KV recusa a gravação', async () => {
    vi.mocked(kvSet).mockResolvedValue(false);
    await expect(setAnaliseDeducaoSeguros(2026, 11, { novos: 10, usados: 20 }))
      .rejects.toThrow('Erro ao salvar as deduções de custos de seguros.');
  });
});
