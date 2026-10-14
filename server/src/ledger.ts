import type { Queryable, Row } from './db.js'
import type { Config } from './config.js'

const iso = (d: unknown) => new Date(d as string).toISOString()

/**
 * Kora pays out from ONE pooled merchant balance, not from each virtual account. So this app keeps its own ledger and
 * must never let a group withdraw more than it has collected:
 *   available = confirmed payments (minus Kora's pay-in fee) - withdrawals that are processing or successful
 * Failed withdrawals do not count, so a failed payout gives the money back.
 */
export async function getBalances(q: Queryable, cfg: Config, groupId: string) {
  const rows = await q.query(
    `select
       coalesce((select sum(amount_kobo - fee_kobo) from payments where group_id = $1 and status = 'confirmed'), 0)::bigint
     - coalesce((select sum(amount_kobo + fee_kobo) from withdrawals where group_id = $1 and status in ('processing', 'success')), 0)::bigint
       as available`,
    [groupId],
  )
  const availableKobo = Number(rows[0].available)
  return { availableKobo, withdrawableKobo: Math.max(0, availableKobo - cfg.payoutFeeReserveKobo) }
}

export function mapPayment(r: Row) {
  return {
    id: r.id as string,
    reference: r.kora_reference as string,
    payerKey: r.payer_key as string,
    payerName: r.payer_name as string,
    senderBank: r.sender_bank as string,
    senderAccountLast4: r.sender_account_last4 as string,
    amountKobo: Number(r.amount_kobo),
    status: r.status as string,
    createdAt: iso(r.paid_at),
  }
}

export function mapGroup(r: Row, payments: Row[], balances: { availableKobo: number; withdrawableKobo: number }) {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    amountType: r.amount_type as 'fixed' | 'open',
    amountKobo: Number(r.amount_kobo),
    targetKobo: r.target_kobo === null ? undefined : Number(r.target_kobo),
    closesAt: r.closes_at ? iso(r.closes_at) : undefined,
    status: r.status as string,
    virtualAccount: { accountNumber: r.account_number as string, bankName: r.bank_name as string, accountName: r.account_name as string },
    payments: payments.map(mapPayment),
    ...balances,
  }
}

export function mapWithdrawal(r: Row) {
  return {
    id: r.id as string,
    amountKobo: Number(r.amount_kobo),
    status: r.status as 'processing' | 'success' | 'failed',
    bankName: r.bank_name as string,
    accountName: r.account_name as string,
    accountLast4: String(r.account_number).slice(-4),
    failureReason: (r.failure_reason as string | null) ?? undefined,
    createdAt: iso(r.created_at),
  }
}
