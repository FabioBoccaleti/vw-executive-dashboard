import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../../api/analise-financeira/parametros-pdf';
import { permitirAlteracaoParametrosPdf, PARAMETROS_PDF_KEY } from '../../api/kv/_parametrosPdfGuard';
import { getSession, redis, requireAdmin } from '../../api/auth/_helpers';

vi.mock('../../api/auth/_helpers', () => ({
  extractToken: (header?: string) => header?.startsWith('Bearer ') ? header.slice(7) : null,
  getSession: vi.fn(),
  requireAdmin: vi.fn(),
  redis: { get: vi.fn(), set: vi.fn() },
}));

afterEach(() => vi.resetAllMocks());

function responseMock() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & typeof res;
}

describe('PDF de parâmetros da Análise Financeira', () => {
  it('permite visualizar para usuários do Fluxo de Caixa, mas exige admin para substituir', async () => {
    const res = responseMock();
    vi.mocked(getSession).mockResolvedValue({
      userId: 'u1', username: 'leitura', role: 'leitura', modules: ['fluxo_caixa'], brands: [], expiresAt: Date.now() + 1000,
    });
    vi.mocked(redis.get).mockResolvedValue(null);
    await handler({ method: 'GET', headers: { authorization: 'Bearer token' } } as VercelRequest, res);
    expect(res.status).toHaveBeenLastCalledWith(200);
    expect(res.json).toHaveBeenLastCalledWith({ document: null });

    vi.mocked(requireAdmin).mockResolvedValue(null);
    const forbidden = responseMock();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { fileName: 'referencia.pdf', data: Buffer.from('%PDF-1.4').toString('base64') },
    } as VercelRequest, forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(403);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('valida e grava um PDF quando a sessão é de administrador', async () => {
    const admin = { userId: 'a1', username: 'admin', role: 'admin' as const, modules: [], brands: [], expiresAt: Date.now() + 1000 };
    vi.mocked(requireAdmin).mockResolvedValue(admin);
    vi.mocked(redis.set).mockResolvedValue('OK');
    const res = responseMock();
    const data = Buffer.from('%PDF-1.4\nRelatório de referência').toString('base64');
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer admin-token' },
      body: { fileName: 'referencia.pdf', data },
    } as VercelRequest, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(redis.set).toHaveBeenCalledWith(PARAMETROS_PDF_KEY, expect.stringContaining('"uploadedBy":"admin"'));
    expect(res.json).toHaveBeenCalledWith({
      document: expect.objectContaining({ fileName: 'referencia.pdf', data, uploadedBy: 'admin' }),
    });
  });

  it('bloqueia gravação do PDF pelos endpoints KV genéricos sem autorização admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null);
    const res = responseMock();
    const allowed = await permitirAlteracaoParametrosPdf(
      { headers: { authorization: 'Bearer token' } } as VercelRequest,
      res,
      PARAMETROS_PDF_KEY,
    );
    expect(allowed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
