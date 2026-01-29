import { Redis } from '@upstash/redis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { key } = req.query

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing key parameter' })
  }

  try {
    const value = await redis.get(key)
    return res.status(200).json({ key, value })
  } catch (error) {
    console.error('Redis GET error:', error)
    return res.status(500).json({ error: 'Failed to get value from Redis' })
  }
}
