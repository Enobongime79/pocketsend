import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, signedInAgent, type TestApp } from './helpers.js'

let t: TestApp
beforeEach(async () => { t = await createTestApp() })

describe('email one-time code sign in', () => {
  it('emails a 6-digit code and stores only a hash of it', async () => {
    await request(t.app).post('/api/auth/request-code').send({ email: 'Isaac@Example.com' }).expect(204)
    const code = t.lastCode('isaac@example.com')
    expect(code).toMatch(/^\d{6}$/)
    const rows = await t.db.query('select code_hash from otp_codes')
    expect(rows).toHaveLength(1)
    expect(rows[0].code_hash).not.toContain(code)
    expect(rows[0].code_hash).toHaveLength(64)
  })

  it('rejects a wrong code, accepts the right one, and sets an httpOnly cookie', async () => {
    const agent = request.agent(t.app)
    await agent.post('/api/auth/request-code').send({ email: 'isaac@example.com' }).expect(204)
    const wrong = t.lastCode('isaac@example.com') === '123456' ? '654321' : '123456'
    await agent.post('/api/auth/verify-code').send({ email: 'isaac@example.com', code: wrong }).expect(400)
    const ok = await agent.post('/api/auth/verify-code').send({ email: 'isaac@example.com', code: t.lastCode('isaac@example.com') }).expect(200)
    expect(String(ok.headers['set-cookie'])).toMatch(/HttpOnly/)
    expect(String(ok.headers['set-cookie'])).toMatch(/SameSite=Lax/)
    const me = await agent.get('/api/me').expect(200)
    expect(me.body.user.email).toBe('isaac@example.com')
  })

  it('locks the code after 5 wrong guesses, even if the right code is typed next', async () => {
    await request(t.app).post('/api/auth/request-code').send({ email: 'isaac@example.com' }).expect(204)
    const right = t.lastCode('isaac@example.com')
    const wrong = right === '111111' ? '222222' : '111111'
    for (let i = 0; i < 5; i++) await request(t.app).post('/api/auth/verify-code').send({ email: 'isaac@example.com', code: wrong }).expect(400)
    await request(t.app).post('/api/auth/verify-code').send({ email: 'isaac@example.com', code: right }).expect(400)
  })

  it('works only once', async () => {
    const agent = await signedInAgent(t)
    await agent.post('/api/auth/logout').expect(204)
    const code = t.lastCode('isaac@example.com')
    await request(t.app).post('/api/auth/verify-code').send({ email: 'isaac@example.com', code }).expect(400)
  })

  it('makes you wait before asking for another code', async () => {
    await request(t.app).post('/api/auth/request-code').send({ email: 'isaac@example.com' }).expect(204)
    const again = await request(t.app).post('/api/auth/request-code').send({ email: 'isaac@example.com' }).expect(429)
    expect(again.body.error.code).toBe('cooldown')
    expect(again.body.error.retryAfter).toBeGreaterThan(0)
  })

  it('rejects an expired code', async () => {
    await request(t.app).post('/api/auth/request-code').send({ email: 'isaac@example.com' }).expect(204)
    await t.db.query(`update otp_codes set expires_at = now() - interval '1 minute'`)
    await request(t.app).post('/api/auth/verify-code').send({ email: 'isaac@example.com', code: t.lastCode('isaac@example.com') }).expect(400)
  })

  it('ends the session on logout', async () => {
    const agent = await signedInAgent(t)
    await agent.get('/api/me').expect(200)
    await agent.post('/api/auth/logout').expect(204)
    await agent.get('/api/me').expect(401)
  })

  it('keeps private routes private', async () => {
    await request(t.app).get('/api/groups').expect(401)
  })

  it('blocks state-changing requests that come from another website', async () => {
    const agent = await signedInAgent(t)
    await agent.post('/api/groups').set('Origin', 'https://evil.example').send({}).expect(403)
  })
})
