import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kvGet, kvSet } from '@/lib/kvClient';
import {
  loadPinheirosContasFixas,
  savePinheirosContasFixas,
} from '@/components/BaseGerencialDashboard/baseGerencialStorage';

vi.mock('@/lib/kvClient', () => ({ kvGet: vi.fn(), kvSet: vi.fn() }));
const KEY = 'basege:pinheiros:contas-fixas';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(kvGet).mockResolvedValue(null);
  vi.mocked(kvSet).mockResolvedValue(true);
});

describe('Seleção compartilhada de despesas fixas de Pinheiros', () => {
  it('começa vazia quando nunca foi configurada e carrega por uma chave única sem período ou usuário', async () => {
    expect(await loadPinheirosContasFixas()).toEqual([]);
    expect(kvGet).toHaveBeenCalledExactlyOnceWith(KEY, { throwOnError: true });
    vi.mocked(kvGet).mockResolvedValue(['5510101003']);
    expect(await loadPinheirosContasFixas()).toEqual(['5510101003']);
  });

  it('salva e restaura códigos, removendo duplicações e permitindo seleção vazia', async () => {
    let persisted: unknown = null;
    vi.mocked(kvGet).mockImplementation(async () => persisted);
    vi.mocked(kvSet).mockImplementation(async (_, value) => { persisted = value; return true; });
    await savePinheirosContasFixas(['5510101003', '5510101003', '5520101001']);
    expect(kvSet).toHaveBeenCalledWith(KEY, ['5510101003', '5520101001']);
    expect(await loadPinheirosContasFixas()).toEqual(['5510101003', '5520101001']);
    await savePinheirosContasFixas([]);
    expect(await loadPinheirosContasFixas()).toEqual([]);
  });

  it('propaga erros de leitura e gravação, inclusive retorno falso de kvSet', async () => {
    vi.mocked(kvGet).mockRejectedValue(new Error('Falha de leitura'));
    await expect(loadPinheirosContasFixas()).rejects.toThrow('Falha de leitura');
    vi.mocked(kvSet).mockResolvedValue(false);
    await expect(savePinheirosContasFixas(['5510101003'])).rejects.toThrow('Não foi possível salvar');
    vi.mocked(kvSet).mockRejectedValue(new Error('Falha de gravação'));
    await expect(savePinheirosContasFixas([])).rejects.toThrow('Falha de gravação');
  });

  it.each([{}, ['CONTA INVÁLIDA'], [123], '5510101003'])('rejeita configuração inválida: %j', async value => {
    vi.mocked(kvGet).mockResolvedValue(value);
    await expect(loadPinheirosContasFixas()).rejects.toThrow('Seleção de despesas fixas de Pinheiros inválida');
  });
});
