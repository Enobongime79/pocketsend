import { formatNaira } from '../../lib/format'
import type { AmountType } from '../../types'

interface Props {
  name: string
  amountType: AmountType
  amountNaira: number
  closesLabel?: string
  className?: string
}

/** A live summary of the group as the organizer types. */
export function GroupPreview({ name, amountType, amountNaira, closesLabel, className }: Props) {
  return (
    <aside aria-label="Preview" className={`card p-4 md:p-6 ${className ?? ''}`}>
      <p className="text-xs text-subtle">Preview</p>
      <p className="mt-3 truncate text-lg font-medium" title={name}>{name || 'Your group name'}</p>
      <p className="my-2.5 font-mono text-2xl md:text-[32px] md:leading-10">
        {amountType === 'fixed' ? formatNaira(amountNaira * 100) : 'Any amount'}
      </p>
      <p className="text-xs text-subtle">
        {amountType === 'fixed' ? 'expected from each person' : 'people choose how much'}
        {closesLabel ? ` · closes ${closesLabel}` : ''}
      </p>
      <div className="mt-5 border-t border-line pt-4 text-[13px] leading-relaxed text-muted">
        <p className="mb-1.5 font-medium text-ink">Your collection account</p>
        A dedicated account number is created when you save. Anyone who transfers to it is recorded on your dashboard
        automatically{amountType === 'fixed' ? ', marked as a full or partial payment' : ''}.
      </div>
    </aside>
  )
}
