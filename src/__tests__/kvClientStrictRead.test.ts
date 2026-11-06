import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('DEV', false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('KV — leitura estrita opcional', () => {
  it('mantém null para chave inexistente e retorna seleção existente em produção', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: ['5510101003'] }) });
    vi.stubGlobal('fetch', fetchMock);
    const { kvGet } = await import('@/lib/kvClient');
    expect(await kvGet('basege:pinheiros:contas-fixas', { throwOnError: true })).toBeNull();
    expect(await kvGet('basege:pinheiros:contas-fixas', { throwOnError: true })).toEqual(['5510101003']);
    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/api/kv/get?key=basege%3Apinheiros%3Acontas-fixas`
    );
  });

  it('propaga erro HTTP no modo estrito sem alterar o retorno legado de outras leituras', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { kvGet } = await import('@/lib/kvClient');
    await expect(kvGet('selecao', { throwOnError: true })).rejects.toThrow('KV GET error: 503');
    expect(await kvGet('outra-chave')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('propaga falhas de rede e de JSON apenas quando solicitado', async () => {
    const erro = new Error('Rede indisponível');
    const fetchMock = vi.fn().mockRejectedValue(erro);
    vi.stubGlobal('fetch', fetchMock);
    const { kvGet } = await import('@/lib/kvClient');
    await expect(kvGet('selecao', { throwOnError: true })).rejects.toBe(erro);
    expect(await kvGet('outra-chave')).toBeNull();
    fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new Error('JSON inválido'); } });
    await expect(kvGet('selecao', { throwOnError: true })).rejects.toThrow('JSON inválido');
  });
});
