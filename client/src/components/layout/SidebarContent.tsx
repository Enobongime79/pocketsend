import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { cn } from '../../lib/cn'
import { compactNaira } from '../../lib/format'
import { computeTotals } from '../../lib/stats'
import { useAuth } from '../../state/auth'
import { useGroups } from '../../state/groups'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'
import { ThemeToggle } from '../ui/ThemeToggle'

/** Used twice: as the fixed desktop sidebar and inside the phone menu sheet. New groups are created from the dashboard header. */
export function SidebarContent() {
  const { groups, loading } = useGroups()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/signin', { replace: true })
  }

  return (
    <nav aria-label="Payment groups" className="flex h-full flex-col p-2">
      <div className="px-2 pb-6 pt-1"><Logo /></div>
      <p className="px-3 pb-2 text-[13px] text-subtle">Payment groups</p>
      <ul className="space-y-0.5">
        {loading && <li className="px-3 py-2.5 text-sm text-subtle">Loading…</li>}
        {groups.map((g) => (
          <li key={g.id}>
            <NavLink
              to={`/app/groups/${g.id}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/60 hover:text-ink',
                )
              }
            >
              <span className="truncate" title={g.name}>{g.name}</span>
              <span className="shrink-0 font-mono text-xs text-success">{compactNaira(computeTotals(g).collectedKobo)}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-3 pt-6">
        <div className="flex items-center justify-between px-3">
          <span className="text-[13px] text-subtle">Theme</span>
          <ThemeToggle />
        </div>
        <div className="border-t border-line px-1 pt-3">
          {user && <p className="truncate px-2 pb-1 text-xs text-subtle" title={user.email}>Signed in as {user.email}</p>}
          <Button variant="ghost" block className="!justify-start px-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </Button>
        </div>
      </div>
    </nav>
  )
}
