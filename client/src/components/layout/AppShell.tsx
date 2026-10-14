import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '../../state/auth'
import { useThemeDefault } from '../../state/theme'
import { Logo } from '../ui/Logo'
import { Overlay } from '../ui/Overlay'
import { SidebarContent } from './SidebarContent'

/** Organizer layout: fixed sidebar from 900px up, a menu sheet below that. Requires a signed-in user. */
export function AppShell() {
  useThemeDefault('dark')
  const { user, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const { pathname } = useLocation()
  useEffect(() => setMenuOpen(false), [pathname])

  // Wait for the server to say who is signed in, then send signed-out visitors to the sign in page
  if (loading) return <div className="grid min-h-screen place-items-center bg-bg text-sm text-muted">Loading…</div>
  if (!user) return <Navigate to="/signin" replace />

  return (
    <div className="min-h-screen bg-bg text-ink md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface md:block">
        <SidebarContent />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <Logo mark={false} className="text-base" />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="grid h-11 w-11 place-items-center rounded-[10px] border border-line-strong bg-surface"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1280px] px-4 py-5 md:px-6 md:py-7">
          <Outlet />
        </main>
      </div>

      <Overlay open={menuOpen} onClose={closeMenu} title="Menu" placement="left">
        <SidebarContent />
      </Overlay>
    </div>
  )
}
