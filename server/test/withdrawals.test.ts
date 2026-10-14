import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { KoraError } from '../src/kora.js'
import { reconcileWithdrawals } from '../src/routes/withdrawals.js'
import { createGroup, createTestApp, providerDown, signedCharge, signedInAgent, signedTransfer, type TestApp } from './helpers.js'

type Agent = ReturnType<typeof request.agent>
let t: TestApp
let agent: Agent
let groupId: string

const post = (t: TestApp, w: { body: unknown; signature: string }) =>
  request(t.app).post('/api/webhooks/kora').set('x-korapay-signature', w.signature).send(w.body as object)

/** A signed-in organizer with one group that has collected ₦50,000 (Kora's fee ₦15, payout fee reserve ₦100). */
async function setup(opts: Parameters<typeof createTestApp>[0] = {}) {
  t = await createTestApp(opts)
  agent = await signedInAgent(t)
  const g = await createGroup(agent)
  groupId = g.id
  await post(t, signedCharge(t, g.virtualAccount.accountNumber, { amount: 50_000, fee: 15 })).expect(200)
}

const withdraw = async (key = 'key-aaaaaaaa', code?: string) => {
  const c = code ?? t.lastCode('isaac@example.com')
  return agent.post(`/api/groups/${groupId}/withdrawals`).send({ bankCode: '033', accountNumber: '0000000000', code: c, idempotencyKey: key })
}
const sendCode = async () => {
  await t.db.query(`update otp_codes set created_at = created_at - interval '1 minute'`) // skip the resend cooldown in tests
  await agent.post('/api/withdrawals/code').expect(204)
}
const balances = async () => {
  const g = (await agent.get('/api/groups').expect(200)).body.groups[0]
  return { available: g.availableKobo as number, withdrawable: g.withdrawableKobo as number }
}

describe('withdrawals', () => {
  beforeEach(async () => { await setup() })

  it('needs a valid one-time code and does not touch Kora without one', async () => {
    await sendCode()
    const wrong = t.lastCode('isaac@example.com') === '111111' ? '222222' : '111111'
    await withdraw('key-bbbbbbbb', wrong).then((r) => expect(r.status).toBe(400))
    expect(t.calls.disburse).toHaveLength(0)
  })

  it('pays out what the group can withdraw and holds that money in the ledger', async () => {
    expect(await balances()).toEqual({ available: 4_998_500, withdrawable: 4_988_500 })
    await sendCode()
    const res = await withdraw()
    expect(res.status).toBe(202)
    expect(res.body.withdrawal).toMatchObject({ status: 'processing', amountKobo: 4_988_500, accountName: 'ISAAC TEST' })

    expect(t.calls.disburse).toHaveLength(1)
    expect(t.calls.disburse[0]).toMatchObject({ amountNaira: 49_885, bankCode: '033', accountNumber: '0000000000' })
    expect(t.calls.disburse[0].reference).toMatch(/^PS-WD-/)
    expect(await balances()).toEqual({ available: 5_000, withdrawable: 0 }) // Kora's ₦50 payout fee is also deducted
  })

  it('refuses a second withdrawal when nothing is left', async () => {
    await sendCode()
    await withdraw('key-cccccccc')
    await sendCode()
    const again = await withdraw('key-dddddddd')
    expect(again.status).toBe(409)
    expect(t.calls.disburse).toHaveLength(1)
  })

  it('pays only once when the same request is sent twice', async () => {
    await sendCode()
    const first = await withdraw('key-eeeeeeee')
    const second = await withdraw('key-eeeeeeee', '000000')
    expect(second.body.withdrawal.id).toBe(first.body.withdrawal.id)
    expect(t.calls.disburse).toHaveLength(1)
  })

  it("will not touch another organizer's group", async () => {
    const other = await signedInAgent(t, 'other@example.com')
    await other.post('/api/withdrawals/code').expect(204)
    const res = await other.post(`/api/groups/${groupId}/withdrawals`).send({ bankCode: '033', accountNumber: '0000000000', code: t.lastCode('other@example.com'), idempotencyKey: 'key-ffffffff' })
    expect(res.status).toBe(404)
    expect(t.calls.disburse).toHaveLength(0)
  })

  it('settles a processing withdrawal from the transfer.success webhook', async () => {
    await sendCode()
    const w = (await withdraw('key-gggggggg')).body.withdrawal
    const ref = (await t.db.query('select kora_reference from withdrawals where id = $1', [w.id]))[0].kora_reference
    await post(t, signedTransfer(t, 'transfer.success', ref)).expect(200)
    expect((await t.db.query('select status from withdrawals'))[0].status).toBe('success')
  })

  it('gives the money back when the transfer fails', async () => {
    await sendCode()
    const w = (await withdraw('key-hhhhhhhh')).body.withdrawal
    const ref = (await t.db.query('select kora_reference from withdrawals where id = $1', [w.id]))[0].kora_reference
    await post(t, signedTransfer(t, 'transfer.failed', ref)).expect(200)
    expect((await t.db.query('select status from withdrawals'))[0].status).toBe('failed')
    expect(await balances()).toEqual({ available: 4_998_500, withdrawable: 4_988_500 })
  })
})

describe('withdrawals when Kora misbehaves', () => {
  it('marks a payout failed and frees the money when Kora clearly refuses it', async () => {
    await setup({ kora: { disburse: async () => { throw new KoraError('Insufficient balance', 400, false) } } })
    await sendCode()
    const res = await withdraw()
    expect(res.status).toBe(422)
    expect((await t.db.query('select status, failure_reason from withdrawals'))[0]).toMatchObject({ status: 'failed', failure_reason: 'Insufficient balance' })
    expect((await balances()).withdrawable).toBe(4_988_500)
  })

  it('does NOT mark a payout failed after a timeout, because Kora may have paid', async () => {
    await setup({ kora: { disburse: async () => { throw providerDown() } } })
    await sendCode()
    const res = await withdraw()
    expect(res.status).toBe(202)
    expect((await t.db.query('select status from withdrawals'))[0].status).toBe('processing')
    expect((await balances()).withdrawable).toBe(0) // still held, so it cannot be spent twice
  })

  it('later settles that payout by asking Kora what really happened', async () => {
    await setup({ kora: { disburse: async () => { throw providerDown() }, getPayout: async () => ({ status: 'success', feeNaira: 50 }) } })
    await sendCode()
    await withdraw()
    await t.db.query(`update withdrawals set created_at = now() - interval '5 minutes'`)
    expect(await reconcileWithdrawals(t.deps)).toBe(1)
    expect((await t.db.query('select status, fee_kobo from withdrawals'))[0]).toMatchObject({ status: 'success', fee_kobo: 5_000 })
  })

  it('fails a payout Kora never heard of, but only after a long wait', async () => {
    await setup({ kora: { disburse: async () => { throw providerDown() }, getPayout: async () => null } })
    await sendCode()
    await withdraw()
    await t.db.query(`update withdrawals set created_at = now() - interval '5 minutes'`)
    expect(await reconcileWithdrawals(t.deps)).toBe(0) // too soon to be sure
    await t.db.query(`update withdrawals set created_at = now() - interval '45 minutes'`)
    expect(await reconcileWithdrawals(t.deps)).toBe(1)
    expect((await t.db.query('select status from withdrawals'))[0].status).toBe('failed')
  })

  it('keeps two simultaneous withdrawals from paying the same money twice', async () => {
    await setup()
    await sendCode()
    const code = t.lastCode('isaac@example.com')
    const body = (key: string) => ({ bankCode: '033', accountNumber: '0000000000', code, idempotencyKey: key })
    const [a, b] = await Promise.all([
      agent.post(`/api/groups/${groupId}/withdrawals`).send(body('key-race-0001')),
      agent.post(`/api/groups/${groupId}/withdrawals`).send(body('key-race-0002')),
    ])
    expect(t.calls.disburse.length).toBeLessThanOrEqual(1)
    expect([a.status, b.status]).not.toEqual([202, 202])
  })
})
