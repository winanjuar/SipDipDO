/**
 * Reset calon `diajukan` SINTETIS untuk prekondisi test stateful — DEV-ONLY,
 * pola `audit-reset.ts` + `owner-reset.ts`.
 *
 * Latar (Story 1.6): daftar `/pendaftar` menampilkan SELURUH baris owners
 * berstatus `diajukan` lintas test/worker (DB dev bersama), sehingga test
 * empty-state UI tidak punya prekondisi deterministik tanpa reset. Reset di
 * sini PEMELIHARAAN DB DEV via koneksi ADMIN — bukan jalur aplikasi; hanya
 * baris SINTETIS (`uji.snddash.e2e.%`) berstatus `diajukan` yang dihapus,
 * FK-safe dengan urutan yang sama dengan `owner-reset.ts` (baris seed dev
 * `uji.snddash.*` dan data non-sintetis tidak pernah tersentuh).
 *
 * `pg_advisory_lock` men-serialisasi reset+aksi test lintas project browser
 * (pola audit-reset.ts). CATATAN paralelisme (diterima, P2): test lain yang
 * sedang menggenggam calon sintetisnya sendiri dapat terdampak bila jendela
 * reset jatuh di tengah test-nya — risiko kelas yang sama sudah diterima
 * suite via `denganAuditKosong` (TRUNCATE audit_logs) + retries Playwright.
 *
 * Guard host lokal (pola audit-reset.ts): host non-lokal DITOLAK —
 * kredensial nyata tidak pernah menyentuh file ini (URL dari env).
 */
import postgres from 'postgres'

/** URL DB admin default — Supabase CLI lokal (sinkron audit-reset.ts). */
const URL_DB_ADMIN_DEFAULT = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** Host yang dianggap lokal — di luar ini helper menolak jalan. */
const HOST_LOKAL: readonly string[] = ['localhost', '127.0.0.1', '[::1]']

/** Kunci advisory session — konstanta bernama arbitrer khusus reset pendaftar. */
const KUNCI_ADVISORY_RESET_PENDAFTAR = 721036

/** Batas koneksi pool helper — semua query satu koneksi agar lock konsisten. */
const UKURAN_POOL_SATU = 1

/** Batas waktu grace penutupan koneksi (sql.end). */
const DETIK_TUTUP_MAKS = 5

/** Prefix email sintetis mint E2E — satu-satunya himpunan yang boleh dihapus
 *  (identik PREFIX_EMAIL_UJI di server/api/test/login.post.ts). */
const PREFIX_EMAIL_SINTETIS = 'uji.snddash.e2e.%'

/**
 * Jalankan `tugas` dengan jaminan TIDAK ADA calon `diajukan` sintetis di awal:
 * genggam advisory lock, hapus FK-safe baris `uji.snddash.e2e.%` berstatus
 * `diajukan` (beserta jejak FK-nya), jalankan tugas, lepas lock di finally.
 * Assertion test TIDAK diubah — hanya prekondisi yang dideterministikkan.
 *
 * Mengembalikan `bersih: true` HANYA bila SETELAH reset tidak ada lagi baris
 * `diajukan` APA PUN di DB — baris non-sintetis (data dev nyata) tidak pernah
 * dihapus (kebijakan data), sehingga penelepon dapat melewatkan test bila
 * prekondisi empty-state mustahil dicapai tanpa menyentuh data nyata.
 */
export async function denganPendaftarKosong<T>(tugas: (keadaan: { bersih: boolean }) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL ?? URL_DB_ADMIN_DEFAULT
  const host = new URL(url).hostname
  if (!HOST_LOKAL.includes(host)) {
    throw new Error(
      `pendaftar-reset: host DB '${host}' bukan lokal — reset hanya untuk DB dev lokal.`,
    )
  }

  const sql = postgres(url, { max: UKURAN_POOL_SATU })
  try {
    await sql`SELECT pg_advisory_lock(${KUNCI_ADVISORY_RESET_PENDAFTAR})`
    try {
      await sql.begin(async (tx) => {
        // Urutan FK-safe (pola owner-reset.ts): audit → anak 1:1 → tenure →
        // outbox → owners. HANYA calon sintetis `diajukan`.
        await tx`
          DELETE FROM audit_logs
          WHERE actor_owner_id IN (
            SELECT id FROM owners WHERE email LIKE ${PREFIX_EMAIL_SINTETIS} AND status = 'diajukan'
          )
            OR target IN (
              SELECT 'owners:' || id FROM owners WHERE email LIKE ${PREFIX_EMAIL_SINTETIS} AND status = 'diajukan'
            )
        `
        await tx`
          DELETE FROM owner_bank_accounts
          WHERE owner_id IN (
            SELECT id FROM owners WHERE email LIKE ${PREFIX_EMAIL_SINTETIS} AND status = 'diajukan'
          )
        `
        await tx`
          DELETE FROM owner_emergency_contacts
          WHERE owner_id IN (
            SELECT id FROM owners WHERE email LIKE ${PREFIX_EMAIL_SINTETIS} AND status = 'diajukan'
          )
        `
        await tx`
          DELETE FROM coo_tenures
          WHERE owner_id IN (
            SELECT id FROM owners WHERE email LIKE ${PREFIX_EMAIL_SINTETIS} AND status = 'diajukan'
          )
        `
        await tx`
          DELETE FROM outbox_emails
          WHERE to_address IN (
            SELECT email FROM owners WHERE email LIKE ${PREFIX_EMAIL_SINTETIS} AND status = 'diajukan'
          )
        `
        await tx`
          DELETE FROM owners
          WHERE email LIKE ${PREFIX_EMAIL_SINTETIS} AND status = 'diajukan'
        `
      })
      return await tugas({
        bersih: (await sql`SELECT count(*)::int AS jumlah FROM owners WHERE status = 'diajukan'`)[0]?.jumlah === 0,
      })
    } finally {
      await sql`SELECT pg_advisory_unlock(${KUNCI_ADVISORY_RESET_PENDAFTAR})`
    }
  } finally {
    await sql.end({ timeout: DETIK_TUTUP_MAKS })
  }
}

/** Penghitung email uji constraint — unik antar panggilan dalam satu proses. */
let hitungEmailConstraint = 0

/**
 * Coba INSERT baris sintetis berstatus `ditolak` dengan `rejection_reason`
 * NULL lalu `''` (blank) — Story 1.6: keduanya WAJIB gagal karena CHECK
 * constraint `owners_ditolak_wajib_rejection_reason` (kode 23514), yang
 * tidak pernah tersentuh jalur handler/service (gerbang validasi lebih dulu).
 *
 * Klien postgres mentah (pola admin-client di atas, guard host lokal sama).
 * Tulisan invalid tidak pernah commit (statement tunggal gagal = rollback —
 * tidak perlu cleanup); bila loophole (insert LOLOS), baris langsung dibuang
 * agar DB tetap bersih dan kode `LOLOS` dilaporkan ke pemanggil untuk
 * di-assert gagal.
 */
export async function cobaTulisDitolakTanpaAlasan(): Promise<{ kodeAlasanNull: string, kodeAlasanBlank: string }> {
  const url = process.env.DATABASE_URL ?? URL_DB_ADMIN_DEFAULT
  const host = new URL(url).hostname
  if (!HOST_LOKAL.includes(host)) {
    throw new Error(
      `pendaftar-reset: host DB '${host}' bukan lokal — uji constraint hanya untuk DB dev lokal.`,
    )
  }

  const sql = postgres(url, { max: UKURAN_POOL_SATU })
  try {
    const cobaInsert = async (alasan: string | null): Promise<string> => {
      hitungEmailConstraint += 1
      const email = `uji.snddash.e2e.cek-constraint.${Date.now()}.${hitungEmailConstraint}@gmail.com`
      try {
        await sql`
          INSERT INTO owners (email, referral_code, status, rejection_reason)
          VALUES (${email}, ${`CEK${Date.now()}${hitungEmailConstraint}`}, 'ditolak', ${alasan})
        `
        await sql`DELETE FROM owners WHERE email = ${email}`
        return 'LOLOS'
      } catch (error) {
        return String((error as { code?: unknown }).code ?? 'ERR')
      }
    }
    return { kodeAlasanNull: await cobaInsert(null), kodeAlasanBlank: await cobaInsert('') }
  } finally {
    await sql.end({ timeout: DETIK_TUTUP_MAKS })
  }
}
