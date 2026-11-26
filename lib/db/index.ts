import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { pool?: Pool }

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL
  const neonDatabaseUrl = process.env.NEON_DATABASE_URL

  if (databaseUrl && neonDatabaseUrl) {
    try {
      const hostname = new URL(databaseUrl).hostname
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return neonDatabaseUrl
      }
    } catch {
      return neonDatabaseUrl
    }
  }

  return databaseUrl || neonDatabaseUrl
}

export const pool = globalForDb.pool ?? new Pool({ connectionString: getDatabaseUrl() })
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema })
