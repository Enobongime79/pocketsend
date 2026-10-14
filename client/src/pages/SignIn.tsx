import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError, api } from '../data/api'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Fields'
import { Logo } from '../components/ui/Logo'
import { useAuth } from '../state/auth'
import { useThemeDefault } from '../state/theme'

const RESEND_SECONDS = 30

/** Email and a 6-digit one-time code, checked by the server. No password and no social login. */
export default function SignIn() {
  useThemeDefault('dark')
  const navigate = useNavigate()
  const { user, loading, signIn } = useAuth()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Count down until "Resend code" is allowed again
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (loading) return <div className="min-h-screen bg-bg" />
  if (user) return <Navigate to="/app" replace />

  const requestCode = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address, like you@example.com.')
    setError(undefined)
    setBusy(true)
    try {
      await api.requestCode(email.trim())
      setStep('code')
      setCode('')
      setCooldown(RESEND_SECONDS)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'cooldown') setCooldown(err.retryAfter ?? RESEND_SECONDS)
      setError(err instanceof Error ? err.message : 'We could not send the code. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code we sent you.')
    setError(undefined)
    setBusy(true)
    try {
      signIn(await api.verifyCode(email.trim(), code))
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not check that code. Try again.')
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-5 py-6 text-ink">
      <div className="card w-full max-w-[400px] p-6 sm:p-8">
        <div className="mb-8 mt-6 sm:mt-0"><Logo /></div>
        <h1 className="mb-2.5 text-[28px] font-semibold leading-tight sm:text-[26px]">Collect group money without the screenshots</h1>
        <p className="mb-7 leading-relaxed text-muted">
          {step === 'email'
            ? 'Enter your email and we will send you a code to sign in. No password needed.'
            : <>We sent a 6-digit code to <span className="break-words text-ink">{email.trim()}</span>.</>}
        </p>

        {step === 'email' ? (
          <form onSubmit={requestCode} noValidate>
            <TextField label="Email address" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoFocus />
            <Button type="submit" variant="primary" block className="md:h-12" loading={busy}>Send code</Button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <TextField label="6-digit code" mono inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={error} autoFocus
              hint="It can take a minute to arrive. Check your spam folder too." />
            <Button type="submit" variant="primary" block className="md:h-12" loading={busy}>Verify and sign in</Button>
            <div className="mt-2 flex gap-2">
              <Button variant="ghost" block disabled={cooldown > 0 || busy} onClick={() => requestCode()}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </Button>
              <Button variant="ghost" block disabled={busy} onClick={() => { setStep('email'); setCode(''); setError(undefined) }}>Change email</Button>
            </div>
          </form>
        )}
        <p className="mt-5 text-center text-xs text-subtle">No business account needed. Free to start.</p>
      </div>
    </div>
  )
}
