import { compactNaira } from '../../lib/format'
import type { computeTotals } from '../../lib/stats'

/** Phone only. On desktop the same numbers sit in the page header. */
export function StatTiles({ totals, className }: { totals: ReturnType<typeof computeTotals>; className?: string }) {
  const tiles = [
    { value: String(totals.paymentCount), label: 'payments' },
    { value: String(totals.payerCount), label: 'people' },
    { value: compactNaira(totals.pendingKobo), label: 'pending' },
  ]
  return (
    <dl className={`flex gap-2 ${className ?? ''}`}>
      {tiles.map((t) => (
        <div key={t.label} className="card flex-1 p-2.5">
          <dd className="mb-0.5 font-mono text-[15px]">{t.value}</dd>
          <dt className="text-xs text-muted">{t.label}</dt>
        </div>
      ))}
    </dl>
  )
}
