import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractToken, getSession } from './_helpers';
import { validarSenhaEstorno } from './_consorcioPassword';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const token = extractToken(req.headers.authorization);
  const session = token ? await getSession(token) : null;
  if (!session || (session.role !== 'admin' && !session.modules.includes('vendas_bonificacoes'))) {
    return res.status(401).json({ error: 'Sessão inválida ou sem acesso ao módulo.' });
  }

  const result = validarSenhaEstorno(req.body?.password, process.env.CONSORCIO_ESTORNO_PASSWORD);
  return res.status(result.status).json(result.body);
}
