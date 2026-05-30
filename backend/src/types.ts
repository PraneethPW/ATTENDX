import type { Request } from 'express'

export type Role = 'student' | 'faculty' | 'admin'

export type AuthUser = {
  id: string
  email: string
  role: Role
}

export type AuthedRequest = Request & {
  user?: AuthUser
}
