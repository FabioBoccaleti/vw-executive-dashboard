import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { validarSenhaEstorno } from './api/auth/_consorcioPassword';

export function validarEstornoLocal(expectedPassword: string | undefined) {
  return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const respond = (status: number, body: object) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) {
      respond(403, { error: 'Disponível apenas localmente.' });
      return;
    }
    if (req.method !== 'POST') {
      respond(405, { error: 'Método não permitido.' });
      return;
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
      respond(415, { error: 'Conteúdo inválido.' });
      return;
    }
    void (async () => {
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 4096) {
          respond(413, { error: 'Requisição muito grande.' });
          return;
        }
        chunks.push(buffer);
      }
      let body: { password?: unknown };
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        respond(400, { error: 'JSON inválido.' });
        return;
      }
      const result = validarSenhaEstorno(body?.password, expectedPassword);
      respond(result.status, result.body);
    })().catch(next);
  };
}

export function devConsorcioEstorno(expectedPassword: string | undefined): Plugin {
  return {
    name: 'dev-consorcio-estorno',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/auth/consorcio-estorno-check', validarEstornoLocal(expectedPassword));
    },
  };
}
