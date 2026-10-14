import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../data/api'
import type { User } from '../types'

interface AuthCtx {
  user: User | null
  /** True until the first answer from the server about who is signed in. */
  loading: boolean
  signIn: (user: User) => void
  signOut: () => Promise<void>
  /** Forget the user locally, for example when the server says the session has expired. */
  clearSession: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

/** The server owns the session (an httpOnly cookie). This just asks it who is signed in. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined)
    setUser(null)
  }, [])
  const clearSession = useCallback(() => setUser(null), [])

  const value = useMemo(() => ({ user, loading, signIn: setUser, signOut, clearSession }), [user, loading, signOut, clearSession])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
