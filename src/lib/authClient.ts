// ─── Cliente de autenticação (lado cliente) ───────────────────────────────────
// Responsável por chamar as APIs de auth e gerenciar o token no sessionStorage.

import type { SessionPayload, PublicUser, AccessLogEntry } from './authTypes';

const SESSION_KEY = 'auth_session_token';
const SESSION_DATA_KEY = 'auth_session_data';

// ─── Token / Sessão local ─────────────────────────────────────────────────────

export function getSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function getSessionData(): SessionPayload | null {
  try {
    const raw = sessionStorage.getItem(SESSION_DATA_KEY);
    if (!raw) return null;
    const data: SessionPayload = JSON.parse(raw);
    if (data.expiresAt < Date.now()) {
      clearSession();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function saveSession(token: string, data: SessionPayload): void {
  sessionStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(SESSION_DATA_KEY, JSON.stringify(data));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_DATA_KEY);
}

export function isLoggedIn(): boolean {
  return getSessionData() !== null;
}

// ─── Chamadas de API ──────────────────────────────────────────────────────────

const IS_DEV = typeof window !== 'undefined' && window.location.hostname === 'localhost';

export async function apiLogin(username: string, password: string): Promise<{ token: string; session: SessionPayload } | { error: string }> {
  // Bypass local: em desenvolvimento não há API — entra direto como admin
  if (IS_DEV) {
    const session: SessionPayload = {
      userId: 'dev',
      username: username || 'dev',
      role: 'admin',
      modules: ['demonstrativo', 'despesas', 'fluxo_caixa', 'vendas_bonificacoes', 'folha_pagamento', 'central_vendas_vw'],
      brands: ['vw', 'audi', 'consolidado', 'vw_outros', 'audi_outros'],
      vendasSubModules: [],
      centralVendasVWSubModules: [],
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    };
    return { token: 'dev-token', session };
  }

  let res: Response;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    return { error: 'Erro de conexão. Verifique sua internet.' };
  }
  try {
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? `Erro do servidor (${res.status})` };
    return data;
  } catch {
    return { error: `Erro do servidor (${res.status}). Tente novamente.` };
  }
}

export async function apiLogout(): Promise<void> {
  const token = getSessionToken();
  if (token) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearSession();
}

export async function apiListUsers(): Promise<PublicUser[]> {
  const token = getSessionToken();
  const res = await fetch('/api/auth/users', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Não autorizado');
  const data = await res.json();
  return data.users;
}

export async function apiCreateUser(payload: Omit<PublicUser, 'id' | 'createdAt' | 'updatedAt'> & { password: string }): Promise<PublicUser> {
  const token = getSessionToken();
  const res = await fetch('/api/auth/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Erro ao criar usuário');
  }
  return (await res.json()).user;
}

export async function apiUpdateUser(id: string, payload: Partial<Omit<PublicUser, 'id' | 'createdAt'> & { password?: string }>): Promise<PublicUser> {
  const token = getSessionToken();
  const res = await fetch(`/api/auth/users?id=${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Erro ao atualizar usuário');
  }
  return (await res.json()).user;
}

export async function apiDeleteUser(id: string): Promise<void> {
  const token = getSessionToken();
  const res = await fetch(`/api/auth/users?id=${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Erro ao excluir usuário');
  }
}

export async function apiGetLogs(): Promise<AccessLogEntry[]> {
  const token = getSessionToken();
  const res = await fetch('/api/auth/logs', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Não autorizado');
  return (await res.json()).logs;
}

export async function apiValidateAdminPassword(password: string): Promise<boolean> {
  const res = await fetch('/api/auth/admin-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}
