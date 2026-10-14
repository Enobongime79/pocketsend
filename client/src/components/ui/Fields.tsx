import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { formatDigits, parseDigits } from '../../lib/format'
import { amountInWords } from '../../lib/words'

interface ShellProps {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}

/** Label on top, hint or error underneath. Every field in the app uses this. */
function FieldShell({ id, label, hint, error, children, className }: ShellProps) {
  return (
    <div className={cn('mb-4', className)}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] text-muted">{label}</label>
      {children}
      {(error || hint) && (
        <p id={`${id}-desc`} className={cn('mt-1.5 text-xs', error ? 'text-danger' : 'text-subtle')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

type CommonProps = { label: string; hint?: ReactNode; error?: string; mono?: boolean }

export function TextField({ label, hint, error, mono, className, id, ...rest }: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={className}>
      <input
        id={fid}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${fid}-desc` : undefined}
        className={cn('field-input', mono && 'font-mono')}
        {...rest}
      />
    </FieldShell>
  )
}

export function TextAreaField({ label, hint, error, className, id, ...rest }: Omit<CommonProps, 'mono'> & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={fid}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${fid}-desc` : undefined}
        className="field-input h-auto py-3"
        {...rest}
      />
    </FieldShell>
  )
}

interface AmountProps {
  label: string
  /** whole naira */
  value: number
  onValue: (naira: number) => void
  error?: string
  hint?: ReactNode
  id?: string
  placeholder?: string
  showWords?: boolean
}

/** Whole-naira input: ₦ prefix, thousands separators as you type, paste-safe, words underneath. */
export function AmountField({ label, value, onValue, error, hint, id, placeholder, showWords = true }: AmountProps) {
  const auto = useId()
  const fid = id ?? auto
  const words = showWords ? amountInWords(value) : ''
  return (
    <FieldShell id={fid} label={label} error={error} hint={hint ?? (words || undefined)}>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-muted">₦</span>
        <input
          id={fid}
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={formatDigits(value)}
          onChange={(e) => onValue(parseDigits(e.target.value))}
          aria-invalid={!!error}
          aria-describedby={error || hint || words ? `${fid}-desc` : undefined}
          className="field-input pl-8 font-mono"
        />
      </div>
    </FieldShell>
  )
}

interface SelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  error?: string
  id?: string
}

/** Native select, so it works well with phone keyboards and screen readers. */
export function SelectField({ label, value, onChange, options, placeholder, error, id }: SelectProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} error={error}>
      <select
        id={fid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${fid}-desc` : undefined}
        className={cn('field-input', !value && 'text-subtle')}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldShell>
  )
}
