import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { createPgDb } from './db.js'
import { createKoraClient } from './kora.js'
import { createMailer } from './mailer.js'
import { runMigrations } from './migrate.js'
import { reconcileWithdrawals } from './routes/withdrawals.js'

const cfg = loadConfig()
const db = createPgDb(cfg.databaseUrl)
const deps = { cfg, db, mailer: createMailer(cfg), kora: createKoraClient(cfg) }

await runMigrations(db)

const app = createApp(deps)
app.listen(cfg.port, () => {
  console.log(`PocketSend API on http://localhost:${cfg.port}  (Kora ${cfg.koraEnv}${cfg.devTools ? ', dev tools ON' : ''})`)
  if (!cfg.smtp) console.log('No SMTP settings: sign-in codes are printed here instead of emailed.')
})

// Settle withdrawals whose outcome we never heard about
setInterval(() => void reconcileWithdrawals(deps).catch((e) => console.error('Reconcile failed:', e.message)), 60_000).unref()
