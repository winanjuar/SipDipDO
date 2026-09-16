// server/utils/db.ts
//
// Koneksi database dan utilitas transaksi untuk seluruh modul domain.
//
// Stack (design.md PART A "Dependencies"):
//   - postgres.js@3.4.9      : driver PostgreSQL (Supabase, PostgreSQL 17)
//   - drizzle-orm@0.45.2     : query builder + skema di `drizzle/schema.ts`
//
// Prinsip arsitektur yang ditegakkan di sini:
//   - AD-2 : setiap penulisan multi-tabel terjadi dalam SATU transaksi DB atomik
//            dengan pengambilan lock berurutan GLOBAL + transisi status CAS.
//            Hanya service teratas membuka transaksi; fungsi lintas modul menerima
//            handle `tx` (lihat `Tx` di bawah).
//   - AD-3 : `audit_logs` bersifat append-only, ditegakkan lewat DB grants
//            (GRANT SELECT, INSERT; REVOKE UPDATE, DELETE) — lihat `drizzle/grants.sql`.
//
// Modul ini AMAN diimpor tanpa koneksi DB hidup: client postgres.js dibuat lazy
// dan URL yang hilang baru dilaporkan saat query pertama dijalankan, bukan saat
// impor (agar type-check/build tetap lolos tanpa DATABASE_URL).

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../drizzle/schema'

// ---------------------------------------------------------------------------
// Konfigurasi koneksi
// ---------------------------------------------------------------------------

/**
 * Resolusi connection string dari environment.
 *
 * Sumber: `DATABASE_URL` (postgres://…). Untuk Supabase gunakan endpoint
 * connection pooler (PgBouncer, port 6543) karena deploy serverless (Vercel).
 */
/**
 * Akses environment tanpa bergantung pada `@types/node`.
 *
 * Nitro/Node menyediakan `process.env` saat runtime; helper ini membaca lewat
 * `globalThis` sehingga type-check tetap lolos meski `@types/node` belum
 * terpasang di tsconfig server yang terisolasi.
 */
function readEnv(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[key]
}

function resolveDatabaseUrl(): string {
  // Konvensi env: DATABASE_URL (postgres://…), disuntik via NUXT env / .env.
  const url = readEnv('DATABASE_URL')
  if (!url) {
    throw new Error(
      'DATABASE_URL tidak diset. Set connection string PostgreSQL (Supabase pooler) sebelum menjalankan query.',
    )
  }
  return url
}

/**
 * Opsi client postgres.js yang dituning untuk connection pooler serverless.
 *
 * - `prepare: false` : wajib saat memakai transaction pooler (PgBouncer mode
 *   `transaction`) yang tidak mendukung prepared statement lintas koneksi.
 * - `max: 1`          : satu koneksi per instance serverless; pooler di sisi
 *   Supabase yang menangani fan-out.
 */
const clientOptions: postgres.Options<Record<string, never>> = {
  prepare: false,
  max: 1,
}

// Singleton lazy — dibuat saat pertama kali dibutuhkan, bukan saat impor.
let _client: ReturnType<typeof postgres> | undefined

function getClient(): ReturnType<typeof postgres> {
  if (!_client) {
    _client = postgres(resolveDatabaseUrl(), clientOptions)
  }
  return _client
}

// ---------------------------------------------------------------------------
// Instance drizzle
// ---------------------------------------------------------------------------

/**
 * Membuat instance drizzle yang terikat ke seluruh skema domain.
 *
 * Dibungkus lazy via Proxy sehingga `import { db }` tidak memaksa koneksi saat
 * modul lain (atau type-checker) sekadar mengimpor `db`. Koneksi baru dibuka
 * saat properti/metode `db` benar-benar diakses.
 */
function createDb() {
  return drizzle(getClient(), { schema })
}

type Database = ReturnType<typeof createDb>

let _db: Database | undefined

function getDb(): Database {
  if (!_db) {
    _db = createDb()
  }
  return _db
}

/**
 * Instance drizzle bound-schema untuk seluruh aplikasi.
 *
 * Contoh:
 *   import { db } from '~/server/utils/db'
 *   const rows = await db.select().from(owners)
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const real = getDb()
    const value = Reflect.get(real as object, prop, receiver)
    return typeof value === 'function' ? value.bind(real) : value
  },
}) as Database

// Ekspor skema agar modul domain dapat mengimpor dari satu pintu bila diinginkan.
export { schema }

// ---------------------------------------------------------------------------
// Tipe transaksi (Tx) — handle yang diteruskan ke fungsi lintas modul (AD-2/AD-5)
// ---------------------------------------------------------------------------

/**
 * Handle transaksi drizzle.
 *
 * Diturunkan dari parameter callback `db.transaction` sehingga selalu sinkron
 * dengan versi drizzle-orm terpin, tanpa mengimpor tipe internal. Fungsi domain
 * yang berpartisipasi dalam transaksi lintas modul menerima `tx: Tx`.
 */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

// ---------------------------------------------------------------------------
// Helper transaksi
// ---------------------------------------------------------------------------

/**
 * Membungkus `db.transaction`. Menjalankan `fn` dalam satu transaksi DB atomik;
 * commit bila resolve, rollback penuh bila throw (AD-2).
 *
 * Hanya service teratas yang boleh membuka transaksi. Fungsi lintas modul yang
 * ikut serta menerima `tx` dan TIDAK membuka transaksi baru.
 *
 * Konvensi urutan lock: semua transaksi yang mengambil row lock (`FOR UPDATE`)
 * WAJIB mengikuti `GLOBAL_LOCK_ORDER` di bawah untuk mencegah deadlock AB-BA.
 */
export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(fn)
}

// ---------------------------------------------------------------------------
// Konvensi urutan lock global (AD-2)
// ---------------------------------------------------------------------------

/**
 * Urutan pengambilan lock global untuk SEMUA transaksi lintas modul.
 *
 * Sumber kebenaran: design.md PART B.4 "Finalization algorithm (AD-2)".
 * Urutan wajib: buy_orders → rkap_phases → positions → owners →
 * contribution_periods → distribution.
 *
 * Semua jalur tulis (finalisasi konfirmasi FR-20, input langsung/kompensasi
 * FR-21, penyesuaian RKAP, rekap distribusi FR-16, cron expiry FR-19) HARUS
 * mengakuisisi row lock (`SELECT … FOR UPDATE`) mengikuti urutan ini. Tidak
 * pernah owner-dulu-lalu-positions (cegah deadlock AB-BA finalisasi vs rekap).
 *
 * `as const` menjaga urutan & literal tabel sehingga bisa dipakai untuk
 * memvalidasi/mengurutkan kumpulan tabel yang akan dikunci.
 */
export const GLOBAL_LOCK_ORDER = [
  'buy_orders',
  'rkap_phases',
  'positions',
  'owners',
  'contribution_periods',
  'distribution',
] as const

/** Nama tabel yang berpartisipasi dalam konvensi urutan lock global. */
export type LockableTable = (typeof GLOBAL_LOCK_ORDER)[number]

/**
 * Indeks urutan lock sebuah tabel (semakin kecil = dikunci lebih dulu).
 * Berguna untuk mengurutkan kumpulan tabel sebelum mengambil lock.
 */
export function lockRank(table: LockableTable): number {
  return GLOBAL_LOCK_ORDER.indexOf(table)
}

/**
 * Mengurutkan sekumpulan tabel sesuai `GLOBAL_LOCK_ORDER` (deduplikasi),
 * agar pemanggil selalu mengunci dalam urutan global yang konsisten.
 */
export function orderLocks(tables: readonly LockableTable[]): LockableTable[] {
  return [...new Set(tables)].sort((a, b) => lockRank(a) - lockRank(b))
}
