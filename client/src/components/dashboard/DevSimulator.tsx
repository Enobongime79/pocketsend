import { useState } from 'react'
import { ApiError, api } from '../../data/api'
import { useGroups } from '../../state/groups'
import type { Group } from '../../types'
import { Button } from '../ui/Button'
import { AmountField } from '../ui/Fields'

/**
 * Shown only by `npm run dev`. Asks Kora's SANDBOX to send a test transfer to this group's account number, exactly as a
 * customer's bank transfer would arrive. Needs DEV_TOOLS=true on the server.
 */
export function DevSimulator({ group, className }: { group: Group; className?: string }) {
  const { refresh } = useGroups()
  const [amount, setAmount] = useState(group.amountType === 'fixed' ? group.amountKobo / 100 : 5000)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()

  const send = async () => {
    setBusy(true)
    setMessage(undefined)
    try {
      await api.devCredit(group.id, amount)
      await refresh()
      setMessage('Test transfer received.')
    } catch (e) {
      setMessage(e instanceof ApiError && e.status === 404 ? 'The server has dev tools off. Set DEV_TOOLS=true in server/.env.' : e instanceof Error ? e.message : 'Failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`card border-dashed p-4 ${className ?? ''}`}>
      <h2 className="font-medium">Dev only: send a sandbox transfer</h2>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">
        Uses Kora's sandbox to pay into this account number. Send half the amount twice to see Partial become Full.
      </p>
      <AmountField label="Amount (₦, from 100)" value={amount} onValue={setAmount} showWords={false} />
      <Button block disabled={amount < 100} loading={busy} onClick={send}>Send test transfer</Button>
      {message && <p role="status" className="mt-2 text-xs text-muted">{message}</p>}
    </section>
  )
}
