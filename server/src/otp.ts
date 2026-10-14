import type { Db, Queryable } from './db.js'
import { HttpError } from './errors.js'
import { hmacSha256, newCode, safeEqual } from './security.js'

export type Purpose = 'login' | 'withdrawal'

export const OTP_TTL_MINUTES = 10
export const MAX_ATTEMPTS = 5
export const RESEND_COOLDOWN_SECONDS = 30
export const MAX_CODES_PER_HOUR = 5

const hashCode = (pepper: string, email: string, purpose: Purpose, code: string) =>
  hmacSha256(pepper, `${email}:${purpose}:${code}`)

/** Creates a code, stores only its keyed hash, and returns the plain code so the caller can email it. */
export async function issueCode(db: Db, pepper: string, input: { email: string; purpose: Purpose }): Promise<string> {
  const { email, purpose } = input
  const last = await db.query(
    `select extract(epoch from (now() - created_at))::int as age
       from otp_codes where email = $1 and purpose = $2 order by created_at desc limit 1`,
    [email, purpose],
  )
  if (last[0] && last[0].age < RESEND_COOLDOWN_SECONDS) {
    const retryAfter = RESEND_COOLDOWN_SECONDS - last[0].age
    throw new HttpError(429, 'cooldown', `Please wait ${retryAfter} seconds before asking for another code.`, { retryAfter })
  }
  const hourly = await db.query(
    `select count(*)::int as n from otp_codes where email = $1 and purpose = $2 and created_at > now() - interval '1 hour'`,
    [email, purpose],
  )
  if (hourly[0].n >= MAX_CODES_PER_HOUR) {
    throw new HttpError(429, 'too_many_codes', 'Too many codes requested. Try again in a while.')
  }

  const code = newCode()
  await db.query(
    `insert into otp_codes (email, purpose, code_hash, expires_at)
     values ($1, $2, $3, now() + interval '${OTP_TTL_MINUTES} minutes')`,
    [email, purpose, hashCode(pepper, email, purpose, code)],
  )
  return code
}

/**
 * Checks a code. Every wrong guess is counted, and after MAX_ATTEMPTS the code is dead even if the right one is typed
 * afterwards. A correct code is consumed so it cannot be used twice.
 */
export async function checkCode(db: Db, pepper: string, input: { email: string; purpose: Purpose; code: string }): Promise<boolean> {
  const { email, purpose, code } = input
  return db.tx(async (q: Queryable) => {
    const rows = await q.query(
      `select id, code_hash, attempts from otp_codes
        where email = $1 and purpose = $2 and consumed_at is null and expires_at > now()
        order by created_at desc limit 1 for update`,
      [email, purpose],
    )
    const row = rows[0]
    if (!row || row.attempts >= MAX_ATTEMPTS) return false
    await q.query('update otp_codes set attempts = attempts + 1 where id = $1', [row.id])
    if (!safeEqual(String(row.code_hash), hashCode(pepper, email, purpose, code))) return false
    await q.query('update otp_codes set consumed_at = now() where id = $1', [row.id])
    return true
  })
}
