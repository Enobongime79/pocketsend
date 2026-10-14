import type { KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

interface Props<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}

/** A radio group that looks like two or three buttons. Arrow keys move the selection. */
export function Segmented<T extends string>({ label, options, value, onChange }: Props<T>) {
  const move = (e: KeyboardEvent, dir: 1 | -1) => {
    e.preventDefault()
    const i = options.findIndex((o) => o.value === value)
    onChange(options[(i + dir + options.length) % options.length].value)
  }
  return (
    <div className="mb-4">
      <span className="mb-1.5 block text-[13px] text-muted">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex gap-2"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(e, 1)
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(e, -1)
        }}
      >
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={cn(
                'h-12 flex-1 rounded-lg border text-sm transition-colors md:h-11',
                on ? 'border-primary bg-raised text-ink' : 'border-line-strong text-muted hover:text-ink',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
