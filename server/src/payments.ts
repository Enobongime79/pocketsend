import type { Queryable, Row } from './db.js'
import type { Deps } from './types.js'
import { sha256 } from './security.js'

export const toKobo = (naira: number) => Math.round(naira * 100)

/**
 * Who sent a payment. Kora's webhook gives the sender's account name, bank and a MASKED account number (like ******1001),
 * so the identity is a hash of bank + last 4 digits + name. Two different people who share a bank, last 4 digits and name
 * would be merged, and one person using two accounts would be split. That is the limit of what the webhook tells us.
 */
export function payerIdentity(name: string, bank: string, accountNumber: string) {
  const last4 = accountNumber.replace(/\D/g, '').slice(-4).padStart(4, '0')
  const cleanName = name.trim().toLowerCase().replace(/\s+/g, ' ')
  return { key: sha256(`${bank.trim().toLowerCase()}|${last4}|${cleanName}`).slice(0, 24), last4 }
}

export interface IncomingPayment {
  groupId: string
  reference: string
  payerName: string
  payerBank: string
  payerAccountNumber: string
  amountNaira: number
  feeNaira: number
  paidAt: Date
}

/** Records a confirmed payment. The reference is unique, so recording the same payment twice is harmless. */
export async function recordPayment(q: Queryable, p: IncomingPayment): Promise<boolean> {
  const name = p.payerName.trim() || 'Unknown sender'
  const bank = p.payerBank.trim() || 'Unknown bank'
  const { key, last4 } = payerIdentity(name, bank, p.payerAccountNumber)
  const rows = await q.query(
    `insert into payments (group_id, kora_reference, payer_key, payer_name, sender_bank, sender_account_last4, amount_kobo, fee_kobo, status, paid_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $9)
     on conflict (kora_reference) do nothing returning id`,
    [p.groupId, p.reference, key, name, bank, last4, toKobo(p.amountNaira), toKobo(p.feeNaira), p.paidAt.toISOString()],
  )
  return rows.length > 0
}

/**
 * Pulls a group's payments straight from Kora and records any we do not have yet. This is the safety net for a missed
 * webhook (Kora retries for 72 hours, but a bug or downtime on your side can still lose one) and it also lets you test
 * locally without exposing your server to the internet.
 */
export async function syncGroupPayments(d: Deps, group: Row): Promise<number> {
  const txs = await d.kora.listVbaTransactions(group.account_number)
  let added = 0
  for (const t of txs) {
    if (t.status !== 'success') continue
    const inserted = await recordPayment(d.db, {
      groupId: group.id,
      reference: t.reference,
      payerName: t.payerName,
      payerBank: t.payerBank,
      payerAccountNumber: t.payerAccountNumber,
      amountNaira: t.amountNaira,
      feeNaira: t.feeNaira,
      paidAt: new Date(),
    })
    if (inserted) added += 1
  }
  return added
}
