import express, { type ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { HttpError } from './errors.js'
import { KoraError } from './kora.js'
import { authRoutes } from './routes/auth.js'
import { devRoutes } from './routes/dev.js'
import { groupRoutes } from './routes/groups.js'
import { webhookRoutes } from './routes/webhooks.js'
import { withdrawalRoutes } from './routes/withdrawals.js'
import type { Deps } from './types.js'

export function createApp(d: Deps) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1) // so req.ip is the real client behind a proxy such as Render or Railway
  app.use(express.json({ limit: '100kb' }))

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    next()
  })

  app.get('/api/health', (_req, res) => void res.json({ ok: true }))

  // Called by Kora's servers, so it has no cookie and no Origin check. Its signature check is the protection.
  app.use('/api/webhooks', webhookRoutes(d))

  // Browser requests that change data must come from our own site (a second layer on top of SameSite cookies)
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && origin !== d.cfg.appOrigin) {
      return void res.status(403).json({ error: { code: 'bad_origin', message: 'Request blocked.' } })
    }
    next()
  })

  app.use('/api', authRoutes(d))
  app.use('/api', groupRoutes(d))
  app.use('/api', withdrawalRoutes(d))
  if (d.cfg.devTools) app.use('/api', devRoutes(d))

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return void res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } })
    }
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {}
      for (const i of err.issues) fields[i.path.join('.') || '_'] ??= i.message
      return void res.status(400).json({ error: { code: 'validation', message: 'Please check the highlighted fields.', fields } })
    }
    if (err instanceof KoraError) {
      // Never forward provider internals. A 4xx from Kora is usually something the user can fix (for example an invalid BVN).
      return void res.status(err.retryable ? 502 : 422).json({
        error: { code: err.retryable ? 'provider_unavailable' : 'provider_rejected', message: err.retryable ? 'The payment provider is not responding. Please try again.' : err.message },
      })
    }
    if ((err as { type?: string }).type === 'entity.parse.failed') {
      return void res.status(400).json({ error: { code: 'bad_json', message: 'Invalid request.' } })
    }
    console.error('Unhandled error:', err)
    res.status(500).json({ error: { code: 'internal', message: 'Something went wrong on our side.' } })
  }
  app.use(onError)

  return app
}
