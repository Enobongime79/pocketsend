import type { Bank, Group, NewGroupInput, User, Withdrawal } from '../types'

/**
 * The only file that talks to the PocketSend server. Every call goes to /api (proxied to the server in development).
 * The session lives in an httpOnly cookie that the browser sends by itself, so no token is ever handled here.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public retryAfter?: number,
  ) {
    super(message)
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network', 'Cannot reach the server. Check your connection and try again.')
  }
  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const e = json?.error
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Something went wrong. Please try again.', e?.fields, e?.retryAfter)
  }
  return json as T
}

export const api = {
  /** The signed-in user, or null when nobody is signed in. */
  async me(): Promise<User | null> {
    try {
      return (await call<{ user: User }>('GET', '/me')).user
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }
  },
  requestCode: (email: string) => call<void>('POST', '/auth/request-code', { email }),
  async verifyCode(email: string, code: string): Promise<User> {
    return (await call<{ user: User }>('POST', '/auth/verify-code', { email, code })).user
  },
  logout: () => call<void>('POST', '/auth/logout'),

  async listGroups(): Promise<Group[]> {
    return (await call<{ groups: Group[] }>('GET', '/groups')).groups
  },
  async createGroup(input: NewGroupInput): Promise<Group> {
    return (await call<{ group: Group }>('POST', '/groups', input)).group
  },

  async listBanks(): Promise<Bank[]> {
    return (await call<{ banks: Bank[] }>('GET', '/banks')).banks
  },
  async resolveAccount(bankCode: string, accountNumber: string): Promise<string> {
    return (await call<{ accountName: string }>('POST', '/banks/resolve', { bankCode, accountNumber })).accountName
  },
  requestWithdrawalCode: () => call<void>('POST', '/withdrawals/code'),
  async withdraw(groupId: string, input: { bankCode: string; accountNumber: string; code: string; idempotencyKey: string }): Promise<Withdrawal> {
    return (await call<{ withdrawal: Withdrawal }>('POST', `/groups/${groupId}/withdrawals`, input)).withdrawal
  },

  /** DEV ONLY (server needs DEV_TOOLS=true): asks Kora's sandbox to send a test transfer to the group's account. */
  devCredit: (groupId: string, amountNaira: number) => call<{ added: number }>('POST', '/dev/credit', { groupId, amountNaira }),
}
