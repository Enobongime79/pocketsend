import type { Group } from '../types'

export function computeTotals(g: Group) {
  const confirmed = g.payments.filter((p) => p.status === 'confirmed')
  const collectedKobo = confirmed.reduce((s, p) => s + p.amountKobo, 0)
  const pendingKobo = g.payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amountKobo, 0)
  return {
    collectedKobo,
    pendingKobo,
    availableKobo: g.availableKobo, // from the server's ledger: payments minus fees minus withdrawals
    paymentCount: confirmed.length,
    payerCount: new Set(confirmed.map((p) => p.payerKey)).size,
    percent: g.targetKobo ? Math.round((collectedKobo / g.targetKobo) * 100) : null,
  }
}

export interface Coverage {
  paidToDateKobo: number // what this sender has paid in total, up to and including this payment
  remainingKobo: number
  complete: boolean // true = Full, false = Partial
}

/**
 * For fixed-amount groups only: after each confirmed payment, has that sender now paid the full amount?
 * Payments are walked oldest to newest, so a first instalment shows Partial and the one that completes it shows Full.
 * Open-amount groups return an empty map (nothing to compare against). The server should ideally send this.
 */
export function paymentCoverage(g: Group): Map<string, Coverage> {
  const out = new Map<string, Coverage>()
  if (g.amountType !== 'fixed') return out
  const running = new Map<string, number>()
  const confirmed = g.payments
    .filter((p) => p.status === 'confirmed')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  for (const p of confirmed) {
    const total = (running.get(p.payerKey) ?? 0) + p.amountKobo
    running.set(p.payerKey, total)
    out.set(p.id, { paidToDateKobo: total, remainingKobo: Math.max(0, g.amountKobo - total), complete: total >= g.amountKobo })
  }
  return out
}
