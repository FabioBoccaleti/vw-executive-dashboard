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

  const { pattern } = req.query
  const searchPattern = typeof pattern === 'string' ? pattern : '*'

  try {
    const keys = await redis.keys(searchPattern)
    return res.status(200).json({ keys })
  } catch (error) {
    console.error('Redis KEYS error:', error)
    return res.status(500).json({ error: 'Failed to get keys from Redis' })
  }
}
