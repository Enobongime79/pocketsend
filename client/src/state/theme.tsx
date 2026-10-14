import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
const KEY = 'pocketsend-theme'

interface ThemeCtx {
  mode: ThemeMode
  /** persist = false applies the mode for this page only, without overriding the person's saved choice */
  setMode: (mode: ThemeMode, persist?: boolean) => void
}
const Ctx = createContext<ThemeCtx | null>(null)

const stored = (): ThemeMode | null => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'system' || v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => stored() ?? 'system')

  const setMode = useCallback((m: ThemeMode, persist = true) => {
    setModeState(m)
    if (persist) {
      try { localStorage.setItem(KEY, m) } catch { /* storage can be blocked, that is fine */ }
    }
  }, [])

  useEffect(() => {
    apply(mode)
    if (mode !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

/** Organizer pages call useThemeDefault('dark'), payer pages call useThemeDefault('system'). */
export function useThemeDefault(fallback: ThemeMode) {
  const { setMode } = useTheme()
  useEffect(() => {
    if (!stored()) setMode(fallback, false)
  }, [fallback, setMode])
}
