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

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY não configurada no servidor' })
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('OpenAI error:', err)
      return res.status(502).json({ error: 'Erro ao consultar a IA. Verifique a chave da API.' })
    }

    const data = await response.json()
    const answer = data.choices?.[0]?.message?.content || 'Sem resposta.'

    return res.status(200).json({ answer })
  } catch (error) {
    console.error('AI chat error:', error)
    return res.status(500).json({ error: 'Erro interno ao processar a pergunta' })
  }
}
