import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  const redis = new Redis({
    url:   process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });

  try {
    // Lê a sessão do Redis (fonte da verdade)
    const rawSession = await redis.get<any>(`auth_session_${token}`);
    const session = rawSession ? (typeof rawSession === 'string' ? JSON.parse(rawSession) : rawSession) : null;
    if (!session || session.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Sessão expirada' });
    }

    // Lê o usuário do Redis para obter permissões atualizadas
    const USERS_KEY = 'auth_users_list';
    const userKey = (id: string) => `auth_user_${id}`;
    const rawIds = await redis.get<any>(USERS_KEY);
    const ids: string[] = rawIds ? (typeof rawIds === 'string' ? JSON.parse(rawIds) : rawIds) : [];

    let user: any = null;
    for (const id of ids) {
      if (id === session.userId || id.toString() === session.userId?.toString()) {
        const raw = await redis.get<any>(userKey(id));
        user = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
        break;
      }
    }

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    }

    // Retorna sessão com permissões ATUAIS do usuário (não as do momento do login)
    const freshSession = {
      userId:    user.id,
      username:  user.username,
      role:      user.role,
      modules:   user.modules,
      brands:    user.brands,
      expiresAt: session.expiresAt,
    };

    return res.status(200).json({ session: freshSession });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: `Erro interno: ${msg}` });
  }
}
