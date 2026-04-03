import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = pbkdf2Sync(password, salt, 100_000, 64, 'sha512');
  return `${key.toString('hex')}.${salt}`;
}

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [hash, salt] = stored.split('.');
    if (!hash || !salt) return false;
    const key = pbkdf2Sync(password, salt, 100_000, 64, 'sha512');
    const hashBuf = Buffer.from(hash, 'hex');
    if (key.length !== hashBuf.length) return false;
    return timingSafeEqual(key, hashBuf);
  } catch {
    return false;
  }
}

const ALL_MODULES = ['demonstrativo', 'despesas', 'fluxo_caixa'];
const ALL_BRANDS  = ['vw', 'audi', 'consolidado', 'vw_outros', 'audi_outros'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  const redis = new Redis({
    url:   process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });

  const SESSION_TTL = 60 * 60 * 8;
  const USERS_KEY   = 'auth_users_list';
  const userKey     = (id: string) => `auth_user_${id}`;
  const sessionKey  = (t: string)  => `auth_session_${t}`;

  try {
    const rawIds = await redis.get<any>(USERS_KEY);
    const ids: string[] = rawIds ? (typeof rawIds === 'string' ? JSON.parse(rawIds) : rawIds) : [];

    if (ids.length === 0) {
      const initialPassword = process.env.ADMIN_INITIAL_PASSWORD ?? '1985';
      const passwordHash = hashPassword(initialPassword);
      const adminId = `admin_${Date.now()}`;
      const adminUser = {
        id: adminId, name: 'Controladoria Sorana',
        username: 'controladoria@sorana.com.br', passwordHash,
        role: 'admin', modules: ALL_MODULES, brands: ALL_BRANDS,
        active: true, createdAt: Date.now(), updatedAt: Date.now(),
      };
      await redis.set(userKey(adminId), JSON.stringify(adminUser));
      await redis.set(USERS_KEY, JSON.stringify([adminId]));
    }

    const allIdsRaw = await redis.get<any>(USERS_KEY);
    const allIds: string[] = allIdsRaw ? (typeof allIdsRaw === 'string' ? JSON.parse(allIdsRaw) : allIdsRaw) : [];

    let foundUser: any = null;
    for (const id of allIds) {
      const raw = await redis.get<any>(userKey(id));
      const u = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      if (u && u.username.toLowerCase() === (username as string).toLowerCase()) {
        foundUser = u; break;
      }
    }

    if (!foundUser || !foundUser.active) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    if (!verifyPassword(password as string, foundUser.passwordHash)) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    const token = `${Date.now()}-${randomBytes(24).toString('hex')}`;
    const session = {
      userId: foundUser.id, username: foundUser.username, role: foundUser.role,
      modules: foundUser.modules, brands: foundUser.brands,
      vendasSubModules: foundUser.vendasSubModules ?? [],
      centralVendasVWSubModules: foundUser.centralVendasVWSubModules ?? [],
      folhaSubModules: foundUser.folhaSubModules ?? [],
      expiresAt: Date.now() + SESSION_TTL * 1000,
    };
    await redis.setex(sessionKey(token), SESSION_TTL, JSON.stringify(session));

    return res.status(200).json({ token, session });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[login] error:', msg);
    return res.status(500).json({ error: `Erro interno: ${msg}` });
  }
}
