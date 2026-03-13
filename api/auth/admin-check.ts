import type { VercelRequest, VercelResponse } from '@vercel/node';

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body ?? {};
  const adminPassword = process.env.ADMIN_PANEL_PASSWORD ?? 'Admin@2026';

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }

  return res.status(200).json({ ok: true });
}
