import { Router } from 'express'
import { z } from 'zod'
import { HttpError, h } from '../errors.js'
import { syncGroupPayments } from '../payments.js'
import type { Deps } from '../types.js'
import { requireUser, userOf } from './auth.js'

/** Only mounted when DEV_TOOLS=true (never in production). Uses Kora's SANDBOX credit endpoint to fake a customer transfer. */
export function devRoutes(d: Deps): Router {
  const r = Router()
  r.use(requireUser(d))

  r.post('/dev/credit', h(async (req, res) => {
    const body = z.object({ groupId: z.string().uuid(), amountNaira: z.number().int().min(100).max(10_000_000) }).parse(req.body)
    const group = (await d.db.query('select id, account_number from groups where id = $1 and user_id = $2', [body.groupId, userOf(res).id]))[0]
    if (!group) throw new HttpError(404, 'not_found', 'Group not found.')
    await d.kora.creditSandboxAccount(group.account_number, body.amountNaira)
    // The webhook will also arrive if Kora can reach your server. Syncing now means this works on localhost too.
    const added = await syncGroupPayments(d, group)
    res.json({ added })
  }))

  return r
}
