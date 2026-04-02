// ─── Utilitários compartilhados das APIs de autenticação ─────────────────────
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

// Tipos inline (evita importação cross-directory que pode falhar no bundler Vercel)
export type UserRole = 'admin' | 'gestor' | 'leitura';
export type ModuleId = 'demonstrativo' | 'despesas' | 'fluxo_caixa' | 'vendas_bonificacoes' | 'folha_pagamento' | 'central_vendas_vw';
export type BrandId = 'vw' | 'audi' | 'consolidado' | 'vw_outros' | 'audi_outros';
export type VendasSubModuleId =
  | 'blindagem.tabela'
  | 'blindagem.analise'
  | 'blindagem.todas'
  | 'blindagem.revenda_vw'
  | 'blindagem.revenda_audi'
  | 'blindagem.estoque'
  | 'blindagem.notas_a_emitir'
  | 'peliculas.tabela'
  | 'peliculas.analise';
export type CentralVendasVWSubModuleId =
  | 'central_vw.analises'
  | 'central_vw.vendas'
  | 'central_vw.financeiro'
  | 'central_vw.registros'
  | 'central_vw.cadastros';
export const ALL_MODULES: ModuleId[] = ['demonstrativo', 'despesas', 'fluxo_caixa', 'vendas_bonificacoes', 'folha_pagamento', 'central_vendas_vw'];
export const ALL_BRANDS: BrandId[] = ['vw', 'audi', 'consolidado', 'vw_outros', 'audi_outros'];

export interface UserRecord {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  modules: ModuleId[];
  brands: BrandId[];
  vendasSubModules?: VendasSubModuleId[];
  centralVendasVWSubModules?: CentralVendasVWSubModuleId[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SessionPayload {
  userId: string;
  username: string;
  role: UserRole;
  modules: ModuleId[];
  brands: BrandId[];
  vendasSubModules?: VendasSubModuleId[];
  centralVendasVWSubModules?: CentralVendasVWSubModuleId[];
  expiresAt: number;
}

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const SESSION_TTL = 60 * 60 * 8; // 8 horas em segundos

// ─── Chaves Redis ─────────────────────────────────────────────────────────────
export const KEYS = {
  usersList: 'auth_users_list',
  user: (id: string) => `auth_user_${id}`,
  session: (token: string) => `auth_session_${token}`,
  logs: 'auth_logs',
};

// ─── Sessão ───────────────────────────────────────────────────────────────────
export async function createSession(user: UserRecord): Promise<string> {
  const token = randomUUID();
  const payload: SessionPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    modules: user.modules,
    brands: user.brands,
    vendasSubModules: user.vendasSubModules,
    centralVendasVWSubModules: user.centralVendasVWSubModules,
    expiresAt: Date.now() + SESSION_TTL * 1000,
  };
  await redis.setex(KEYS.session(token), SESSION_TTL, JSON.stringify(payload));
  return token;
}

export async function getSession(token: string): Promise<SessionPayload | null> {
  try {
    const raw = await redis.get<string>(KEYS.session(token));
    if (!raw) return null;
    const data: SessionPayload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data.expiresAt < Date.now()) {
      await redis.del(KEYS.session(token));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function deleteSession(token: string): Promise<void> {
  await redis.del(KEYS.session(token));
}

// ─── Token da requisição ──────────────────────────────────────────────────────
export function extractToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export async function requireAdmin(authHeader?: string): Promise<SessionPayload | null> {
  const token = extractToken(authHeader);
  if (!token) return null;
  const session = await getSession(token);
  if (!session || session.role !== 'admin') return null;
  return session;
}

// ─── Log de acesso ────────────────────────────────────────────────────────────
export async function appendLog(entry: { userId: string; username: string; action: string; module?: string }): Promise<void> {
  try {
    const log = { id: randomUUID(), ...entry, timestamp: Date.now() };
    const existing = await redis.get<string>(KEYS.logs);
    let logs: any[] = [];
    if (existing) {
      logs = typeof existing === 'string' ? JSON.parse(existing) : existing;
    }
    logs.push(log);
    // Mantém apenas os últimos 1000 registros
    if (logs.length > 1000) logs = logs.slice(logs.length - 1000);
    await redis.set(KEYS.logs, JSON.stringify(logs));
  } catch {
    // log silencioso — não deve travar o fluxo principal
  }
}

// ─── Usuários ─────────────────────────────────────────────────────────────────
export async function listUsers(): Promise<UserRecord[]> {
  const ids = await redis.get<string>(KEYS.usersList);
  if (!ids) return [];
  const idList: string[] = typeof ids === 'string' ? JSON.parse(ids) : ids;
  const users: UserRecord[] = [];
  for (const id of idList) {
    const raw = await redis.get<string>(KEYS.user(id));
    if (raw) {
      const u: UserRecord = typeof raw === 'string' ? JSON.parse(raw) : raw;
      users.push(u);
    }
  }
  return users;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const raw = await redis.get<string>(KEYS.user(id));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  const users = await listUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export async function saveUser(user: UserRecord): Promise<void> {
  await redis.set(KEYS.user(user.id), JSON.stringify(user));
  const raw = await redis.get<string>(KEYS.usersList);
  let ids: string[] = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
  if (!ids.includes(user.id)) {
    ids.push(user.id);
    await redis.set(KEYS.usersList, JSON.stringify(ids));
  }
}

export async function deleteUser(id: string): Promise<void> {
  await redis.del(KEYS.user(id));
  const raw = await redis.get<string>(KEYS.usersList);
  let ids: string[] = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
  ids = ids.filter(i => i !== id);
  await redis.set(KEYS.usersList, JSON.stringify(ids));
}
