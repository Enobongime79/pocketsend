import { formatNaira } from '../../lib/format'
import type { Group } from '../../types'
import { CopyButton } from '../ui/CopyButton'

/**
 * The heart of the product: people transfer to this account, and every transfer shows up on the dashboard.
 * Kept short on purpose so the Copy button is visible without scrolling: it sits right beside the number.
 */
export function CollectionAccount({ group, className }: { group: Group; className?: string }) {
  const a = group.virtualAccount
  const details = [
    `Contribution: ${group.name}`,
    group.amountType === 'fixed' ? `Amount: ${formatNaira(group.amountKobo)}` : null,
    `Account number: ${a.accountNumber}`,
    `Bank: ${a.bankName}`,
    `Account name: ${a.accountName}`,
  ].filter(Boolean).join('\n')

  return (
    <section aria-labelledby="acct-h" className={`card p-4 ${className ?? ''}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="acct-h" className="font-medium">Collection account</h2>
        <span className="truncate text-xs text-muted">{a.bankName}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="font-mono text-[22px] leading-none tracking-[0.04em]" aria-label={`Account number ${a.accountNumber.split('').join(' ')}`}>
          {a.accountNumber}
        </p>
        <CopyButton text={a.accountNumber} label="Copy" aria-label="Copy account number" variant="primary" className="shrink-0" />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted" title={a.accountName}>{a.accountName}</p>
        <CopyButton text={details} label="Copy details" aria-label="Copy all details to share" variant="ghost" className="shrink-0 px-2" />
      </div>
    </section>
  )
}
