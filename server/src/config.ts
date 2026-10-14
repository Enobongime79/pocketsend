import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  OTP_PEPPER: z.string().min(16, 'OTP_PEPPER must be at least 16 characters'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('PocketSend <no-reply@localhost>'),

  KORA_SECRET_KEY: z.string().min(1, 'KORA_SECRET_KEY is required'),
  KORA_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  KORA_BASE_URL: z.string().url().default('https://api.korapay.com/merchant/api/v1'),
  KORA_VBA_BANK_CODE: z.string().default('000'), // 000 = sandbox virtual accounts
  KORA_VBA_LIMIT: z.coerce.number().int().default(50), // Kora's default cap on virtual accounts

  /** Kora's payout fee is not known before a payout. This much is held back from every withdrawal to cover it. */
  PAYOUT_FEE_RESERVE_KOBO: z.coerce.number().int().min(0).default(10_000),

  DEV_TOOLS: z.enum(['true', 'false']).default('false'),
  SKIP_CHARGE_VERIFY: z.enum(['true', 'false']).default('false'),
})

export interface Config {
  nodeEnv: 'development' | 'test' | 'production'
  port: number
  databaseUrl: string
  appOrigin: string
  otpPepper: string
  smtp: { host: string; port: number; user?: string; pass?: string } | null
  mailFrom: string
  koraSecretKey: string
  koraEnv: 'sandbox' | 'live'
  koraBaseUrl: string
  koraVbaBankCode: string
  koraVbaLimit: number
  payoutFeeReserveKobo: number
  devTools: boolean
  skipChargeVerify: boolean
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env)
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid configuration. Check your .env file:\n${lines.join('\n')}`)
  }
  const e = parsed.data

  // A mismatch between the key and the mode is the classic way to send real money by accident
  if (e.KORA_ENV === 'sandbox' && /^sk_live/i.test(e.KORA_SECRET_KEY)) {
    throw new Error('KORA_ENV is "sandbox" but KORA_SECRET_KEY is a live key. Use your sk_test key.')
  }
  if (e.KORA_ENV === 'live' && /^sk_test/i.test(e.KORA_SECRET_KEY)) {
    throw new Error('KORA_ENV is "live" but KORA_SECRET_KEY is a test key.')
  }
  if (e.NODE_ENV === 'production') {
    if (!e.SMTP_HOST) throw new Error('SMTP_HOST is required in production so sign-in codes can be emailed.')
    if (e.DEV_TOOLS === 'true') throw new Error('DEV_TOOLS must be false in production.')
    if (e.SKIP_CHARGE_VERIFY === 'true') throw new Error('SKIP_CHARGE_VERIFY must be false in production.')
  }

  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    appOrigin: e.APP_ORIGIN.replace(/\/$/, ''),
    otpPepper: e.OTP_PEPPER,
    smtp: e.SMTP_HOST ? { host: e.SMTP_HOST, port: e.SMTP_PORT, user: e.SMTP_USER, pass: e.SMTP_PASS } : null,
    mailFrom: e.MAIL_FROM,
    koraSecretKey: e.KORA_SECRET_KEY,
    koraEnv: e.KORA_ENV,
    koraBaseUrl: e.KORA_BASE_URL.replace(/\/$/, ''),
    koraVbaBankCode: e.KORA_VBA_BANK_CODE,
    koraVbaLimit: e.KORA_VBA_LIMIT,
    payoutFeeReserveKobo: e.PAYOUT_FEE_RESERVE_KOBO,
    devTools: e.DEV_TOOLS === 'true',
    skipChargeVerify: e.SKIP_CHARGE_VERIFY === 'true',
  }
}
