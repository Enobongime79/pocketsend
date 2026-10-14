import { useMemo, useState } from 'react'
import { paymentCoverage } from '../../lib/stats'
import type { Group } from '../../types'
import { Button } from '../ui/Button'
import { PaymentRow } from './PaymentRow'

const PAGE = 8

export function PaymentsFeed({ group, className }: { group: Group; className?: string }) {
  const [shown, setShown] = useState(PAGE)
  const coverage = useMemo(() => paymentCoverage(group), [group])
  const payments = group.payments
  const visible = payments.slice(0, shown)
  const payers = new Set(payments.filter((p) => p.status === 'confirmed').map((p) => p.payerKey)).size
  return (
    <section aria-labelledby="payments-h" className={className}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="payments-h" className="text-lg font-medium md:text-[22px]">Payments</h2>
        <span className="font-mono text-xs text-subtle">{payments.length} payments · {payers} payers</span>
      </div>
      <ul className="card overflow-hidden">
        {visible.map((p, i) => (
          <PaymentRow key={p.id} payment={p} coverage={coverage.get(p.id)}
            isNew={i === 0 && p.status === 'confirmed' && Date.now() - new Date(p.createdAt).getTime() < 60_000} />
        ))}
      </ul>
      {shown < payments.length && <Button block className="mt-3" onClick={() => setShown((s) => s + PAGE)}>Load more</Button>}
    </section>
  )
}
