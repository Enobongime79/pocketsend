import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const hmacSha256 = (key: string, s: string) => createHmac('sha256', key).update(s).digest('hex')

/** Constant-time string comparison, so response timing never leaks how much of a secret matched. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export const newToken = () => randomBytes(32).toString('base64url')
/** A 6-digit code from a cryptographically secure source. */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

/** Tiny in-memory limiter, enough for one server. Use Redis or your host's rate limiting when you run several. */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  constructor(private max: number, private windowMs: number) {}
  hit(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs)
    if (recent.length >= this.max) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(now)
    this.hits.set(key, recent)
    return true
  }
}
