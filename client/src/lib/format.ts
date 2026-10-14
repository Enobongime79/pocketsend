// All money in the app is an integer number of kobo (100 kobo = ₦1).
const TZ = 'Africa/Lagos'
const whole = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 })
const withKobo = new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const nairaToKobo = (naira: number) => Math.round(naira * 100)

export function formatNaira(kobo: number): string {
  const sign = kobo < 0 ? '-' : ''
  const abs = Math.abs(kobo)
  return `${sign}₦${abs % 100 === 0 ? whole.format(abs / 100) : withKobo.format(abs / 100)}`
}

/** Compact chips only, for example ₦25K. Primary amounts are never abbreviated. */
export function compactNaira(kobo: number): string {
  const n = kobo / 100
  const trim = (v: number, digits: number) => v.toFixed(digits).replace(/\.?0+$/, '')
  if (n >= 1_000_000) return `₦${trim(n / 1_000_000, 2)}M`
  if (n >= 1_000) return `₦${trim(n / 1_000, 1)}K`
  return `₦${whole.format(n)}`
}

/** "1350000" or "1,350,000" to 1350000 */
export const parseDigits = (raw: string): number => {
  const d = raw.replace(/\D/g, '').slice(0, 12)
  return d ? parseInt(d, 10) : 0
}
export const formatDigits = (n: number): string => (n ? whole.format(n) : '')

const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(iso))
    .toUpperCase()
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('en-NG', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(d)
  return `${date}, ${formatTime(iso)}`
}

/** Today: 2:14 PM. Yesterday: Yesterday. Older: 6 Oct. */
export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (dayKey(d) === dayKey(now)) return formatTime(iso)
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86_400_000))) return 'Yesterday'
  return new Intl.DateTimeFormat('en-NG', { timeZone: TZ, day: 'numeric', month: 'short' }).format(d)
}

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-NG', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
