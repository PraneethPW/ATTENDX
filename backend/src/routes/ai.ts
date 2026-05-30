import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const aiRouter = Router()

aiRouter.post('/insights', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const body = z.object({ prompt: z.string().min(5) }).parse(req.body)
  if (!process.env.OPENROUTER_API_KEY) {
    return res.json({
      insight: 'OpenRouter API key is not configured yet. Add OPENROUTER_API_KEY to enable live AI insights.',
    })
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'AttendX',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324:free',
      messages: [
        { role: 'system', content: 'You are AttendX AI. Give concise academic attendance risk insights.' },
        { role: 'user', content: body.prompt },
      ],
    }),
  })

  const data = await response.json()
  res.json({ insight: data.choices?.[0]?.message?.content ?? 'No insight returned', raw: data })
})
