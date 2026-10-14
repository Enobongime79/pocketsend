import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { HttpError, h } from '../errors.js'
import { KoraError } from '../kora.js'
import { getBalances, mapWithdrawal } from '../ledger.js'
import { codeEmail } from '../mailer.js'
import { checkCode, issueCode } from '../otp.js'
import { RateLimiter } from '../security.js'
import type { Deps } from '../types.js'
import { requireUser, userOf } from './auth.js'

const toKobo = (naira: number) => Math.round(naira * 100)

export function withdrawalRoutes(d: Deps): Router {
  const r = Router()
  r.use(requireUser(d))
  const resolveLimiter = new RateLimiter(20, 60_000)

  // Bank list from Kora, cached for six hours
  let bankCache: { at: number; list: { name: string; code: string }[] } | null = null
  async function banks() {
    if (!bankCache || Date.now() - bankCache.at > 6 * 3600_000) bankCache = { at: Date.now(), list: await d.kora.listBanks() }
    return bankCache.list
  }

  r.get('/banks', h(async (_req, res) => {
    res.json({ banks: await banks() })
  }))

  /** Check a bank account name before sending money. Limited so it cannot be used to probe accounts. */
  r.post('/banks/resolve', h(async (req, res) => {
    if (!resolveLimiter.hit(userOf(res).id)) throw new HttpError(429, 'rate_limited', 'Too many lookups. Wait a minute.')
    const body = z.object({ bankCode: z.string().regex(/^\d{2,10}$/), accountNumber: z.string().regex(/^\d{10}$/) }).parse(req.body)
    const found = await d.kora.resolveAccount(body.bankCode, body.accountNumber)
    res.json({ accountName: found.accountName })
  }))

  /** Emails a one-time code that must accompany every withdrawal. */
  r.post('/withdrawals/code', h(async (_req, res) => {
    const user = userOf(res)
    const code = await issueCode(d.db, d.cfg.otpPepper, { email: user.email, purpose: 'withdrawal' })
    await d.mailer.send(codeEmail(user.email, code, 'withdrawal')).catch(() => {
      throw new HttpError(502, 'email_failed', 'We could not send the email. Try again in a moment.')
    })
    res.sendStatus(204)
  }))

  const withdrawSchema = z.object({
    bankCode: z.string().regex(/^\d{2,10}$/),
    accountNumber: z.string().regex(/^\d{10}$/, 'An account number is 10 digits.'),
    code: z.string().regex(/^\d{6}$/),
    idempotencyKey: z.string().min(8).max(80),
  })

  r.get('/groups/:id/withdrawals', h(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const rows = await d.db.query(
      `select w.* from withdrawals w join groups g on g.id = w.group_id where g.id = $1 and g.user_id = $2 order by w.created_at desc limit 100`,
      [id, userOf(res).id],
    )
    res.json({ withdrawals: rows.map(mapWithdrawal) })
  }))

  /**
   * Withdraws everything this group can withdraw. The order matters:
   *   1. check the one-time code and the destination account name (server-side, never trusting the browser)
   *   2. in ONE database transaction, lock the group, work out the balance and write the withdrawal as 'processing'
   *   3. only then ask Kora to pay. The row exists first, so a crash cannot send money that was never recorded.
   */
  r.post('/groups/:id/withdrawals', h(async (req, res) => {
    const user = userOf(res)
    const id = z.string().uuid().parse(req.params.id)
    const input = withdrawSchema.parse(req.body)

    const group = (await d.db.query('select id from groups where id = $1 and user_id = $2', [id, user.id]))[0]
    if (!group) throw new HttpError(404, 'not_found', 'Group not found.')

    // A repeated tap or retry with the same key returns the first result instead of paying twice
    const findPrior = async () => (await d.db.query('select * from withdrawals where user_id = $1 and idempotency_key = $2', [user.id, input.idempotencyKey]))[0]
    const prior = await findPrior()
    if (prior) return res.json({ withdrawal: mapWithdrawal(prior) })

    if ((await getBalances(d.db, d.cfg, id)).withdrawableKobo <= 0) {
      throw new HttpError(409, 'nothing_to_withdraw', 'There is nothing available to withdraw yet.')
    }
    if (!(await checkCode(d.db, d.cfg.otpPepper, { email: user.email, purpose: 'withdrawal', code: input.code }))) {
      throw new HttpError(400, 'invalid_code', 'That code is not right or has expired.')
    }

    const destination = await d.kora.resolveAccount(input.bankCode, input.accountNumber)
    const bankName = (await banks().catch(() => [])).find((b) => b.code === input.bankCode)?.name ?? destination.bankName ?? input.bankCode
    const reference = `PS-WD-${randomUUID()}`

    let row
    try {
      row = await d.db.tx(async (q) => {
        await q.query('select id from groups where id = $1 for update', [id]) // one withdrawal at a time per group
        const { withdrawableKobo } = await getBalances(q, d.cfg, id)
        if (withdrawableKobo <= 0) throw new HttpError(409, 'nothing_to_withdraw', 'There is nothing available to withdraw yet.')
        return (await q.query(
          `insert into withdrawals (group_id, user_id, idempotency_key, amount_kobo, bank_code, bank_name, account_number, account_name, kora_reference, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'processing') returning *`,
          [id, user.id, input.idempotencyKey, withdrawableKobo, input.bankCode, bankName, input.accountNumber, destination.accountName, reference],
        ))[0]
      })
    } catch (err) {
      if ((err as { code?: string }).code === '23505') { // same idempotency key raced with this request
        const again = await findPrior()
        if (again) return res.json({ withdrawal: mapWithdrawal(again) })
      }
      throw err
    }

    try {
      const out = await d.kora.disburse({
        reference,
        amountNaira: Number(row.amount_kobo) / 100,
        bankCode: input.bankCode,
        accountNumber: input.accountNumber,
        narration: 'PocketSend withdrawal',
        customerName: user.fullName ?? user.email,
        customerEmail: user.email,
      })
      const status = out.status === 'success' ? 'success' : out.status === 'failed' ? 'failed' : 'processing'
      row = (await d.db.query(
        `update withdrawals set fee_kobo = $2::bigint, status = $3::text, completed_at = case when $3::text = 'processing' then null else now() end
          where id = $1 returning *`,
        [row.id, toKobo(out.feeNaira), status],
      ))[0]
      return res.status(status === 'processing' ? 202 : 200).json({ withdrawal: mapWithdrawal(row) })
    } catch (err) {
      if (err instanceof KoraError && !err.retryable) {
        // Kora clearly refused it, so no money moved and the balance is released
        await d.db.query(`update withdrawals set status = 'failed', failure_reason = $2, completed_at = now() where id = $1`, [row.id, err.message])
        throw new HttpError(422, 'payout_rejected', err.message)
      }
      // Timeout or provider error: we do NOT know whether Kora paid. Leave it 'processing' and let the
      // webhook or the reconcile job settle it. Marking it failed here could allow a second payout.
      console.error(`Payout ${reference} outcome unknown, will reconcile:`, (err as Error).message)
      return res.status(202).json({ withdrawal: mapWithdrawal(row) })
    }
  }))

  return r
}

/** Settles withdrawals stuck in 'processing' by asking Kora for their real status. Run on a timer and safe to repeat. */
export async function reconcileWithdrawals(d: Deps): Promise<number> {
  const stuck = await d.db.query(
    `select id, kora_reference, extract(epoch from (now() - created_at))::int as age
       from withdrawals where status = 'processing' and created_at < now() - interval '90 seconds' limit 50`,
  )
  let settled = 0
  for (const w of stuck) {
    try {
      const p = await d.kora.getPayout(w.kora_reference)
      if (p === null) {
        // Kora has no record. After 30 minutes we are confident the request never reached them.
        if (w.age > 30 * 60) {
          await d.db.query(`update withdrawals set status = 'failed', failure_reason = 'The payment provider never received the request.', completed_at = now() where id = $1 and status = 'processing'`, [w.id])
          settled += 1
        }
        continue
      }
      if (p.status === 'success' || p.status === 'failed') {
        await d.db.query(
          `update withdrawals set status = $2::text, fee_kobo = $3::bigint, failure_reason = case when $2::text = 'failed' then 'The transfer failed.' else null end, completed_at = now()
            where id = $1 and status = 'processing'`,
          [w.id, p.status, toKobo(p.feeNaira)],
        )
        settled += 1
      }
    } catch (err) {
      console.error(`Could not check payout ${w.kora_reference}:`, (err as Error).message)
    }
  }
  return settled
}
