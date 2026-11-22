import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../../api/auth/consorcio-estorno-check';
import { getSession } from '../../api/auth/_helpers';

vi.mock('../../api/auth/_helpers', () => ({
  extractToken: (header?: string) => header?.startsWith('Bearer ') ? header.slice(7) : null,
  getSession: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

async function verificar(password: string, authorization = 'Bearer token') {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  await handler({ method: 'POST', headers: { authorization }, body: { password } } as VercelRequest, res as unknown as VercelResponse);
  return res.status.mock.calls[0][0];
}

describe('validação da senha de estorno de consórcio', () => {
  it('exige sessão autorizada e senha configurada e correta', async () => {
    vi.stubEnv('CONSORCIO_ESTORNO_PASSWORD', 'senha-teste');
    expect(await verificar('senha-teste')).toBe(401);
    vi.mocked(getSession).mockResolvedValue({
      userId: '1', username: 'admin', role: 'admin', modules: [], brands: [], expiresAt: Date.now() + 1000,
    });
    expect(await verificar('errada')).toBe(403);
    expect(await verificar('senha-teste')).toBe(200);
    vi.stubEnv('CONSORCIO_ESTORNO_PASSWORD', '');
    expect(await verificar('senha-teste')).toBe(503);
  });
});
