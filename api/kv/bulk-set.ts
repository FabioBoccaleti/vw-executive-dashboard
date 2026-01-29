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

  const { items } = req.body

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Missing items array' })
  }

  try {
    // Use pipeline for bulk operations
    const pipeline = redis.pipeline()
    
    for (const item of items) {
      if (item.key && item.value !== undefined) {
        pipeline.set(item.key, item.value)
      }
    }
    
    await pipeline.exec()
    
    return res.status(200).json({ success: true, count: items.length })
  } catch (error) {
    console.error('Redis BULK SET error:', error)
    return res.status(500).json({ error: 'Failed to bulk set values in Redis' })
  }
}
