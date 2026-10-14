import { Plus } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Logo({ className, mark = true }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-[17px] font-semibold', className)}>
      {mark && (
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
        </span>
      )}
      PocketSend
    </span>
  )
}
