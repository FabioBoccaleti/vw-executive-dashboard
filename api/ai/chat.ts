import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { question, context } = req.body ?? {}

  if (!question || typeof question !== 'string' || question.length > 4000) {
    return res.status(400).json({ error: 'Pergunta inválida' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Diagnóstico: listar quais env vars de API existem (sem revelar valores)
    const envHints = Object.keys(process.env)
      .filter(k => /anthropic|claude|openai|ai[_-]|api[_-]key/i.test(k))
      .map(k => `${k}=***`)
    console.error('ANTHROPIC_API_KEY ausente. Vars encontradas:', envHints)
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY não configurada no servidor',
      hint: envHints.length ? `Variáveis similares encontradas: ${envHints.join(', ')}` : 'Nenhuma variável de API de IA encontrada nas env vars. Configure ANTHROPIC_API_KEY no Vercel.'
    })
  }

  const systemPrompt = `Você é um assistente financeiro especializado em análise contábil de concessionárias de veículos do grupo Sorana (marcas Volkswagen e Audi).

REGRAS:
- Responda sempre em português brasileiro, de forma clara e objetiva.
- Use os dados financeiros abaixo para fundamentar suas respostas.
- Se a informação não estiver nos dados fornecidos, diga claramente.
- Formate sua resposta usando Markdown (tabelas, negrito, listas) quando ajudar na clareza.
- Para valores monetários use o formato R$ com duas casas decimais.
- Ao comparar períodos, destaque variações positivas e negativas.

DADOS FINANCEIROS:
${(typeof context === 'string' ? context : '').slice(0, 100000)}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: question },
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic error:', err)
      return res.status(502).json({ error: 'Erro ao consultar a IA. Verifique a chave da API.' })
    }

    const data = await response.json()
    const answer = data.content?.[0]?.text || 'Sem resposta.'

    return res.status(200).json({ answer })
  } catch (error) {
    console.error('AI chat error:', error)
    return res.status(500).json({ error: 'Erro interno ao processar a pergunta' })
  }
}
