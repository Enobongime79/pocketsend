import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createGroup, createTestApp, providerDown, signedCharge, signedInAgent, type TestApp } from './helpers.js'

let t: TestApp
beforeEach(async () => { t = await createTestApp() })

const post = (t: TestApp, w: { body: unknown; signature: string }) =>
  request(t.app).post('/api/webhooks/kora').set('x-korapay-signature', w.signature).send(w.body as object)

describe('Kora charge.success webhook', () => {
  it('rejects a request with a bad signature and records nothing', async () => {
    const agent = await signedInAgent(t)
    const g = await createGroup(agent)
    const w = signedCharge(t, g.virtualAccount.accountNumber)
    await post(t, { ...w, signature: 'f'.repeat(64) }).expect(401)
    expect(await t.db.query('select id from payments')).toHaveLength(0)
  })

  it('records a payment against the right group and shows it on the dashboard', async () => {
    const agent = await signedInAgent(t)
    const g = await createGroup(agent)
    await post(t, signedCharge(t, g.virtualAccount.accountNumber, { amount: 50_000, fee: 15, payer: 'Jane Pearson' })).expect(200)

    const list = (await agent.get('/api/groups').expect(200)).body.groups[0]
    expect(list.payments).toHaveLength(1)
    expect(list.payments[0]).toMatchObject({ payerName: 'Jane Pearson', amountKobo: 5_000_000, status: 'confirmed', senderAccountLast4: '1001' })
    expect(list.availableKobo).toBe(5_000_000 - 1_500) // Kora's pay-in fee comes off what can be withdrawn
  })

  it('records a payment once even if Kora delivers it twice', async () => {
    const agent = await signedInAgent(t)
    const g = await createGroup(agent)
    const w = signedCharge(t, g.virtualAccount.accountNumber, { reference: 'KPY-SAME' })
    await post(t, w).expect(200)
    await post(t, w).expect(200)
    expect(await t.db.query('select id from payments')).toHaveLength(1)
  })

  it('groups payments from the same sender together', async () => {
    const agent = await signedInAgent(t)
    const g = await createGroup(agent)
    await post(t, signedCharge(t, g.virtualAccount.accountNumber, { payer: 'Funke Adeyemi' })).expect(200)
    await post(t, signedCharge(t, g.virtualAccount.accountNumber, { payer: 'funke  adeyemi' })).expect(200)
    const keys = (await t.db.query('select distinct payer_key from payments')).length
    expect(keys).toBe(1)
  })

  it('ignores payments to accounts it does not know, but still answers 200', async () => {
    await post(t, signedCharge(t, '0000000000')).expect(200)
    expect(await t.db.query('select id from payments')).toHaveLength(0)
  })

  it('records the amount Kora confirms, not the amount the request claims', async () => {
    const t2 = await createTestApp({ kora: { getCharge: async () => ({ status: 'success', amountPaidNaira: 5_000, feeNaira: 15 }) } })
    const agent = await signedInAgent(t2)
    const g = await createGroup(agent)
    await post(t2, signedCharge(t2, g.virtualAccount.accountNumber, { amount: 9_999_999 })).expect(200)
    expect((await t2.db.query('select amount_kobo from payments'))[0].amount_kobo).toBe(500_000)
  })

  it('does not record a charge Kora says did not succeed', async () => {
    const t2 = await createTestApp({ kora: { getCharge: async () => ({ status: 'failed', amountPaidNaira: 0, feeNaira: 0 }) } })
    const agent = await signedInAgent(t2)
    const g = await createGroup(agent)
    await post(t2, signedCharge(t2, g.virtualAccount.accountNumber)).expect(200)
    expect(await t2.db.query('select id from payments')).toHaveLength(0)
  })

  it('asks Kora to retry when it cannot verify the charge, and records it on the retry', async () => {
    let down = true
    const t2 = await createTestApp({
      kora: { getCharge: async () => { if (down) throw providerDown(); return { status: 'success', amountPaidNaira: 50_000, feeNaira: 15 } } },
    })
    const agent = await signedInAgent(t2)
    const g = await createGroup(agent)
    const w = signedCharge(t2, g.virtualAccount.accountNumber, { reference: 'KPY-RETRY' })
    expect((await post(t2, w)).status).toBeGreaterThanOrEqual(500) // anything but 200 makes Kora retry
    expect(await t2.db.query('select id from payments')).toHaveLength(0)
    down = false
    await post(t2, w).expect(200)
    expect(await t2.db.query('select id from payments')).toHaveLength(1)
  })
})

describe('syncing from Kora (safety net for a missed webhook)', () => {
  it('adds payments Kora has that we do not, once', async () => {
    const tx = { reference: 'KPY-SYNC-1', status: 'success', amountNaira: 7_000, feeNaira: 15, payerName: 'Ngozi Obi', payerBank: 'GTBank', payerAccountNumber: '******2211' }
    const t2 = await createTestApp({ kora: { listVbaTransactions: async () => [tx, { ...tx, reference: 'KPY-SYNC-2', status: 'failed' }] } })
    const agent = await signedInAgent(t2)
    const g = await createGroup(agent)
    expect((await agent.post(`/api/groups/${g.id}/sync`).expect(200)).body.added).toBe(1)
    expect((await agent.post(`/api/groups/${g.id}/sync`).expect(200)).body.added).toBe(0)
  })
})
