import jwt from 'jsonwebtoken'
import type { NextFunction, Response } from 'express'
import type { AuthedRequest, Role } from '../types.js'

export function signToken(user: { id: string; email: string; role: Role }) {
  return jwt.sign(user, process.env.JWT_SECRET || 'attendx-dev-secret', { expiresIn: '7d' })
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return res.status(401).json({ message: 'Missing authorization token' })

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'attendx-dev-secret') as AuthedRequest['user']
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
    next()
  }
}
