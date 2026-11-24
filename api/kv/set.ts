import { Redis } from '@upstash/redis'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { permitirAlteracaoParametrosPdf } from './_parametrosPdfGuard'

// Aumenta o limite do body parser para suportar balancetes grandes (até ~10 MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { key, value, expectedVersion } = req.body

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing key parameter' })
  }

  if (value === undefined) {
    return res.status(400).json({ error: 'Missing value parameter' })
  }

  if (expectedVersion !== undefined && (
    (expectedVersion !== null && typeof expectedVersion !== 'string') ||
    !value || typeof value !== 'object' || typeof value.version !== 'string'
  )) {
    return res.status(400).json({ error: 'Invalid version parameters' })
  }
  if (!await permitirAlteracaoParametrosPdf(req, res, key)) return

  try {
    if (expectedVersion !== undefined) {
      const saved = await redis.eval(`
        local current = redis.call('GET', KEYS[1])
        if ARGV[1] == 'create' then
          if current then return 0 end
        else
          if not current or cjson.decode(current).version ~= ARGV[2] then return 0 end
        end
        redis.call('SET', KEYS[1], ARGV[3])
        return 1
      `, [key], [expectedVersion === null ? 'create' : 'update', expectedVersion ?? '', JSON.stringify(value)])
      if (saved !== 1) return res.status(409).json({ error: 'Version conflict' })
      return res.status(200).json({ success: true, key })
    }
    await redis.set(key, value)
    return res.status(200).json({ success: true, key })
  } catch (error) {
    console.error('Redis SET error:', error)
    return res.status(500).json({ error: 'Failed to set value in Redis' })
  }
}
