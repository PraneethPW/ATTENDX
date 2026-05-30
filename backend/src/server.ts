import 'dotenv/config'
import http from 'node:http'
import crypto from 'node:crypto'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import QRCode from 'qrcode'
import { Server } from 'socket.io'
import { z } from 'zod'
import { decryptQR, encryptQR } from './utils/crypto.js'
import { haversineMeters } from './utils/geo.js'
import type { AuthUser, Role } from './types.js'

type User = AuthUser & { name: string; password: string; department: string; phone?: string; profilePhoto?: string; registeredDeviceId?: string; deviceApproved: boolean; twoFactorEnabled: boolean; createdAt: string }
type Course = { id: string; title: string; code: string; room: string; facultyId: string; latitude: number; longitude: number; radiusMeters: number; createdAt: string }
type Session = { id: string; courseId: string; facultyId: string; qrToken: string; qrDataUrl: string; expiresAt: string; active: boolean; createdAt: string }
type Attendance = { id: string; sessionId: string; courseId: string; studentId: string; studentName: string; distanceMeters: number; status: 'present' | 'late' | 'rejected_geofence'; riskScore: number; latitude: number; longitude: number; proofImage?: string; proofMeta?: Record<string, unknown>; createdAt: string }
type Assignment = { id: string; courseId: string; studentId: string; title: string; fileName: string; status: string; createdAt: string }
type AuditLog = { id: string; actorId: string; action: string; metadata: Record<string, unknown>; createdAt: string }

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()

const users: User[] = [
  { id: 'fac-1', name: 'Dr. Aisha Rao', email: 'faculty@attendx.edu', password: 'password123', role: 'faculty', department: 'Computer Science', phone: '+91 90000 10001', deviceApproved: true, twoFactorEnabled: true, createdAt: now() },
  { id: 'stu-1', name: 'Pranesh Kumar', email: 'student@attendx.edu', password: 'password123', role: 'student', department: 'CSE AI', phone: '+91 90000 20002', deviceApproved: true, twoFactorEnabled: true, createdAt: now() },
]

const courses: Course[] = [
  { id: 'course-ml', title: 'Applied Machine Learning', code: 'CSE-402', room: 'Innovation Lab 3', facultyId: 'fac-1', latitude: 28.6139, longitude: 77.209, radiusMeters: 180, createdAt: now() },
  { id: 'course-db', title: 'Advanced PostgreSQL', code: 'CSE-318', room: 'Database Studio', facultyId: 'fac-1', latitude: 28.6139, longitude: 77.209, radiusMeters: 180, createdAt: now() },
]

const sessions: Session[] = []
const attendance: Attendance[] = []
const assignments: Assignment[] = []
const auditLogs: AuditLog[] = []

const app = express()
const server = http.createServer(app)
const allowedOrigins = [
  ...(process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://attendx-tau.vercel.app',
]
const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } })
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

app.use(helmet())
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(rateLimit({ windowMs: 60_000, limit: 180 }))

function sign(user: AuthUser) {
  return jwt.sign(user, process.env.JWT_SECRET || 'attendx-dev-secret', { expiresIn: '7d' })
}

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : ''
  try {
    res.locals.user = jwt.verify(token, process.env.JWT_SECRET || 'attendx-dev-secret') as AuthUser
    next()
  } catch {
    res.status(401).json({ message: 'Please login again.' })
  }
}

function roles(...allowed: Role[]) {
  return (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.user as AuthUser
    if (!allowed.includes(user.role)) return res.status(403).json({ message: 'This account does not have access to that action.' })
    next()
  }
}

function audit(actorId: string, action: string, metadata: Record<string, unknown>) {
  auditLogs.unshift({ id: id(), actorId, action, metadata, createdAt: now() })
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'AttendX API', mode: process.env.DATABASE_URL ? 'neon-ready' : 'local-functional' })
})

app.post('/api/auth/register', (req, res) => {
  const body = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['student', 'faculty']),
    department: z.string().min(2),
    phone: z.string().optional(),
    deviceId: z.string().min(8).optional(),
  }).parse(req.body)

  if (users.some((user) => user.email.toLowerCase() === body.email.toLowerCase())) {
    return res.status(409).json({ message: 'An account already exists for this email.' })
  }

  const user: User = { id: id(), ...body, registeredDeviceId: body.deviceId, deviceApproved: true, twoFactorEnabled: true, createdAt: now() }
  users.push(user)
  audit(user.id, 'auth.register', { role: user.role })
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, phone: user.phone, profilePhoto: user.profilePhoto, twoFactorEnabled: user.twoFactorEnabled }
  res.status(201).json({ user: safeUser, token: sign({ id: user.id, email: user.email, role: user.role }) })
})

app.post('/api/auth/login', (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1), deviceId: z.string().min(8).optional(), otp: z.string().optional(), provider: z.string().optional() }).parse(req.body)
  const user = users.find((item) => item.email.toLowerCase() === body.email.toLowerCase() && item.password === body.password)
  if (!user) return res.status(401).json({ message: 'Invalid email or password.' })
  if (!user.registeredDeviceId && body.deviceId) user.registeredDeviceId = body.deviceId
  if (user.registeredDeviceId && body.deviceId && user.registeredDeviceId !== body.deviceId) {
    audit(user.id, 'auth.new_device_blocked', { deviceId: body.deviceId })
    return res.status(423).json({ message: 'New Device Detected. Faculty Approval Required.', code: 'NEW_DEVICE_APPROVAL_REQUIRED' })
  }
  if (user.twoFactorEnabled && body.otp && body.otp !== '123456') {
    return res.status(401).json({ message: 'Invalid 2FA code.' })
  }
  audit(user.id, 'auth.login', { role: user.role })
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, phone: user.phone, profilePhoto: user.profilePhoto, twoFactorEnabled: user.twoFactorEnabled }
  res.json({ user: safeUser, token: sign({ id: user.id, email: user.email, role: user.role }) })
})

app.get('/api/auth/me', auth, (_req, res) => {
  const tokenUser = res.locals.user as AuthUser
  const user = users.find((item) => item.id === tokenUser.id)
  res.json({ user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, phone: user.phone, profilePhoto: user.profilePhoto, twoFactorEnabled: user.twoFactorEnabled } : tokenUser })
})

app.patch('/api/auth/profile', auth, (req, res) => {
  const tokenUser = res.locals.user as AuthUser
  const user = users.find((item) => item.id === tokenUser.id)
  if (!user) return res.status(404).json({ message: 'User not found.' })
  const body = z.object({ name: z.string().min(2).optional(), email: z.string().email().optional(), phone: z.string().optional(), department: z.string().optional(), profilePhoto: z.string().optional() }).parse(req.body)
  Object.assign(user, body)
  audit(user.id, 'profile.update', { fields: Object.keys(body) })
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, phone: user.phone, profilePhoto: user.profilePhoto, twoFactorEnabled: user.twoFactorEnabled } })
})

app.get('/api/courses', auth, (_req, res) => {
  res.json({ courses: courses.map((course) => ({ ...course, facultyName: users.find((user) => user.id === course.facultyId)?.name || 'Faculty' })) })
})

app.post('/api/courses', auth, roles('faculty', 'admin'), (req, res) => {
  const user = res.locals.user as AuthUser
  const body = z.object({
    title: z.string().min(3),
    code: z.string().min(2),
    room: z.string().min(2),
    latitude: z.number(),
    longitude: z.number(),
    radiusMeters: z.number().min(20).max(1000),
  }).parse(req.body)
  const course: Course = { id: id(), facultyId: user.id, createdAt: now(), ...body }
  courses.unshift(course)
  audit(user.id, 'course.create', { courseId: course.id })
  io.emit('course:created', course)
  res.status(201).json({ course })
})

app.post('/api/attendance/sessions', auth, roles('faculty', 'admin'), async (req, res) => {
  const user = res.locals.user as AuthUser
  const body = z.object({ courseId: z.string() }).parse(req.body)
  const course = courses.find((item) => item.id === body.courseId)
  if (!course) return res.status(404).json({ message: 'Course not found.' })
  const expiresAt = new Date(Date.now() + 90_000).toISOString()
  const qrToken = encryptQR({ courseId: course.id, facultyId: user.id, nonce: id(), exp: expiresAt })
  const qrDataUrl = await QRCode.toDataURL(qrToken, { margin: 1, width: 340 })
  const session: Session = { id: id(), courseId: course.id, facultyId: user.id, qrToken, qrDataUrl, expiresAt, active: true, createdAt: now() }
  sessions.unshift(session)
  audit(user.id, 'attendance.session.create', { courseId: course.id, sessionId: session.id })
  io.to(`course:${course.id}`).emit('attendance:session-created', session)
  res.status(201).json({ session })
})

app.get('/api/attendance/sessions/latest', auth, (req, res) => {
  const courseId = String(req.query.courseId || '')
  const session = sessions.find((item) => item.courseId === courseId && item.active)
  res.json({ session: session || null })
})

app.post('/api/attendance/mark', auth, roles('student'), (req, res) => {
  const user = res.locals.user as AuthUser
  const body = z.object({ qrToken: z.string(), latitude: z.number(), longitude: z.number(), proofImage: z.string().optional(), deviceId: z.string().optional() }).parse(req.body)
  let decoded: { courseId: string; exp: string }
  try {
    decoded = decryptQR(body.qrToken)
  } catch {
    return res.status(400).json({ message: 'Invalid QR token.' })
  }
  const session = sessions.find((item) => item.qrToken === body.qrToken && item.active)
  const course = courses.find((item) => item.id === decoded.courseId)
  const expired = new Date(decoded.exp).getTime() < Date.now()
  if (!session || !course) return res.status(400).json({ message: 'QR code invalid. Ask faculty to generate a new one.' })
  if (expired && !body.proofImage) {
    return res.status(428).json({ message: 'Attendance window closed. Live camera proof and GPS location are required for late attendance.', code: 'LIVE_CAMERA_PROOF_REQUIRED' })
  }

  const distance = haversineMeters({ latitude: course.latitude, longitude: course.longitude }, { latitude: body.latitude, longitude: body.longitude })
  const inside = distance <= course.radiusMeters
  const student = users.find((item) => item.id === user.id)
  const previousIndex = attendance.findIndex((item) => item.sessionId === session.id && item.studentId === user.id)
  const record: Attendance = {
    id: previousIndex >= 0 ? attendance[previousIndex].id : id(),
    sessionId: session.id,
    courseId: course.id,
    studentId: user.id,
    studentName: student?.name || user.email,
    latitude: body.latitude,
    longitude: body.longitude,
    distanceMeters: Math.round(distance),
    status: inside ? (expired ? 'late' : 'present') : 'rejected_geofence',
    riskScore: inside ? (expired ? 32 : 4) : 88,
    proofImage: body.proofImage,
    proofMeta: body.proofImage ? { timestamp: now(), latitude: body.latitude, longitude: body.longitude, userId: user.id, sessionId: session.id, deviceId: body.deviceId } : undefined,
    createdAt: now(),
  }
  if (previousIndex >= 0) attendance[previousIndex] = record
  else attendance.unshift(record)
  audit(user.id, 'attendance.mark', { courseId: course.id, status: record.status, distanceMeters: record.distanceMeters, hasCameraProof: Boolean(body.proofImage) })
  io.to(`course:${course.id}`).emit('attendance:marked', record)
  res.status(inside ? 201 : 403).json({ record, insideGeofence: inside })
})

app.get('/api/attendance/live/:courseId', auth, (req, res) => {
  res.json({ records: attendance.filter((item) => item.courseId === req.params.courseId) })
})

app.post('/api/assignments', auth, roles('student'), upload.single('file'), (req, res) => {
  const user = res.locals.user as AuthUser
  const body = z.object({ courseId: z.string(), title: z.string().min(3) }).parse(req.body)
  if (!req.file) return res.status(400).json({ message: 'Please attach a file.' })
  const assignment: Assignment = { id: id(), courseId: body.courseId, studentId: user.id, title: body.title, fileName: req.file.originalname, status: 'Uploaded for review', createdAt: now() }
  assignments.unshift(assignment)
  audit(user.id, 'assignment.upload', { courseId: body.courseId, assignmentId: assignment.id })
  io.to(`course:${body.courseId}`).emit('assignment:uploaded', assignment)
  res.status(201).json({ assignment })
})

app.get('/api/assignments/mine', auth, (req, res) => {
  const user = res.locals.user as AuthUser
  res.json({ assignments: assignments.filter((item) => item.studentId === user.id) })
})

app.get('/api/analytics/overview', auth, (_req, res) => {
  const present = attendance.filter((item) => item.status === 'present').length
  const rejected = attendance.filter((item) => item.status === 'rejected_geofence').length
  const total = attendance.length
  res.json({
    metrics: {
      attendanceRate: total ? Math.round((present / total) * 100) : 0,
      liveSessions: sessions.filter((item) => item.active && new Date(item.expiresAt).getTime() > Date.now()).length,
      uploadedAssignments: assignments.length,
      securityFlags: rejected,
    },
    attendance,
    assignments,
    auditLogs: auditLogs.slice(0, 20),
  })
})

app.post('/api/ai/insights', auth, roles('faculty', 'admin'), async (req, res) => {
  const body = z.object({ prompt: z.string().min(5) }).parse(req.body)
  if (!process.env.OPENROUTER_API_KEY) {
    return res.json({ insight: `AI is ready to connect. Add OPENROUTER_API_KEY to summarize this: ${body.prompt}` })
  }
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'AttendX' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324:free',
      messages: [
        { role: 'system', content: 'You are AttendX AI. Give concise attendance risk and intervention insights.' },
        { role: 'user', content: body.prompt },
      ],
    }),
  })
  const data = await response.json()
  res.json({ insight: data.choices?.[0]?.message?.content || 'No insight returned.' })
})

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next()
  try {
    socket.data.user = jwt.verify(token, process.env.JWT_SECRET || 'attendx-dev-secret') as AuthUser
  } catch {
    socket.data.user = null
  }
  next()
})

io.on('connection', (socket) => {
  socket.on('course:join', (courseId: string) => socket.join(`course:${courseId}`))
})

const port = Number(process.env.PORT || 4000)
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the old backend process or run with a different PORT, for example: $env:PORT=4100; npm run dev`)
    process.exit(1)
  }
  throw error
})

server.listen(port, () => console.log(`AttendX API running on http://localhost:${port}`))
