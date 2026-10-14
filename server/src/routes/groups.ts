import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { HttpError, h } from '../errors.js'
import { getBalances, mapGroup } from '../ledger.js'
import { syncGroupPayments } from '../payments.js'
import type { Deps } from '../types.js'
import { requireUser, userOf } from './auth.js'

// Placeholder limits: ₦100 to ₦10,000,000 per person. Kora's sandbox credit uses the same range.
const MIN_KOBO = 100 * 100
const MAX_KOBO = 10_000_000 * 100

const createSchema = z
  .object({
    name: z.string().trim().min(3, 'Use at least 3 characters.').max(60),
    description: z.string().trim().max(300).default(''),
    amountType: z.enum(['fixed', 'open']),
    amountKobo: z.number().int().min(0).max(MAX_KOBO).default(0),
    targetKobo: z.number().int().positive().max(MAX_KOBO * 100).optional(),
    closesAt: z.string().datetime().optional(),
    fullName: z.string().trim().min(2, 'Enter your full name.').max(60),
    bvn: z.string().regex(/^\d{11}$/, 'A BVN is 11 digits.'),
  })
  .superRefine((v, ctx) => {
    if (v.amountType === 'fixed' && (v.amountKobo < MIN_KOBO || v.amountKobo > MAX_KOBO))
      ctx.addIssue({ code: 'custom', path: ['amountKobo'], message: 'Choose an amount between ₦100 and ₦10,000,000.' })
    if (v.amountType === 'fixed' && v.targetKobo && v.targetKobo < v.amountKobo)
      ctx.addIssue({ code: 'custom', path: ['targetKobo'], message: 'The target must be at least the amount per person.' })
    if (v.closesAt && new Date(v.closesAt).getTime() < Date.now())
      ctx.addIssue({ code: 'custom', path: ['closesAt'], message: 'Pick a date in the future.' })
  })

export function groupRoutes(d: Deps): Router {
  const r = Router()
  r.use(requireUser(d))

  r.get('/groups', h(async (_req, res) => {
    const user = userOf(res)
    const groups = await d.db.query('select * from groups where user_id = $1 order by created_at desc', [user.id])
    const payments = groups.length
      ? await d.db.query(
          `select * from payments where group_id in (${groups.map((_, i) => `$${i + 1}`).join(',')}) order by paid_at desc limit 2000`,
          groups.map((g) => g.id),
        )
      : []
    const out = []
    for (const g of groups) {
      out.push(mapGroup(g, payments.filter((p) => p.group_id === g.id), await getBalances(d.db, d.cfg, g.id)))
    }
    res.json({ groups: out })
  }))

  r.post('/groups', h(async (req, res) => {
    const user = userOf(res)
    const body = createSchema.parse(req.body)

    // Kora allows only a limited number of virtual accounts by default, and each group uses one
    const used = (await d.db.query('select count(*)::int as n from groups'))[0].n
    if (used >= d.cfg.koraVbaLimit) {
      throw new HttpError(409, 'capacity', 'PocketSend has reached its limit of payment accounts for now. Please try again later.')
    }

    const id = randomUUID()
    const accountReference = `pocketsend-${id}`
    // The BVN goes to Kora and nowhere else. It is not saved and must never be logged.
    const account = await d.kora.createVirtualAccount({
      accountName: `PocketSend - ${body.name}`.slice(0, 40),
      accountReference,
      customerName: body.fullName,
      customerEmail: user.email,
      bvn: body.bvn,
    })

    await d.db.tx(async (q) => {
      await q.query(
        `insert into groups (id, user_id, name, description, amount_type, amount_kobo, target_kobo, closes_at,
                             kora_account_reference, account_number, account_name, bank_name, bank_code)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, user.id, body.name, body.description, body.amountType, body.amountType === 'fixed' ? body.amountKobo : 0,
          body.targetKobo ?? null, body.closesAt ?? null, accountReference, account.accountNumber, account.accountName, account.bankName, account.bankCode],
      )
      await q.query('update users set full_name = coalesce(full_name, $2) where id = $1', [user.id, body.fullName])
    })

    const row = (await d.db.query('select * from groups where id = $1', [id]))[0]
    res.status(201).json({ group: mapGroup(row, [], await getBalances(d.db, d.cfg, id)) })
  }))

  /** Pulls this group's payments from Kora. Safe to call any time: payments are recorded once. */
  r.post('/groups/:id/sync', h(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const group = (await d.db.query('select id, account_number from groups where id = $1 and user_id = $2', [id, userOf(res).id]))[0]
    if (!group) throw new HttpError(404, 'not_found', 'Group not found.')
    res.json({ added: await syncGroupPayments(d, group) })
  }))

  return r
}
