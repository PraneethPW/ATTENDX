import crypto from 'node:crypto'

const algorithm = 'aes-256-gcm'

function key() {
  return crypto.createHash('sha256').update(process.env.QR_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'attendx-dev-secret').digest()
}

export function encryptQR(payload: object) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(algorithm, key(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

export function decryptQR(token: string) {
  const raw = Buffer.from(token, 'base64url')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = crypto.createDecipheriv(algorithm, key(), iv)
  decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'))
}
