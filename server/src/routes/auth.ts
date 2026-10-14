import { Router, type RequestHandler, type Response } from 'express'
import { z } from 'zod'
import { HttpError, h } from '../errors.js'
import { codeEmail } from '../mailer.js'
import { checkCode, issueCode } from '../otp.js'
import { RateLimiter, newToken, parseCookies, sha256 } from '../security.js'
import type { AuthedUser, Deps } from '../types.js'

export const SESSION_COOKIE = 'ps_session'
const SESSION_DAYS = 7

const cookie = (d: Deps, value: string, maxAgeSeconds: number) =>
  `${SESSION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}${d.cfg.nodeEnv === 'production' ? '; Secure' : ''}`

/** Loads the signed-in user from the session cookie, or answers 401. */
export function requireUser(d: Deps): RequestHandler {
  return (req, res, next) => {
    ;(async () => {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
      if (!token) throw new HttpError(401, 'unauthenticated', 'Please sign in.')
      const rows = await d.db.query(
        `select u.id, u.email, u.full_name from sessions s join users u on u.id = s.user_id
          where s.token_hash = $1 and s.expires_at > now()`,
        [sha256(token)],
      )
      if (!rows[0]) throw new HttpError(401, 'unauthenticated', 'Please sign in.')
      res.locals.user = { id: rows[0].id, email: rows[0].email, fullName: rows[0].full_name } satisfies AuthedUser
      next()
    })().catch(next)
  }
}

export const userOf = (res: Response) => res.locals.user as AuthedUser

const email = z.string().trim().toLowerCase().email().max(254)

export function authRoutes(d: Deps): Router {
  const r = Router()
  const ipLimiter = new RateLimiter(20, 60_000)
  const limit = (key: string) => {
    if (!ipLimiter.hit(key)) throw new HttpError(429, 'rate_limited', 'Too many attempts. Wait a minute and try again.')
  }

  r.post('/auth/request-code', h(async (req, res) => {
    limit(`code:${req.ip}`)
    const { email: to } = z.object({ email }).parse(req.body)
    const code = await issueCode(d.db, d.cfg.otpPepper, { email: to, purpose: 'login' })
    try {
      await d.mailer.send(codeEmail(to, code, 'login'))
    } catch (err) {
      console.error('Could not send sign-in email:', (err as Error).message)
      throw new HttpError(502, 'email_failed', 'We could not send the email. Try again in a moment.')
    }
    // Same answer whether or not this email already has an account
    res.sendStatus(204)
  }))

  r.post('/auth/verify-code', h(async (req, res) => {
    limit(`verify:${req.ip}`)
    const body = z.object({ email, code: z.string().regex(/^\d{6}$/) }).parse(req.body)
    const ok = await checkCode(d.db, d.cfg.otpPepper, { email: body.email, purpose: 'login', code: body.code })
    if (!ok) throw new HttpError(400, 'invalid_code', 'That code is not right or has expired.')

    const user = (await d.db.query(
      `insert into users (email) values ($1) on conflict (email) do update set email = excluded.email returning id, email, full_name`,
      [body.email],
    ))[0]
    const token = newToken()
    await d.db.query(
      `insert into sessions (user_id, token_hash, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`,
      [user.id, sha256(token)],
    )
    res.setHeader('Set-Cookie', cookie(d, token, SESSION_DAYS * 86400))
    res.json({ user: { email: user.email, fullName: user.full_name } })
  }))

  r.get('/me', requireUser(d), (_req, res) => {
    const u = userOf(res)
    res.json({ user: { email: u.email, fullName: u.fullName } })
  })

  r.post('/auth/logout', h(async (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (token) await d.db.query('delete from sessions where token_hash = $1', [sha256(token)])
    res.setHeader('Set-Cookie', cookie(d, '', 0))
    res.sendStatus(204)
  }))

  return r
}
