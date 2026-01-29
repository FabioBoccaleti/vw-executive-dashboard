import { Redis } from '@upstash/redis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pattern } = req.query

  if (!pattern || typeof pattern !== 'string') {
    return res.status(400).json({ error: 'Missing pattern parameter' })
  }

  try {
    // Get all keys matching the pattern
    const keys = await redis.keys(pattern)
    
    if (keys.length === 0) {
      return res.status(200).json({ success: true, deleted: 0 })
    }
    
    // Delete all matching keys
    const pipeline = redis.pipeline()
    for (const key of keys) {
      pipeline.del(key)
    }
    await pipeline.exec()
    
    return res.status(200).json({ success: true, deleted: keys.length })
  } catch (error) {
    console.error('Redis CLEAR PATTERN error:', error)
    return res.status(500).json({ error: 'Failed to clear keys from Redis' })
  }
}
