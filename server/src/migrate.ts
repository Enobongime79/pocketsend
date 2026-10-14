import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPgDb, type Db } from './db.js'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

/** Applies every .sql file in /migrations that has not been applied yet, in name order. */
export async function runMigrations(db: Db, log: (m: string) => void = console.log) {
  await db.exec('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())')
  const done = new Set((await db.query('select name from schema_migrations')).map((r) => r.name as string))
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    log(`Applying ${file}`)
    await db.tx(async (q) => {
      await q.query(readFileSync(join(dir, file), 'utf8'))
      await q.query('insert into schema_migrations (name) values ($1)', [file])
    })
  }
  log('Database is up to date.')
}

// `npm run migrate`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set. Add it to server/.env')
  const db = createPgDb(url)
  runMigrations(db).then(() => db.close(), (e) => { console.error(e); process.exit(1) })
}
