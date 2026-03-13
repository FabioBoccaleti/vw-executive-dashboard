import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const redis = new Redis({
    url:   process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autorizado' });

  try {
    const raw = await redis.get<any>(`auth_session_${token}`);
    const session = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    if (!session || session.role !== 'admin') return res.status(401).json({ error: 'Não autorizado' });

    const logsRaw = await redis.get<any>('auth_logs');
    let logs: any[] = logsRaw ? (typeof logsRaw === 'string' ? JSON.parse(logsRaw) : logsRaw) : [];
    return res.status(200).json({ logs: logs.slice().reverse() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: `Erro interno: ${msg}` });
  }
}
