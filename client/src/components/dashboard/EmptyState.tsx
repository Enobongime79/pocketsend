import type { Group } from '../../types'

/** A brand-new group: the next step is always obvious. */
export function EmptyState({ group, className }: { group: Group; className?: string }) {
  const steps = [
    { title: 'Share the account number', body: <p className="mt-2 font-mono text-sm tracking-[0.04em] text-ink">{group.virtualAccount.accountNumber} · {group.virtualAccount.bankName}</p> },
    { title: 'People pay from any bank app', body: <p className="text-[13px] text-muted">No link and no sign up. They just make a normal transfer.</p> },
    { title: 'Watch the dashboard fill up', body: <p className="text-[13px] text-muted">Each transfer appears here, marked Full or Partial, with no screenshots.</p> },
  ]
  return (
    <section className={`card p-5 md:p-6 ${className ?? ''}`}>
      <h2 className="text-lg font-medium md:text-xl">No payments yet</h2>
      <p className="mt-1 text-[13px] text-muted md:text-sm">Payments appear here the moment they are confirmed.</p>
      <ol className="mt-5 space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3.5">
            <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-raised font-semibold text-primary">{i + 1}</span>
            <div className="min-w-0"><p className="font-medium">{s.title}</p>{s.body}</div>
          </li>
        ))}
      </ol>
    </section>
  )
}
