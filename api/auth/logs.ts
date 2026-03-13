import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin, redis, KEYS } from './_helpers';

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await requireAdmin(req.headers.authorization);
  if (!session) return res.status(401).json({ error: 'Não autorizado' });

  try {
    const raw = await redis.get<string>(KEYS.logs);
    let logs: any[] = [];
    if (raw) {
      logs = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
    // Mais recentes primeiro
    logs = logs.slice().reverse();
    return res.status(200).json({ logs });
  } catch (err) {
    console.error('Logs API error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
