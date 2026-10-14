import type { Config } from './config.js'

/**
 * A thin client for the Kora merchant API. Endpoints and fields follow Kora's docs (developers.korapay.com).
 * Money here is in NAIRA because that is what Kora sends and expects. The rest of the app converts to and from kobo.
 *
 * Errors are split in two on purpose:
 *   retryable = false  Kora said no (a 4xx). Nothing was done, so it is safe to treat the action as failed.
 *   retryable = true   A timeout, a network failure or a 5xx. Kora may or may not have done it. NEVER treat a payout
 *                      as failed in this case. Check its real status first (Kora's own advice for payouts).
 */
export class KoraError extends Error {
  constructor(message: string, public status: number | null, public retryable: boolean) {
    super(message)
  }
}

export interface VirtualAccount {
  accountNumber: string
  accountName: string
  bankName: string
  bankCode: string
}
export interface VbaTransaction {
  reference: string
  status: string
  amountNaira: number
  feeNaira: number
  payerName: string
  payerBank: string
  payerAccountNumber: string
}
export interface KoraClient {
  createVirtualAccount(input: { accountName: string; accountReference: string; customerName: string; customerEmail: string; bvn: string }): Promise<VirtualAccount>
  /** Sandbox only: credits a virtual account with a test payment. */
  creditSandboxAccount(accountNumber: string, amountNaira: number): Promise<void>
  listVbaTransactions(accountNumber: string): Promise<VbaTransaction[]>
  getCharge(reference: string): Promise<{ status: string; amountPaidNaira: number; feeNaira: number } | null>
  listBanks(): Promise<{ name: string; code: string }[]>
  resolveAccount(bankCode: string, accountNumber: string): Promise<{ accountName: string; bankName?: string }>
  disburse(input: {
    reference: string
    amountNaira: number
    bankCode: string
    accountNumber: string
    narration: string
    customerName: string
    customerEmail: string
  }): Promise<{ status: string; feeNaira: number }>
  getPayout(reference: string): Promise<{ status: string; feeNaira: number } | null>
}

const num = (v: unknown, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function createKoraClient(cfg: Config, fetchImpl: typeof fetch = fetch): KoraClient {
  async function request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    let res: Response
    try {
      res = await fetchImpl(`${cfg.koraBaseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${cfg.koraSecretKey}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      throw new KoraError('Could not reach the payment provider.', null, true)
    } finally {
      clearTimeout(timer)
    }
    const json: any = await res.json().catch(() => null)
    if (res.status >= 500) throw new KoraError(json?.message ?? 'Payment provider error.', res.status, true)
    if (!res.ok || json?.status === false) throw new KoraError(json?.message ?? `Request rejected (${res.status}).`, res.status, false)
    return json
  }

  return {
    async createVirtualAccount(i) {
      const r = await request('POST', '/virtual-bank-account', {
        account_name: i.accountName,
        account_reference: i.accountReference,
        permanent: true, // Kora currently only accepts true
        bank_code: cfg.koraVbaBankCode,
        customer: { name: i.customerName, email: i.customerEmail },
        kyc: { bvn: i.bvn }, // required by Kora. Passed through, never stored by us.
      })
      const d = r.data
      return { accountNumber: String(d.account_number), accountName: String(d.account_name), bankName: String(d.bank_name), bankCode: String(d.bank_code ?? cfg.koraVbaBankCode) }
    },

    async creditSandboxAccount(accountNumber, amountNaira) {
      await request('POST', '/virtual-bank-account/sandbox/credit', { account_number: accountNumber, currency: 'NGN', amount: amountNaira })
    },

    async listVbaTransactions(accountNumber) {
      const r = await request('GET', `/virtual-bank-account/transactions?account_number=${encodeURIComponent(accountNumber)}&limit=100`)
      return (r.data?.transactions ?? []).map((t: any) => ({
        reference: String(t.reference),
        status: String(t.status),
        amountNaira: num(t.amount),
        feeNaira: num(t.fee),
        payerName: String(t.payer_bank_account?.account_name ?? ''),
        payerBank: String(t.payer_bank_account?.bank_name ?? ''),
        payerAccountNumber: String(t.payer_bank_account?.account_number ?? ''),
      }))
    },

    async getCharge(reference) {
      try {
        const r = await request('GET', `/charges/${encodeURIComponent(reference)}`)
        return { status: String(r.data.status), amountPaidNaira: num(r.data.amount_paid ?? r.data.amount), feeNaira: num(r.data.fee) }
      } catch (e) {
        if (e instanceof KoraError && e.status === 404) return null
        throw e
      }
    },

    async listBanks() {
      const r = await request('GET', '/misc/banks?countryCode=NG')
      return (r.data as any[]).map((b) => ({ name: String(b.name).trim(), code: String(b.code) }))
    },

    async resolveAccount(bankCode, accountNumber) {
      // Kora's docs list the currency field as a country code (for example NG).
      const r = await request('POST', '/misc/banks/resolve', { bank: bankCode, account: accountNumber, currency: 'NG' })
      return { accountName: String(r.data.account_name), bankName: r.data.bank_name ? String(r.data.bank_name) : undefined }
    },

    async disburse(i) {
      const r = await request('POST', '/transactions/disburse', {
        reference: i.reference, // must be unique and at least 5 characters
        destination: {
          type: 'bank_account',
          amount: Math.round(i.amountNaira * 100) / 100,
          currency: 'NGN',
          narration: i.narration,
          bank_account: { bank: i.bankCode, account: i.accountNumber },
          customer: { name: i.customerName, email: i.customerEmail },
        },
      })
      return { status: String(r.data?.status ?? 'processing'), feeNaira: num(r.data?.fee) }
    },

    async getPayout(reference) {
      // Kora calls this the Payout Verification (query) API. Confirm the path in the API reference when you test.
      try {
        const r = await request('GET', `/transactions/${encodeURIComponent(reference)}`)
        return { status: String(r.data.status), feeNaira: num(r.data.fee) }
      } catch (e) {
        if (e instanceof KoraError && e.status === 404) return null
        throw e
      }
    },
  }
}
