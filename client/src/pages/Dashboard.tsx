import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CollectedCard } from '../components/dashboard/CollectedCard'
import { CollectionAccount } from '../components/dashboard/CollectionAccount'
import { DevSimulator } from '../components/dashboard/DevSimulator'
import { EmptyState } from '../components/dashboard/EmptyState'
import { GroupHeader } from '../components/dashboard/GroupHeader'
import { PaymentsFeed } from '../components/dashboard/PaymentsFeed'
import { StatTiles } from '../components/dashboard/StatTiles'
import { WithdrawDialog } from '../components/dashboard/WithdrawDialog'
import { computeTotals } from '../lib/stats'
import { useGroups } from '../state/groups'
import NotFound from './NotFound'

export default function Dashboard() {
  const { id } = useParams()
  const { getById } = useGroups()
  const group = getById(id)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const closeWithdraw = useCallback(() => setWithdrawOpen(false), [])

  if (!group) return <NotFound inApp />
  const totals = computeTotals(group)
  const empty = group.payments.length === 0

  return (
    <>
      <GroupHeader group={group} totals={totals} onWithdraw={() => setWithdrawOpen(true)} />

      {group.status !== 'active' && (
        <p role="status" className="mt-4 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          {group.status === 'paused' ? 'This group is paused.' : 'This group is closed and read-only.'}
        </p>
      )}

      {/* One column on phones (DOM order is the phone order). From 900px: payments on the left, cards on the right. */}
      <div className="mt-5 grid gap-4 md:mt-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-x-6">
        {/* The account number comes first so its Copy button is on screen without scrolling */}
        <CollectionAccount group={group} className="md:col-start-2 md:row-start-1" />
        <CollectedCard group={group} totals={totals} className="md:col-start-2 md:row-start-2" />
        <StatTiles totals={totals} className="md:hidden" />
        {empty ? (
          <EmptyState group={group} className="md:col-start-1 md:row-start-1 md:row-span-3" />
        ) : (
          <PaymentsFeed group={group} className="md:col-start-1 md:row-start-1 md:row-span-3" />
        )}
        {import.meta.env.DEV && <DevSimulator group={group} className="md:col-start-2 md:row-start-3" />}
      </div>

      <WithdrawDialog open={withdrawOpen} onClose={closeWithdraw} groupId={group.id} availableKobo={group.availableKobo} withdrawableKobo={group.withdrawableKobo} />
    </>
  )
}
