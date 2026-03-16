import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const envCheck = {
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  }

  // List any env var that contains "anthropic", "claude", "openai", "ai" (name only, never the value)
  const relatedVars = Object.keys(process.env)
    .filter(k => /anthropic|claude|openai|ai[_-]|api[_-]key/i.test(k))

  return res.status(200).json({
    status: 'ok',
    envCheck,
    relatedAIVars: relatedVars,
    totalEnvVars: Object.keys(process.env).length,
  })
}
