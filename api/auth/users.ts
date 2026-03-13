import { pbkdf2Sync, randomBytes } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = pbkdf2Sync(password, salt, 100_000, 64, 'sha512');
  return `${key.toString('hex')}.${salt}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const redis = new Redis({
    url:   process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });

  const USERS_KEY  = 'auth_users_list';
  const userKey    = (id: string) => `auth_user_${id}`;
  const sessionKey = (t: string)  => `auth_session_${t}`;

  // ── Valida sessão admin ───────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autorizado' });

  let session: any = null;
  try {
    const raw = await redis.get<any>(sessionKey(token));
    session = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao validar sessão' });
  }

  if (!session || session.role !== 'admin') {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const getIds = async (): Promise<string[]> => {
    const r = await redis.get<any>(USERS_KEY);
    return r ? (typeof r === 'string' ? JSON.parse(r) : r) : [];
  };

  const getUser = async (id: string): Promise<any | null> => {
    const r = await redis.get<any>(userKey(id));
    return r ? (typeof r === 'string' ? JSON.parse(r) : r) : null;
  };

  const listUsers = async (): Promise<any[]> => {
    const ids = await getIds();
    const users = await Promise.all(ids.map(getUser));
    return users.filter(Boolean);
  };

  const saveUser = async (user: any): Promise<void> => {
    await redis.set(userKey(user.id), JSON.stringify(user));
    const ids = await getIds();
    if (!ids.includes(user.id)) {
      await redis.set(USERS_KEY, JSON.stringify([...ids, user.id]));
    }
  };

  try {
    if (req.method === 'GET') {
      const users = await listUsers();
      return res.status(200).json({ users: users.map(({ passwordHash: _, ...u }) => u) });
    }

    if (req.method === 'POST') {
      const { name, username, password, role, modules, brands, active } = req.body ?? {};
      if (!name || !username || !password || !role) {
        return res.status(400).json({ error: 'name, username, password e role são obrigatórios' });
      }
      const existing = await listUsers();
      if (existing.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(409).json({ error: 'Usuário já existe' });
      }
      const user = {
        id: `u_${Date.now()}_${randomBytes(4).toString('hex')}`,
        name, username, passwordHash: hashPassword(password),
        role, modules: modules ?? [], brands: brands ?? [],
        active: active ?? true, createdAt: Date.now(), updatedAt: Date.now(),
      };
      await saveUser(user);
      const { passwordHash: _, ...publicUser } = user;
      return res.status(201).json({ user: publicUser });
    }

    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id obrigatório' });
      const user = await getUser(id);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
      if (user.id === session.userId && req.body?.role && req.body.role !== 'admin') {
        return res.status(400).json({ error: 'Você não pode alterar seu próprio perfil de admin' });
      }
      const { password, ...rest } = req.body ?? {};
      const updated = { ...user, ...rest, updatedAt: Date.now() };
      if (password) updated.passwordHash = hashPassword(password);
      await saveUser(updated);
      const { passwordHash: _, ...publicUser } = updated;
      return res.status(200).json({ user: publicUser });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id obrigatório' });
      if (id === session.userId) return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });
      const ids = await getIds();
      await redis.del(userKey(id as string));
      await redis.set(USERS_KEY, JSON.stringify(ids.filter((i: string) => i !== id)));
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[users] error:', msg);
    return res.status(500).json({ error: `Erro interno: ${msg}` });
  }
}
