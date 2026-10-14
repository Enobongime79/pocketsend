export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'expired'
export type GroupStatus = 'active' | 'paused' | 'closed'
export type AmountType = 'fixed' | 'open'

/** One incoming bank transfer to a group's account number. Comes from the server (recorded from Kora's webhook). */
export interface Payment {
  id: string
  reference: string
  /** Stable identity of the sender, set by the server. Used to add up one person's payments. */
  payerKey: string
  payerName: string // sender's account name
  senderBank: string
  senderAccountLast4: string
  amountKobo: number
  status: PaymentStatus
  createdAt: string // ISO 8601, UTC
}

export interface VirtualAccount {
  accountNumber: string
  bankName: string
  accountName: string
}

export interface Group {
  id: string
  name: string
  description: string
  amountType: AmountType
  amountKobo: number // expected per person when fixed, otherwise 0
  targetKobo?: number
  closesAt?: string
  status: GroupStatus
  virtualAccount: VirtualAccount
  payments: Payment[] // newest first
  /** What the group has collected minus Kora's fees and withdrawals. Worked out by the server's ledger. */
  availableKobo: number
  /** What can be withdrawn right now (available, minus a small reserve for the payout fee). */
  withdrawableKobo: number
}

export interface NewGroupInput {
  name: string
  description: string
  amountType: AmountType
  amountKobo: number
  targetKobo?: number
  closesAt?: string
  /** Name as on the BVN. Kora requires it to open the account. */
  fullName: string
  /** Sent to Kora to open the account. The server does not store it. */
  bvn: string
}

export interface Withdrawal {
  id: string
  amountKobo: number
  status: 'processing' | 'success' | 'failed'
  bankName: string
  accountName: string
  accountLast4: string
  failureReason?: string
  createdAt: string
}

export interface Bank {
  name: string
  code: string
}

export interface User {
  email: string
  fullName: string | null
}
