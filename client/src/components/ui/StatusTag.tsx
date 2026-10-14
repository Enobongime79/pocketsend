import { CheckCircle2, Clock, XCircle, Ban, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { PaymentStatus } from '../../types'

const config: Record<PaymentStatus, { label: string; Icon: LucideIcon; className: string }> = {
  confirmed: { label: 'Confirmed', Icon: CheckCircle2, className: 'bg-success-soft text-success' },
  pending: { label: 'Pending', Icon: Clock, className: 'bg-warning-soft text-warning' },
  failed: { label: 'Failed', Icon: XCircle, className: 'bg-danger-soft text-danger' },
  expired: { label: 'Expired', Icon: Ban, className: 'bg-raised text-muted' },
}

/** Status is always icon + text, never colour alone. */
export function StatusTag({ status, className }: { status: PaymentStatus; className?: string }) {
  const { label, Icon, className: tone } = config[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px]', tone, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}
