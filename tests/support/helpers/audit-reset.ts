/**
 * Reset tabel `audit_logs` untuk prekondisi test stateful — DEV-ONLY.
 *
 * Latar (keputusan step-03 Story 1.3): tabel audit append-only by design
 * (jalur UPDATE/DELETE ditutup di repo DAN di grants role `app_runtime`),
 * sehingga test yang menuntut keadaan terukur (empty state, baseline seed,
 * paging berakhir) tidak punya kontrak pembersihan lewat aplikasi sampai
 * Story 1.4. Reset di sini adalah PEMELIHARAAN DB DEV oleh koneksi ADMIN
 * (TRUNCATE) — bukan jalur aplikasi; grants `app_runtime` tetap menutup
 * UPDATE/DELETE/TRUNCATE bagi runtime (uji permission denied tetap valid).
 *
 * `pg_advisory_lock` men serialisasi reset+aksi test lintas project browser
 * dan lintas file spec yang berjalan paralel (fullyParallel, 3 browser):
 * test stateful menggenggam kunci selama tubuh testnya sehingga TRUNCATE
 * test lain tidak mungkin jatuh di antara baseline-read dan final-read.
 *
 * Guard host lokal (pola drizzle/seed.ts): menolak host non-lokal — kredensial
 * nyata tidak pernah menyentuh file ini (URL dari env, bukan repo).
 */
import postgres from 'postgres'

/** URL DB admin default — Supabase CLI lokal (sinkron .env.example). */
const URL_DB_ADMIN_DEFAULT = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** Host yang dianggap lokal — di luar ini helper menolak jalan. */
const HOST_LOKAL: readonly string[] = ['localhost', '127.0.0.1', '[::1]']

/** Kunci advisory session — konstanta bernama arbitrer khusus reset audit. */
const KUNCI_ADVISORY_RESET_AUDIT = 721034

/** Batas koneksi pool helper — semua query satu koneksi agar lock session konsisten. */
const UKURAN_POOL_SATU = 1

/** Batas waktu grace penutupan koneksi (sql.end). Idle timeout SENGAJA
 *  dinonaktifkan (tanpa opsi idle_timeout): koneksi yang menutup saat idle
 *  melepas pg_advisory_lock di tengah tugas() dan membatalkan jaminan
 *  serialisasi — koneksi hidup sampai tutup() dipanggil. */
const DETIK_TUTUP_MAKS = 5

/** Pembersih sumber daya postgres.js. */
interface KoneksiAudit {
  sql: postgres.Sql
  tutup: () => Promise<void>
}

/** Buka koneksi admin satu-koneksi setelah memvalidasi host lokal. */
async function bukaKoneksiAdmin(): Promise<KoneksiAudit> {
  const url = process.env.DATABASE_URL ?? URL_DB_ADMIN_DEFAULT
  const host = new URL(url).hostname
  if (!HOST_LOKAL.includes(host)) {
    throw new Error(
      `audit-reset: host DB '${host}' bukan lokal — reset TRUNCATE hanya untuk DB dev lokal.`,
    )
  }
  const sql = postgres(url, { max: UKURAN_POOL_SATU })
  return { sql, tutup: () => sql.end({ timeout: DETIK_TUTUP_MAKS }) }
}

/**
 * Jalankan `tugas` dengan jaminan tabel `audit_logs` KOSONG di awal:
 * genggam advisory lock (serialisasi lintas worker/project), TRUNCATE via
 * koneksi admin, jalankan tugas, lepas lock di finally. Assertion test
 * TIDAK diubah oleh helper ini — hanya prekondisi yang dideterministikkan.
 */
export async function denganAuditKosong<T>(tugas: () => Promise<T>): Promise<T> {
  const { sql, tutup } = await bukaKoneksiAdmin()
  try {
    await sql`SELECT pg_advisory_lock(${KUNCI_ADVISORY_RESET_AUDIT})`
    try {
      await sql`TRUNCATE TABLE audit_logs`
      return await tugas()
    } finally {
      await sql`SELECT pg_advisory_unlock(${KUNCI_ADVISORY_RESET_AUDIT})`
    }
  } finally {
    await tutup()
  }
}
