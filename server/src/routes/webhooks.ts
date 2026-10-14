import { Router } from 'express'
import { HttpError, h } from '../errors.js'
import { recordPayment, toKobo } from '../payments.js'
import { hmacSha256, safeEqual } from '../security.js'
import type { Deps } from '../types.js'

/**
 * Kora calls this when a transfer lands in a virtual account (charge.success) or a payout finishes
 * (transfer.success / transfer.failed). Set its public URL in Kora Dashboard > Settings > API Configuration.
 *
 * Rules from Kora's docs, all followed here:
 *   - the x-korapay-signature header is an HMAC SHA256 of ONLY the `data` object, signed with your secret key
 *   - answer 200 only when the notification is handled. Any other answer makes Kora retry for 72 hours
 *   - the same notification can arrive more than once, so handling must be safe to repeat
 *   - confirm a payment with Kora's charge query before giving value
 */
export function webhookRoutes(d: Deps): Router {
  const r = Router()

  r.post('/kora', h(async (req, res) => {
    const body = req.body as { event?: string; data?: Record<string, any> }
    if (!body || typeof body.data !== 'object' || body.data === null) throw new HttpError(400, 'bad_request', 'Invalid payload.')

    const expected = hmacSha256(d.cfg.koraSecretKey, JSON.stringify(body.data))
    if (!safeEqual(String(req.header('x-korapay-signature') ?? ''), expected)) {
      throw new HttpError(401, 'bad_signature', 'Invalid signature.')
    }

    const data = body.data
    if (body.event === 'charge.success') await handleCharge(d, data)
    else if (body.event === 'transfer.success' || body.event === 'transfer.failed') await handleTransfer(d, body.event, data)
    // Other events (refunds, failed charges) are acknowledged and ignored

    // Audit trail. Written AFTER handling so a crash above means Kora retries and nothing is skipped.
    await d.db.query(
      'insert into webhook_events (event, reference, payload) values ($1, $2, $3) on conflict (event, reference) do nothing',
      [String(body.event), String(data.reference ?? ''), JSON.stringify(body)],
    )
    res.sendStatus(200)
  }))

  return r
}

async function handleCharge(d: Deps, data: Record<string, any>) {
  const vba = data.virtual_bank_account_details
  if (!vba) return // not a virtual account payment (card, mobile money...). PocketSend only collects by transfer.

  const account = vba.virtual_bank_account ?? {}
  const group = (await d.db.query(
    'select id from groups where kora_account_reference = $1 or account_number = $2 limit 1',
    [String(account.account_reference ?? ''), String(account.account_number ?? '')],
  ))[0]
  if (!group) {
    console.warn(`Webhook for an unknown virtual account (${account.account_number}). Ignored.`)
    return
  }

  let amountNaira = Number(data.amount)
  let feeNaira = Number(data.fee ?? 0)
  if (!d.cfg.skipChargeVerify) {
    // Never trust the webhook body alone: ask Kora. If Kora cannot be reached, throw so that Kora retries later.
    const charge = await d.kora.getCharge(String(data.reference))
    if (!charge) throw new Error(`Could not verify charge ${data.reference}`)
    if (charge.status !== 'success') return
    amountNaira = charge.amountPaidNaira
    feeNaira = charge.feeNaira
  }
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) throw new Error(`Bad amount on charge ${data.reference}`)

  const payer = vba.payer_bank_account ?? {}
  const when = new Date(String(data.transaction_date ?? ''))
  await recordPayment(d.db, {
    groupId: group.id,
    reference: String(data.reference),
    payerName: String(payer.account_name ?? ''),
    payerBank: String(payer.bank_name ?? ''),
    payerAccountNumber: String(payer.account_number ?? ''),
    amountNaira,
    feeNaira,
    paidAt: Number.isNaN(when.getTime()) ? new Date() : when,
  })
}

async function handleTransfer(d: Deps, event: 'transfer.success' | 'transfer.failed', data: Record<string, any>) {
  const status = event === 'transfer.success' ? 'success' : 'failed'
  await d.db.query(
    `update withdrawals
        set status = $2::text,
            fee_kobo = case when $2::text = 'success' and $3::bigint > 0 then $3::bigint else fee_kobo end,
            failure_reason = case when $2::text = 'failed' then $4::text else null end,
            completed_at = now()
      where kora_reference = $1 and status = 'processing'`,
    [String(data.reference), status, toKobo(Number(data.fee ?? 0)), String(data.message ?? 'The transfer failed.')],
  )
}
