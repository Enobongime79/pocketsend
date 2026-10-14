import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** left = full-height menu sheet. dialog = bottom sheet on phones, centred dialog on desktop. */
  placement?: 'left' | 'dialog'
}

const FOCUSABLE = 'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])'

/** Traps focus, closes on Escape, locks background scroll, and returns focus to whatever opened it. */
export function Overlay({ open, onClose, title, children, placement = 'dialog' }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className={cn('fixed inset-0 z-30 flex', placement === 'left' ? 'justify-start' : 'items-end justify-center md:items-center')}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative bg-surface text-ink shadow-2xl outline-none',
          placement === 'left'
            ? 'flex h-full w-[320px] max-w-[88vw] flex-col border-r border-line'
            : 'w-full rounded-t-2xl border border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:max-w-md md:rounded-xl',
        )}
      >
        {placement === 'dialog' && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
