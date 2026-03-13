import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ALL_MODULES, ALL_BRANDS, type UserRecord,
  getUserByUsername, saveUser, createSession, appendLog, listUsers,
} from './_helpers';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [hashed, salt] = stored.split('.');
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(buf, Buffer.from(hashed, 'hex'));
  } catch {
    return false;
  }
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  try {
    // Verifica se é o primeiro acesso — cria admin padrão
    const allUsers = await listUsers();
    if (allUsers.length === 0) {
      const initialPassword = process.env.ADMIN_INITIAL_PASSWORD ?? '1985';
      const passwordHash = await hashPassword(initialPassword);
      const adminUser: UserRecord = {
        id: randomUUID(),
        name: 'Controladoria Sorana',
        username: 'controladoria@sorana.com.br',
        passwordHash,
        role: 'admin',
        modules: ALL_MODULES,
        brands: ALL_BRANDS,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveUser(adminUser);
    }

    const user = await getUserByUsername(username);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    const token = await createSession(user);
    await appendLog({ userId: user.id, username: user.username, action: 'login' });

    return res.status(200).json({
      token,
      session: {
        userId: user.id,
        username: user.username,
        role: user.role,
        modules: user.modules,
        brands: user.brands,
        expiresAt: Date.now() + 60 * 60 * 8 * 1000,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Login error:', msg);
    return res.status(500).json({ error: `Erro interno: ${msg}` });
  }
}
