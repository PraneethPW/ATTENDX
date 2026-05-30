import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import type { AuthedRequest } from '../types.js'

export const assignmentsRouter = Router()

assignmentsRouter.post('/', requireAuth, requireRole('student'), upload.single('file'), async (req: AuthedRequest, res) => {
  const body = z.object({ courseId: z.string().uuid(), title: z.string().min(3) }).parse(req.body)
  if (!req.file) return res.status(400).json({ message: 'File is required' })
  const { rows } = await pool.query(
    'insert into assignments(course_id, student_id, title, file_path) values($1,$2,$3,$4) returning *',
    [body.courseId, req.user!.id, body.title, req.file.path],
  )
  res.status(201).json({ assignment: rows[0] })
})

assignmentsRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query('select * from assignments where student_id = $1 order by created_at desc', [req.user!.id])
  res.json({ assignments: rows })
})
