import { Link } from 'react-router-dom'
import { buttonClass } from '../components/ui/Button'

export default function NotFound({ inApp = false }: { inApp?: boolean }) {
  return (
    <div className={inApp ? 'py-16 text-center' : 'grid min-h-screen place-items-center bg-bg px-5 text-center text-ink'}>
      <div>
        <h1 className="text-2xl font-semibold">We could not find that page</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Check the address, or go back to your payment groups.</p>
        <Link to={inApp ? '/app' : '/signin'} className={`${buttonClass('primary')} mt-6`}>{inApp ? 'Back to groups' : 'Go to sign in'}</Link>
      </div>
    </div>
  )
}
