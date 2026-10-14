import type { Config } from './config.js'
import type { Db } from './db.js'
import type { KoraClient } from './kora.js'
import type { Mailer } from './mailer.js'

export interface Deps {
  cfg: Config
  db: Db
  mailer: Mailer
  kora: KoraClient
}

export interface AuthedUser {
  id: string
  email: string
  fullName: string | null
}
