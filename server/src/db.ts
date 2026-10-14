import pg from 'pg'

export type Row = Record<string, any>

export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<Row[]>
}

export interface Db extends Queryable {
  /** Runs fn inside one transaction. Throwing rolls everything back. */
  tx<R>(fn: (q: Queryable) => Promise<R>): Promise<R>
  /** Runs several statements at once (used for migrations). */
  exec(sql: string): Promise<void>
  close(): Promise<void>
}

// Postgres returns bigint and numeric as strings. Money is kobo and well inside Number's safe range.
pg.types.setTypeParser(20, (v) => Number(v))
pg.types.setTypeParser(1700, (v) => Number(v))

export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 10 })
  return {
    async query(sql, params) {
      return (await pool.query(sql, params as unknown[])).rows
    },
    async tx(fn) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const result = await fn({ query: async (sql, params) => (await client.query(sql, params as unknown[])).rows })
        await client.query('commit')
        return result
      } catch (err) {
        await client.query('rollback').catch(() => undefined)
        throw err
      } finally {
        client.release()
      }
    },
    async exec(sql) {
      await pool.query(sql)
    },
    close: () => pool.end(),
  }
}
