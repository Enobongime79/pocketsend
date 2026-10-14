import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'border-primary bg-primary text-white hover:brightness-110',
  secondary: 'border-line-strong bg-surface text-ink hover:bg-raised',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-raised hover:text-ink',
  danger: 'border-danger bg-danger text-white hover:brightness-110 dark:text-bg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  block?: boolean
}

/** 48px tall on phones, 40px on desktop. While loading the label stays and the width does not change. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', loading, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors md:h-10',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

/** Same look as Button, for links that should look like buttons. */
export function buttonClass(variant: Variant = 'secondary', block = false) {
  return cn(
    'inline-flex h-12 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors md:h-10',
    variants[variant],
    block && 'w-full',
  )
}
