import { createHmac } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import request from 'supertest'
import { createApp } from '../src/app.js'
import type { Config } from '../src/config.js'
import type { Db } from '../src/db.js'
import { KoraError, type KoraClient } from '../src/kora.js'
import type { Mail } from '../src/mailer.js'

/** A real Postgres engine (PGlite, running in memory) with the real migrations applied. */
export async function createTestDb(): Promise<Db> {
  const pg = new PGlite()
  const wrap = (c: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }) => ({
    query: async (sql: string, params?: unknown[]) => (await c.query(sql, params as any[])).rows,
  })
  const db: Db = {
    ...wrap(pg as any),
    tx: (fn) => pg.transaction(async (t) => fn(wrap(t as any))),
    exec: async (sql) => void (await pg.exec(sql)),
    close: () => pg.close(),
  }
  const dir = join(import.meta.dirname, '..', 'migrations')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'))
  return db
}

export const testConfig = (over: Partial<Config> = {}): Config => ({
  nodeEnv: 'test', port: 0, databaseUrl: 'unused', appOrigin: 'http://localhost:5173',
  otpPepper: 'test-pepper-test-pepper', smtp: null, mailFrom: 'test@localhost',
  koraSecretKey: 'sk_test_secret', koraEnv: 'sandbox', koraBaseUrl: 'https://kora.test', koraVbaBankCode: '000',
  koraVbaLimit: 50, payoutFeeReserveKobo: 10_000, devTools: false, skipChargeVerify: false, ...over,
})

/** Stand-in for Kora. Override any method per test; `calls` records what the app asked Kora to do. */
export function fakeKora(over: Partial<KoraClient> = {}) {
  const calls = { createVirtualAccount: [] as any[], disburse: [] as any[] }
  let n = 0
  const kora: KoraClient = {
    async createVirtualAccount(i) {
      calls.createVirtualAccount.push(i)
      n += 1
      return { accountNumber: `90000000${String(n).padStart(2, '0')}`, accountName: i.accountName, bankName: 'Test Bank', bankCode: '000' }
    },
    async creditSandboxAccount() {},
    async listVbaTransactions() { return [] },
    async getCharge() { return { status: 'success', amountPaidNaira: 50_000, feeNaira: 15 } },
    async listBanks() { return [{ name: 'UBA', code: '033' }] },
    async resolveAccount() { return { accountName: 'ISAAC TEST' } },
    async disburse(i) { calls.disburse.push(i); return { status: 'processing', feeNaira: 50 } },
    async getPayout() { return null },
    ...over,
  }
  return { kora, calls }
}

export async function createTestApp(opts: { cfg?: Partial<Config>; kora?: Partial<KoraClient> } = {}) {
  const db = await createTestDb()
  const cfg = testConfig(opts.cfg)
  const outbox: Mail[] = []
  const { kora, calls } = fakeKora(opts.kora)
  const deps = { cfg, db, kora, mailer: { send: async (m: Mail) => void outbox.push(m) } }
  const app = createApp(deps)
  const lastCode = (to: string) => {
    const mail = [...outbox].reverse().find((m) => m.to === to)
    return /code is (\d{6})/.exec(mail?.text ?? '')?.[1] ?? ''
  }
  return { app, db, cfg, deps, outbox, kora, calls, lastCode }
}
export type TestApp = Awaited<ReturnType<typeof createTestApp>>

/** Signs in through the real endpoints and returns a client that keeps the session cookie. */
export async function signedInAgent(t: TestApp, email = 'isaac@example.com') {
  const agent = request.agent(t.app)
  await agent.post('/api/auth/request-code').send({ email }).expect(204)
  await agent.post('/api/auth/verify-code').send({ email, code: t.lastCode(email) }).expect(200)
  return agent
}

export const validGroup = (over: Record<string, unknown> = {}) => ({
  name: 'Ade and Tolu Wedding', description: '', amountType: 'fixed', amountKobo: 10_000_000,
  fullName: 'Isaac Test', bvn: '22222222222', ...over,
})

export async function createGroup(agent: ReturnType<typeof request.agent>, over: Record<string, unknown> = {}) {
  const res = await agent.post('/api/groups').send(validGroup(over)).expect(201)
  return res.body.group as { id: string; virtualAccount: { accountNumber: string } }
}

let ref = 0
/** Builds a Kora charge.success body and signs it the way Kora does (HMAC SHA256 of the data object). */
export function signedCharge(t: TestApp, accountNumber: string, o: { amount?: number; fee?: number; reference?: string; payer?: string } = {}) {
  ref += 1
  const data = {
    fee: o.fee ?? 15, amount: o.amount ?? 50_000, status: 'success', currency: 'NGN',
    reference: o.reference ?? `KPY-PAY-${ref}`, transaction_date: '2026-10-14T10:00:04.000Z',
    virtual_bank_account_details: {
      payer_bank_account: { bank_name: 'Test Bank', account_name: o.payer ?? 'Jane Pearson', account_number: '******1001' },
      virtual_bank_account: { bank_name: 'Wema Bank', account_number: accountNumber, permanent: true },
    },
  }
  const signature = createHmac('sha256', t.cfg.koraSecretKey).update(JSON.stringify(data)).digest('hex')
  return { body: { event: 'charge.success', data }, signature }
}

export function signedTransfer(t: TestApp, event: 'transfer.success' | 'transfer.failed', reference: string, fee = 50) {
  const data = { fee, amount: 49_885, status: event === 'transfer.success' ? 'success' : 'failed', currency: 'NGN', reference }
  return { body: { event, data }, signature: createHmac('sha256', t.cfg.koraSecretKey).update(JSON.stringify(data)).digest('hex') }
}

export const providerDown = () => new KoraError('Could not reach the payment provider.', null, true)
