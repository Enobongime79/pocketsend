import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { KoraError } from '../src/kora.js'
import { createGroup, createTestApp, providerDown, signedInAgent, validGroup, type TestApp } from './helpers.js'

let t: TestApp
beforeEach(async () => { t = await createTestApp() })

describe('creating a payment group (one Kora virtual account each)', () => {
  it('opens a virtual account with Kora and saves it, without ever storing the BVN', async () => {
    const agent = await signedInAgent(t)
    const res = await agent.post('/api/groups').send(validGroup()).expect(201)

    expect(t.calls.createVirtualAccount).toHaveLength(1)
    const sent = t.calls.createVirtualAccount[0]
    expect(sent.bvn).toBe('22222222222')
    expect(sent.customerEmail).toBe('isaac@example.com')
    expect(sent.accountReference).toMatch(/^pocketsend-/)
    expect(res.body.group.virtualAccount.accountNumber).toMatch(/^\d{10}$/)

    for (const table of ['users', 'groups', 'otp_codes', 'sessions', 'webhook_events']) {
      expect(JSON.stringify(await t.db.query(`select * from ${table}`))).not.toContain('22222222222')
    }
    expect((await t.db.query('select full_name from users'))[0].full_name).toBe('Isaac Test')
  })

  it('lists only your own groups', async () => {
    const a = await signedInAgent(t, 'a@example.com')
    await createGroup(a)
    const b = await signedInAgent(t, 'b@example.com')
    expect((await b.get('/api/groups').expect(200)).body.groups).toHaveLength(0)
    expect((await a.get('/api/groups').expect(200)).body.groups).toHaveLength(1)
  })

  it('explains what is wrong with the form', async () => {
    const agent = await signedInAgent(t)
    const bad = await agent.post('/api/groups').send(validGroup({ bvn: '123' })).expect(400)
    expect(bad.body.error.fields.bvn).toBeTruthy()
    const small = await agent.post('/api/groups').send(validGroup({ amountKobo: 500 })).expect(400)
    expect(small.body.error.fields.amountKobo).toBeTruthy()
    const target = await agent.post('/api/groups').send(validGroup({ targetKobo: 100 })).expect(400)
    expect(target.body.error.fields.targetKobo).toBeTruthy()
  })

  it('creates no group when Kora refuses (for example an invalid BVN)', async () => {
    const t2 = await createTestApp({ kora: { createVirtualAccount: async () => { throw new KoraError('Invalid BVN', 400, false) } } })
    const agent = await signedInAgent(t2)
    const res = await agent.post('/api/groups').send(validGroup()).expect(422)
    expect(res.body.error.message).toBe('Invalid BVN')
    expect(await t2.db.query('select id from groups')).toHaveLength(0)
  })

  it('creates no group and hides provider details when Kora is down', async () => {
    const t2 = await createTestApp({ kora: { createVirtualAccount: async () => { throw providerDown() } } })
    const agent = await signedInAgent(t2)
    const res = await agent.post('/api/groups').send(validGroup()).expect(502)
    expect(res.body.error.code).toBe('provider_unavailable')
    expect(await t2.db.query('select id from groups')).toHaveLength(0)
  })

  it("stops at Kora's limit of virtual accounts", async () => {
    const t2 = await createTestApp({ cfg: { koraVbaLimit: 1 } })
    const agent = await signedInAgent(t2)
    await createGroup(agent)
    const res = await agent.post('/api/groups').send(validGroup({ name: 'Second group' })).expect(409)
    expect(res.body.error.code).toBe('capacity')
  })

  it('needs sign in', async () => {
    await request(t.app).post('/api/groups').send(validGroup()).expect(401)
  })
})
