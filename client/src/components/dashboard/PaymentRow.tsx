import { useState } from 'react'
import { ChevronDown, CheckCheck, CircleDashed } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatDateTime, formatNaira, formatWhen } from '../../lib/format'
import type { Coverage } from '../../lib/stats'
import type { Payment } from '../../types'
import { Avatar } from '../ui/Avatar'
import { StatusTag } from '../ui/StatusTag'

/** Full or Partial, and what is still owed if Partial. Fixed-amount groups only. */
function CoverageNote({ coverage }: { coverage: Coverage }) {
  return coverage.complete ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 font-mono text-[11px] text-success">
      <CheckCheck className="h-3 w-3" aria-hidden /> Full
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 font-mono text-[11px] text-warning">
      <CircleDashed className="h-3 w-3" aria-hidden /> Partial · {formatNaira(coverage.remainingKobo)} remaining
    </span>
  )
}

/** Tap to expand: reference, which account it came from, and the full timestamp (Africa/Lagos). */
export function PaymentRow({ payment, coverage, isNew }: { payment: Payment; coverage?: Coverage; isNew?: boolean }) {
  const [open, setOpen] = useState(false)
  const detailId = `detail-${payment.id}`
  return (
    <li className={cn('border-b border-line last:border-b-0', isNew && 'row-in bg-success-soft/40')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-raised/40 md:px-4 md:py-3.5"
      >
        <Avatar name={payment.payerName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px]" title={payment.payerName}>{payment.payerName}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <StatusTag status={payment.status} />
            {coverage && <CoverageNote coverage={coverage} />}
            <span>{formatWhen(payment.createdAt)}</span>
          </span>
        </span>
        <span className="text-right">
          <span className="block font-mono text-base">{formatNaira(payment.amountKobo)}</span>
          {coverage && !coverage.complete && <span className="block text-[11px] text-subtle">paid {formatNaira(coverage.paidToDateKobo)} so far</span>}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <dl id={detailId} className="grid grid-cols-2 gap-x-4 gap-y-2 bg-raised/30 px-4 py-3 text-xs text-muted md:grid-cols-4">
          <div><dt>Reference</dt><dd className="mt-0.5 font-mono text-ink">{payment.reference}</dd></div>
          <div><dt>Sent from</dt><dd className="mt-0.5 text-ink">{payment.senderBank} ···· {payment.senderAccountLast4}</dd></div>
          <div className="col-span-2"><dt>Time</dt><dd className="mt-0.5 text-ink">{formatDateTime(payment.createdAt)} (WAT)</dd></div>
        </dl>
      )}
    </li>
  )
}
