/**
 * Koneksi PostgreSQL via postgres.js (pin 3.4.9) — Supabase PG 17 melalui
 * connection pooler (AD-9). `prepare: false` wajib untuk pooler mode transaksi
 * (PgBouncer); pool kecil cukup untuk skala 22–40 owner.
 */
import { drizzle, type PostgresJsDatabase, type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from '../../drizzle/schema'

/** Database dengan skema terdaftar — dipakai service teratas untuk membuka transaksi. */
export type Db = PostgresJsDatabase<typeof schema>

/** Handle transaksi — diterima fungsi lintas modul dalam jalur transaksi (AD-2/AD-5). */
export type Tx = PgTransaction<PostgresJsQueryResultHKT, Record<string, never>, ExtractTablesWithRelations<typeof schema>>

/** Koneksi atau transaksi — parameter `db|tx` pada repo/service komposabel. */
export type DbClient = Db | Tx

let _sql: ReturnType<typeof postgres> | undefined
let _db: Db | undefined

export function useDb(): Db {
  if (_db) return _db
  const url = useRuntimeConfig().databaseUrl
  if (!url) {
    throw new Error('NUXT_DATABASE_URL belum dikonfigurasi — isi .env dari .env.example (AD-9).')
  }
  _sql = postgres(url, { max: 10, prepare: false, idle_timeout: 20 })
  _db = drizzle(_sql, { schema })
  return _db
}
