import { Navigate } from 'react-router-dom'
import { useGroups } from '../state/groups'

/** /app goes to the first group, or to the new-group form if there are none. */
export default function AppIndex() {
  const { groups, loading, error } = useGroups()
  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-raised" aria-label="Loading" />
  if (error && groups.length === 0) return <p role="alert" className="text-sm text-danger">{error}</p>
  return <Navigate to={groups[0] ? `/app/groups/${groups[0].id}` : '/app/groups/new'} replace />
}
