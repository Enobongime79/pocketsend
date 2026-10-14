import { formatNaira } from '../../lib/format'
import type { computeTotals } from '../../lib/stats'
import type { Group } from '../../types'
import { ProgressBar } from '../ui/ProgressBar'

export function CollectedCard({ group, totals, className }: { group: Group; totals: ReturnType<typeof computeTotals>; className?: string }) {
  return (
    <section aria-label="Collected so far" className={`rounded-xl border border-hero-line bg-hero p-[18px] md:p-5 ${className ?? ''}`}>
      <p className="text-[13px] text-muted">Collected so far</p>
      <p className="my-1 mb-3 font-mono text-[30px] leading-none text-success md:text-4xl">{formatNaira(totals.collectedKobo)}</p>

      {group.targetKobo && totals.percent !== null ? (
        <>
          <ProgressBar percent={totals.percent} label="Progress towards target" />
          <p className="mt-2 text-xs text-muted">{totals.percent}% of {formatNaira(group.targetKobo)} target</p>
        </>
      ) : (
        <p className="text-xs text-muted">No target set</p>
      )}

      <dl className="mt-4 flex justify-between border-t border-hero-line pt-3.5 text-xs text-muted">
        <div><dt>Available</dt><dd className="mt-0.5 font-mono text-sm text-ink">{formatNaira(totals.availableKobo)}</dd></div>
        <div className="text-right"><dt>Pending</dt><dd className="mt-0.5 font-mono text-sm text-ink">{formatNaira(totals.pendingKobo)}</dd></div>
      </dl>
    </section>
  )
}
