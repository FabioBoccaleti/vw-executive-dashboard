import { Redis } from '@upstash/redis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

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

  const { key, value } = req.body

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing key parameter' })
  }

  if (value === undefined) {
    return res.status(400).json({ error: 'Missing value parameter' })
  }

  try {
    await redis.set(key, value)
    return res.status(200).json({ success: true, key })
  } catch (error) {
    console.error('Redis SET error:', error)
    return res.status(500).json({ error: 'Failed to set value in Redis' })
  }
}
