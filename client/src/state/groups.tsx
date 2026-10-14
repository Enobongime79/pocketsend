import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api } from '../data/api'
import type { Group, NewGroupInput } from '../types'
import { useAuth } from './auth'

interface GroupsCtx {
  groups: Group[]
  loading: boolean
  /** Set when the last refresh failed (the groups already on screen are kept). */
  error?: string
  getById: (id?: string) => Group | undefined
  createGroup: (input: NewGroupInput) => Promise<Group>
  refresh: () => Promise<void>
}
const Ctx = createContext<GroupsCtx | null>(null)

const POLL_MS = 8000

/**
 * Loads the signed-in organizer's groups from the server and keeps them fresh. Payments arrive at the server
 * through Kora's webhook, so the dashboard polls (while the tab is visible) to show them within a few seconds.
 */
export function GroupsProvider({ children }: { children: ReactNode }) {
  const { user, clearSession } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    try {
      setGroups(await api.listGroups())
      setError(undefined)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return clearSession() // session expired: back to sign in
      setError(e instanceof Error ? e.message : 'Could not load your groups.')
    } finally {
      setLoading(false)
    }
  }, [clearSession])

  useEffect(() => {
    if (!user) {
      setGroups([])
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh()
    const tick = () => { if (!document.hidden) void refresh() }
    const timer = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [user, refresh])

  const createGroup = useCallback(async (input: NewGroupInput) => {
    const g = await api.createGroup(input)
    setGroups((prev) => [g, ...prev])
    return g
  }, [])

  const value = useMemo<GroupsCtx>(
    () => ({ groups, loading, error, getById: (id) => groups.find((g) => g.id === id), createGroup, refresh }),
    [groups, loading, error, createGroup, refresh],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGroups() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGroups must be used inside GroupsProvider')
  return ctx
}
