import { createServer } from 'http';
import { once } from 'events';
import { describe, expect, it } from 'vitest';
import { validarEstornoLocal } from '../../devConsorcioEstorno';

describe('validação local da senha de estorno', () => {
  it('valida a senha no servidor e informa quando não está configurada', async () => {
    for (const password of ['senha-teste', undefined]) {
      const handler = validarEstornoLocal(password);
      const server = createServer((req, res) => {
        handler(req, res, () => { res.statusCode = 500; res.end(); });
      });
      try {
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Servidor local não iniciou.');
        const url = `http://127.0.0.1:${address.port}/api/auth/consorcio-estorno-check`;
        const post = (body: string) => fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        });
        if (password) {
          expect((await post(JSON.stringify({ password: 'errada' }))).status).toBe(403);
          const response = await post(JSON.stringify({ password }));
          expect(response.status).toBe(200);
          expect(await response.json()).toEqual({ ok: true });
          expect((await post('invalid json')).status).toBe(400);
        } else {
          expect((await post(JSON.stringify({ password: 'senha-teste' }))).status).toBe(503);
        }
      } finally {
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      }
    }
  });
});
