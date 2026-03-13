import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { UserRecord } from './_helpers';
import {
  requireAdmin, listUsers, getUserById, saveUser, deleteUser,
} from './_helpers';

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = await requireAdmin(req.headers.authorization);
  if (!session) return res.status(401).json({ error: 'Não autorizado' });

  try {
    // ── GET: listar usuários ──────────────────────────────────────────────────
    if (req.method === 'GET') {
      const users = await listUsers();
      const publicUsers = users.map(({ passwordHash: _, ...u }) => u);
      return res.status(200).json({ users: publicUsers });
    }

    // ── POST: criar usuário ───────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { name, username, password, role, modules, brands, active } = req.body ?? {};
      if (!name || !username || !password || !role) {
        return res.status(400).json({ error: 'name, username, password e role são obrigatórios' });
      }

      // Verifica duplicata
      const existing = await listUsers();
      if (existing.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(409).json({ error: 'Usuário já existe' });
      }

      const hash = await bcrypt.hash(password, 12);
      const user: UserRecord = {
        id: randomUUID(),
        name,
        username,
        passwordHash: hash,
        role,
        modules: modules ?? [],
        brands: brands ?? [],
        active: active ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveUser(user);
      const { passwordHash: _, ...publicUser } = user;
      return res.status(201).json({ user: publicUser });
    }

    // ── PATCH: atualizar usuário ──────────────────────────────────────────────
    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id obrigatório' });

      const user = await getUserById(id);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

      // Não permite revogar o próprio role de admin
      if (user.id === session.userId && req.body?.role && req.body.role !== 'admin') {
        return res.status(400).json({ error: 'Você não pode alterar seu próprio perfil de admin' });
      }

      const { password, ...rest } = req.body ?? {};
      const updated: UserRecord = {
        ...user,
        ...rest,
        updatedAt: Date.now(),
      };
      if (password) {
        updated.passwordHash = await bcrypt.hash(password, 12);
      }
      await saveUser(updated);
      const { passwordHash: _, ...publicUser } = updated;
      return res.status(200).json({ user: publicUser });
    }

    // ── DELETE: excluir usuário ───────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id obrigatório' });
      if (id === session.userId) return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });

      const user = await getUserById(id);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

      await deleteUser(id);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Users API error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
