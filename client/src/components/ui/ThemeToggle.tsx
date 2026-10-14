import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useTheme, type ThemeMode } from '../../state/theme'

const options: { mode: ThemeMode; label: string; Icon: LucideIcon }[] = [
  { mode: 'system', label: 'Match device', Icon: Monitor },
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'dark', label: 'Dark', Icon: Moon },
]

export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5">
      {options.map(({ mode: m, label, Icon }) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          aria-label={label}
          title={label}
          onClick={() => setMode(m)}
          className={cn(
            'grid h-9 w-9 place-items-center rounded-md transition-colors',
            mode === m ? 'bg-raised text-primary' : 'text-muted hover:text-ink',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  )
}
