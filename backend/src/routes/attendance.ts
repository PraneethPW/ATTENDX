import { Router } from 'express'
import crypto from 'node:crypto'
import QRCode from 'qrcode'
import { z } from 'zod'
import { pool } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { encryptQR, decryptQR } from '../utils/crypto.js'
import { haversineMeters } from '../utils/geo.js'
import type { Server } from 'socket.io'
import type { AuthedRequest } from '../types.js'

export function attendanceRouter(io: Server) {
  const router = Router()

  router.post('/sessions', requireAuth, requireRole('faculty', 'admin'), async (req: AuthedRequest, res) => {
    const body = z.object({ courseId: z.string().uuid() }).parse(req.body)
    const expiresAt = new Date(Date.now() + 30_000)
    const payload = encryptQR({ courseId: body.courseId, facultyId: req.user!.id, nonce: crypto.randomUUID(), exp: expiresAt.toISOString() })
    const { rows } = await pool.query(
      'insert into attendance_sessions(course_id, faculty_id, encrypted_payload, expires_at) values($1, $2, $3, $4) returning *',
      [body.courseId, req.user!.id, payload, expiresAt],
    )
    const qrDataUrl = await QRCode.toDataURL(payload)
    io.to(`course:${body.courseId}`).emit('attendance:session-created', rows[0])
    res.status(201).json({ session: rows[0], qrDataUrl })
  })

  router.post('/mark', requireAuth, requireRole('student'), async (req: AuthedRequest, res) => {
    const body = z.object({ qrToken: z.string(), latitude: z.number(), longitude: z.number() }).parse(req.body)
    const decoded = decryptQR(body.qrToken)
    const { rows } = await pool.query(
      `select s.id as session_id, s.expires_at, c.id as course_id, c.latitude, c.longitude, c.radius_meters
       from attendance_sessions s join courses c on c.id = s.course_id
       where s.encrypted_payload = $1 and s.active = true`,
      [body.qrToken],
    )
    const session = rows[0]
    if (!session || new Date(session.expires_at).getTime() < Date.now() || decoded.courseId !== session.course_id) {
      return res.status(400).json({ message: 'QR code expired or invalid' })
    }

    const distance = haversineMeters(
      { latitude: session.latitude, longitude: session.longitude },
      { latitude: body.latitude, longitude: body.longitude },
    )
    const inside = distance <= session.radius_meters
    const riskScore = inside ? 5 : 82
    const status = inside ? 'present' : 'rejected_geofence'

    const record = await pool.query(
      `insert into attendance_records(session_id, student_id, latitude, longitude, distance_meters, ip_address, user_agent, status, risk_score)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict(session_id, student_id) do update set latitude=$3, longitude=$4, distance_meters=$5, status=$8, risk_score=$9
       returning *`,
      [session.session_id, req.user!.id, body.latitude, body.longitude, distance, req.ip, req.headers['user-agent'], status, riskScore],
    )
    io.to(`course:${session.course_id}`).emit('attendance:marked', record.rows[0])
    res.status(inside ? 201 : 403).json({ record: record.rows[0], insideGeofence: inside, distanceMeters: Math.round(distance) })
  })

  router.get('/live/:courseId', requireAuth, async (req, res) => {
    const { rows } = await pool.query(
      `select ar.*, u.name, u.email from attendance_records ar
       join users u on u.id = ar.student_id
       join attendance_sessions s on s.id = ar.session_id
       where s.course_id = $1 order by ar.created_at desc limit 100`,
      [req.params.courseId],
    )
    res.json({ records: rows })
  })

  return router
}
