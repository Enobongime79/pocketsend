import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { GroupPreview } from '../components/group/GroupPreview'
import { Button } from '../components/ui/Button'
import { AmountField, TextAreaField, TextField } from '../components/ui/Fields'
import { Segmented } from '../components/ui/Segmented'
import { ApiError } from '../data/api'
import { formatDate, formatNaira, nairaToKobo } from '../lib/format'
import { MAX_NAIRA, MIN_NAIRA } from '../lib/limits'
import { useAuth } from '../state/auth'
import { useGroups } from '../state/groups'
import type { AmountType } from '../types'

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

export default function NewGroup() {
  const { createGroup } = useGroups()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amountType, setAmountType] = useState<AmountType>('fixed')
  const [amount, setAmount] = useState(0)
  const [target, setTarget] = useState(0)
  const [closes, setCloses] = useState('')
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [bvn, setBvn] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    const n = name.trim()
    if (n.length < 3 || n.length > 60) next.name = 'Use 3 to 60 characters for the group name.'
    if (amountType === 'fixed') {
      if (amount < MIN_NAIRA || amount > MAX_NAIRA)
        next.amount = `Enter an amount between ${formatNaira(MIN_NAIRA * 100)} and ${formatNaira(MAX_NAIRA * 100)}.`
      else if (target && target < amount) next.target = 'The target must be at least the amount per person.'
    }
    if (closes && closes < tomorrow()) next.closes = 'Pick tomorrow or a later date.'
    if (fullName.trim().length < 2) next.fullName = 'Enter your full name, as it appears on your BVN.'
    if (!/^\d{11}$/.test(bvn)) next.bvn = 'A BVN is 11 digits.'
    setErrors(next)
    setFormError(undefined)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      const g = await createGroup({
        name: n,
        description: description.trim(),
        amountType,
        amountKobo: amountType === 'fixed' ? nairaToKobo(amount) : 0,
        targetKobo: target ? nairaToKobo(target) : undefined,
        closesAt: closes ? new Date(`${closes}T23:59:00+01:00`).toISOString() : undefined,
        fullName: fullName.trim(),
        bvn,
      })
      navigate(`/app/groups/${g.id}`)
    } catch (err) {
      // Show the server's field-level messages next to the right inputs
      if (err instanceof ApiError && err.fields) {
        setErrors({
          name: err.fields.name ?? '', amount: err.fields.amountKobo ?? '', target: err.fields.targetKobo ?? '',
          closes: err.fields.closesAt ?? '', fullName: err.fields.fullName ?? '', bvn: err.fields.bvn ?? '',
        })
      }
      setFormError(err instanceof Error ? err.message : 'We could not create the group. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1040px]">
      <Link to="/app" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to groups
      </Link>
      <h1 className="mb-6 mt-1 text-[26px] font-semibold md:text-[30px]">New payment group</h1>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={submit} noValidate className="card p-4 md:p-6">
          <TextField label="Group name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} error={errors.name} placeholder="Ade & Tolu Wedding" />
          <TextAreaField label="Notes (optional, only you see this)" rows={3} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)}
            hint={`${description.length}/300`} />
          <Segmented label="How much does each person pay?" value={amountType} onChange={setAmountType}
            options={[{ value: 'fixed', label: 'Fixed per person' }, { value: 'open', label: 'Any amount' }]} />

          <div className="grid gap-x-4 sm:grid-cols-2">
            {amountType === 'fixed' && <AmountField label="Amount per person (₦)" value={amount} onValue={setAmount} error={errors.amount} />}
            <AmountField label="Group target (₦, optional)" value={target} onValue={setTarget} error={errors.target} showWords={false} />
          </div>
          <TextField label="Closing date (optional)" type="date" min={tomorrow()} value={closes} onChange={(e) => setCloses(e.target.value)} error={errors.closes} />

          <fieldset className="mt-2 rounded-lg border border-line p-4">
            <legend className="px-1 text-[13px] text-muted">Needed to open your account number</legend>
            <TextField label="Your full name (as on your BVN)" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
            <TextField label="Your BVN" mono inputMode="numeric" autoComplete="off" maxLength={11} value={bvn}
              onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))} error={errors.bvn}
              hint="11 digits. Sent to our payment provider (Kora) to open the account. We do not store it." />
            <p className="flex items-start gap-2 text-xs text-subtle">
              <ShieldCheck className="mt-px h-4 w-4 shrink-0" aria-hidden />
              Nobody who pays you sees your BVN.
            </p>
          </fieldset>

          {formError && <p role="alert" className="mt-4 text-sm text-danger">{formError}</p>}
          <Button type="submit" variant="primary" block loading={saving} className="mt-4 md:w-auto">Create group</Button>
          {saving && <p className="mt-2 text-xs text-subtle">Opening your account number…</p>}
        </form>

        <GroupPreview
          className="self-start"
          name={name.trim()}
          amountType={amountType}
          amountNaira={amount}
          closesLabel={closes ? formatDate(new Date(`${closes}T12:00:00+01:00`).toISOString()) : undefined}
        />
      </div>
    </div>
  )
}
