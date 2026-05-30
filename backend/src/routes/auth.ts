import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { pool } from '../db.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import type { AuthedRequest } from '../types.js'

export const authRouter = Router()

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional(),
  role: z.enum(['student', 'faculty', 'admin']).optional(),
})

authRouter.post('/register', async (req, res) => {
  const body = credentials.extend({ name: z.string().min(2), role: z.enum(['student', 'faculty', 'admin']) }).parse(req.body)
  const hash = await bcrypt.hash(body.password, 12)
  const { rows } = await pool.query(
    'insert into users(name, email, password_hash, role) values($1, $2, $3, $4) returning id, email, role',
    [body.name, body.email, hash, body.role],
  )
  const token = signToken(rows[0])
  res.status(201).json({ user: rows[0], token })
})

authRouter.post('/login', async (req, res) => {
  const body = credentials.pick({ email: true, password: true }).parse(req.body)
  const { rows } = await pool.query('select id, email, role, password_hash from users where email = $1', [body.email])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }
  const token = signToken({ id: user.id, email: user.email, role: user.role })
  res.json({ user: { id: user.id, email: user.email, role: user.role }, token })
})

authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user })
})
