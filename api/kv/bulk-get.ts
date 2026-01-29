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

  const { keys } = req.body

  if (!keys || !Array.isArray(keys)) {
    return res.status(400).json({ error: 'Missing keys array' })
  }

  try {
    // Use mget for bulk get operations
    if (keys.length === 0) {
      return res.status(200).json({ data: {} })
    }
    
    const values = await redis.mget(...keys)
    
    // Build result object
    const data: Record<string, unknown> = {}
    keys.forEach((key, index) => {
      data[key] = values[index]
    })
    
    return res.status(200).json({ data })
  } catch (error) {
    console.error('Redis BULK GET error:', error)
    return res.status(500).json({ error: 'Failed to bulk get values from Redis' })
  }
}
