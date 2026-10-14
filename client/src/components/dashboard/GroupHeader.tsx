import { Link } from 'react-router-dom'
import { Plus, Wallet } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatDate, formatNaira } from '../../lib/format'
import type { computeTotals } from '../../lib/stats'
import type { Group } from '../../types'
import { Button, buttonClass } from '../ui/Button'

interface Props {
  group: Group
  totals: ReturnType<typeof computeTotals>
  onWithdraw: () => void
}

export function GroupHeader({ group, totals, onWithdraw }: Props) {
  const amountLabel = group.amountType === 'fixed' ? `${formatNaira(group.amountKobo)} per person` : 'Any amount'
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line pb-5">
      <div className="min-w-0">
        <h1 className="mb-1 truncate text-2xl font-semibold md:text-[30px] md:leading-9" title={group.name}>{group.name}</h1>
        <p className="text-[13px] text-muted md:text-sm">
          {amountLabel}
          {group.closesAt ? ` · closes ${formatDate(group.closesAt)}` : ' · no closing date'}
        </p>
        {group.description && <p className="mt-1 line-clamp-2 max-w-prose text-[13px] text-subtle">{group.description}</p>}
        {/* On phones these numbers live in the stat tiles under the collected card */}
        <dl className="mt-4 hidden flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-muted md:flex">
          <div className="flex items-baseline gap-1.5"><dd className="font-mono text-[15px] text-ink">{formatNaira(totals.collectedKobo)}</dd><dt>collected</dt></div>
          <div className="flex items-baseline gap-1.5"><dd className="font-mono text-[15px] text-ink">{totals.paymentCount}</dd><dt>payments</dt></div>
          <div className="flex items-baseline gap-1.5"><dd className="font-mono text-[15px] text-ink">{totals.payerCount}</dd><dt>people paid</dt></div>
        </dl>
      </div>

      <div className="flex w-full gap-2.5 md:w-auto">
        <Link to="/app/groups/new" className={cn(buttonClass('primary'), 'flex-[1.5] whitespace-nowrap px-3 md:flex-none md:px-4')}>
          <Plus className="h-4 w-4" aria-hidden /> New payment group
        </Link>
        <Button className="flex-1 whitespace-nowrap px-3 md:flex-none md:px-4" onClick={onWithdraw}>
          <Wallet className="h-4 w-4" aria-hidden /> Withdraw
        </Button>
      </div>
    </div>
  )
}
