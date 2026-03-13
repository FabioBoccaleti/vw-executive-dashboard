import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractToken, deleteSession, appendLog, getSession } from './_helpers';

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = extractToken(req.headers.authorization);
  if (token) {
    const session = await getSession(token);
    if (session) {
      await appendLog({ userId: session.userId, username: session.username, action: 'logout' });
    }
    await deleteSession(token);
  }

  return res.status(200).json({ ok: true });
}
