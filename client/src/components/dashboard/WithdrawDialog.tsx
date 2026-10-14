import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { ApiError, api } from '../../data/api'
import { formatNaira } from '../../lib/format'
import { useAuth } from '../../state/auth'
import { useGroups } from '../../state/groups'
import type { Bank, Withdrawal } from '../../types'
import { Button } from '../ui/Button'
import { SelectField, TextField } from '../ui/Fields'
import { Overlay } from '../ui/Overlay'

interface Props {
  open: boolean
  onClose: () => void
  groupId: string
  /** What the group has left after fees and earlier withdrawals. */
  availableKobo: number
  /** What can actually be paid out now (available, minus a small reserve for the transfer fee). */
  withdrawableKobo: number
}

type Lookup = { status: 'idle' } | { status: 'looking' } | { status: 'found'; name: string } | { status: 'error'; message: string }

/**
 * Pick a bank, type the account number, check the name Kora returns, confirm with a code emailed to you, then withdraw.
 * The name lookup and the payout both happen on the server, which re-checks everything. This dialog is only the front.
 */
export function WithdrawDialog({ open, onClose, groupId, availableKobo, withdrawableKobo }: Props) {
  const { user } = useAuth()
  const { refresh } = useGroups()
  const [banks, setBanks] = useState<Bank[]>([])
  const [banksError, setBanksError] = useState<string>()
  const [bankCode, setBankCode] = useState('')
  const [number, setNumber] = useState('')
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' })
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [done, setDone] = useState<Withdrawal | null>(null)
  // One key per attempt: a double tap or a retry cannot pay twice
  const key = useRef(crypto.randomUUID())

  // Load the bank list when the dialog opens
  useEffect(() => {
    if (!open || banks.length) return
    api.listBanks().then(setBanks).catch((e) => setBanksError(e instanceof Error ? e.message : 'Could not load banks.'))
  }, [open, banks.length])

  // Forget everything when the dialog closes
  useEffect(() => {
    if (open) return
    setBankCode(''); setNumber(''); setLookup({ status: 'idle' }); setCodeSent(false); setCode('')
    setSending(false); setSubmitting(false); setError(undefined); setDone(null); key.current = crypto.randomUUID()
  }, [open])

  // Check the account name as soon as the bank is chosen and 10 digits are typed
  useEffect(() => {
    setCodeSent(false); setCode(''); setError(undefined)
    if (!bankCode || number.length !== 10) { setLookup({ status: 'idle' }); return }
    let cancelled = false
    setLookup({ status: 'looking' })
    api.resolveAccount(bankCode, number)
      .then((name) => { if (!cancelled) setLookup({ status: 'found', name }) })
      .catch((e) => { if (!cancelled) setLookup({ status: 'error', message: e instanceof ApiError && e.status !== 0 && e.status < 500 ? 'We could not find that account. Check the bank and the number.' : 'We could not check the account right now. Try again.' }) })
    return () => { cancelled = true }
  }, [bankCode, number])

  const sendCode = async () => {
    setSending(true); setError(undefined)
    try { await api.requestWithdrawalCode(); setCodeSent(true) }
    catch (e) { setError(e instanceof Error ? e.message : 'We could not send the code.') }
    finally { setSending(false) }
  }

  const submit = async () => {
    if (lookup.status !== 'found') return
    setSubmitting(true); setError(undefined)
    try {
      const w = await api.withdraw(groupId, { bankCode, accountNumber: number, code, idempotencyKey: key.current })
      if (w.status === 'failed') { key.current = crypto.randomUUID(); setError(w.failureReason ?? 'The withdrawal failed. Nothing was taken from your balance.') }
      else setDone(w)
      await refresh()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'payout_rejected') key.current = crypto.randomUUID() // that attempt is over, the next one needs a new key
      setError(e instanceof Error ? e.message : 'We could not start the withdrawal.')
    } finally {
      setSubmitting(false)
    }
  }

  const reserve = availableKobo - withdrawableKobo
  const canWithdraw = lookup.status === 'found' && codeSent && /^\d{6}$/.test(code)

  return (
    <Overlay open={open} onClose={onClose} title={done ? 'Withdrawal started' : 'Withdraw'}>
      {done ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
          <p className="mt-3 font-mono text-2xl text-success">{formatNaira(done.amountKobo)}</p>
          <p className="mt-1 text-sm text-muted">on its way to {done.accountName}</p>
          <p className="text-xs text-subtle">{done.bankName} ···· {done.accountLast4}</p>
          <p className="mt-4 text-sm text-muted">
            {done.status === 'success' ? 'It has been sent.' : 'Your bank can take a few minutes. Your balance is already updated.'}
          </p>
          <Button variant="primary" block className="mt-5" onClick={onClose}>Done</Button>
        </div>
      ) : withdrawableKobo <= 0 ? (
        <>
          <p className="text-sm text-muted">Nothing is available to withdraw yet. Money shows up here once payments are confirmed.</p>
          <Button block className="mt-5" onClick={onClose}>Close</Button>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">Where should we send your money? Choose the bank and enter the account number.</p>
          <SelectField label="Bank" value={bankCode} onChange={setBankCode} placeholder={banks.length ? 'Choose your bank' : banksError ?? 'Loading banks…'}
            options={banks.map((b) => ({ value: b.code, label: b.name }))} />
          <TextField
            label="Account number"
            mono
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
            hint={number.length > 0 && number.length < 10 ? `${10 - number.length} more digits` : '10 digits'}
            error={lookup.status === 'error' ? lookup.message : undefined}
          />

          <div className="mb-4 min-h-[44px]" role="status" aria-live="polite">
            {lookup.status === 'looking' && (
              <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking the account name…</p>
            )}
            {lookup.status === 'found' && (
              <p className="rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
                <span className="block text-xs opacity-80">Account name</span>
                <span className="font-medium">{lookup.name}</span>
              </p>
            )}
          </div>

          {lookup.status === 'found' && (codeSent ? (
            <TextField label={`Code we emailed to ${user?.email ?? 'you'}`} mono inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} hint="This confirms it is really you." />
          ) : (
            <Button block className="mb-4" loading={sending} onClick={sendCode}>Send a code to confirm</Button>
          ))}

          <dl className="space-y-2.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">You receive</dt><dd className="font-mono">{formatNaira(withdrawableKobo)}</dd></div>
            {reserve > 0 && (
              <div className="flex justify-between"><dt className="text-muted">Held back for the transfer fee</dt><dd className="font-mono">{formatNaira(reserve)}</dd></div>
            )}
          </dl>
          {reserve > 0 && <p className="mt-1 text-xs text-subtle">Whatever part of that is not used for the fee stays in your balance.</p>}

          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-5 flex gap-2.5">
            <Button block onClick={onClose}>Cancel</Button>
            <Button block variant="primary" disabled={!canWithdraw} loading={submitting} onClick={submit}>
              Withdraw {formatNaira(withdrawableKobo)}
            </Button>
          </div>
          <p className="mt-3 text-xs text-subtle">Check the account name before you confirm. A withdrawal cannot be undone.</p>
        </>
      )}
    </Overlay>
  )
}
