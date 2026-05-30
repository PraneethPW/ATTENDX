import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const analyticsRouter = Router()

analyticsRouter.get('/overview', requireAuth, requireRole('faculty', 'admin'), async (_req, res) => {
  const attendance = await pool.query(`
    select status, count(*)::int as total, round(avg(risk_score))::int as avg_risk
    from attendance_records group by status order by total desc
  `)
  const uploads = await pool.query('select count(*)::int as total from assignments')
  res.json({ attendance: attendance.rows, uploads: uploads.rows[0]?.total ?? 0 })
})
