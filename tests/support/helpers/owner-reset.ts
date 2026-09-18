/**
 * Reset baris uji `owners` (beserta jejak FK-nya) untuk kebersihan DB dev
 * pasca-test — DEV-ONLY, pola `audit-reset.ts`.
 *
 * Latar (laporan owner 2026-09-18): seluruh test yang mint sesi via
 * `/api/test/login` menyemai baris `owners` sintetis (`uji.snddash.e2e.*`)
 * tetapi tidak pernah mendaftarkannya ke fixture cleanup — baris menumpuk
 * lintas run (owners=512). Helper ini menghapus PERSIS email yang terdaftar
 * di registry mint (target eksak → aman terhadap worker paralel), dalam
 * urutan FK-safe yang sama dengan `drizzle/cleanup.ts`:
 * audit_logs -> coo_tenures -> outbox_emails -> owners.
 *
 * Guard host lokal (pola audit-reset.ts/seed.ts): koneksi di luar host lokal
 * TIDAK melempar — reset bersifat pemeliharaan best-effort; suite tetap jalan
 * (peringatan via log) supaya CI terhadap DB jauh tidak gagal karena hygiene.
 * Kredensial nyata tidak pernah menyentuh file ini (URL dari env).
 */
import postgres from 'postgres'

/** URL DB admin default — Supabase CLI lokal (sinkron audit-reset.ts). */
const URL_DB_ADMIN_DEFAULT = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** Host yang dianggap lokal — di luar ini reset dilewati dengan peringatan. */
const HOST_LOKAL: readonly string[] = ['localhost', '127.0.0.1', '[::1]']

/** Batas koneksi pool helper — semua query satu koneksi. */
const UKURAN_POOL_SATU = 1

/** Batas waktu grace penutupan koneksi (sql.end). */
const DETIK_TUTUP_MAKS = 5

/** Prefix email sintetis mint E2E — satu-satunya himpunan yang boleh dihapus
 *  sweep (identik PREFIX_EMAIL_UJI di server/api/test/login.post.ts). */
const PREFIX_EMAIL_SINTETIS = 'uji.snddash.e2e.%'

/**
 * Hapus SEMUA baris uji ber-prefix sintetis (beserta audit/coo_tenures/outbox
 * terkait) — dipakai globalTeardown sebagai jaring terakhir setelah seluruh
 * worker selesai (tidak mungkin menabrak test berjalan). Baris nyata/seed dev
 * (`uji.snddash.*` tanpa `.e2e`) aman — prefix tidak cocok.
 */
export async function hapusSemuaOwnerUjiSintetis(): Promise<void> {
  const url = process.env.DATABASE_URL ?? URL_DB_ADMIN_DEFAULT
  const host = new URL(url).hostname
  if (!HOST_LOKAL.includes(host)) {
    console.warn(
      `[owner-reset] host DB '${host}' bukan lokal — sweep baris uji dilewati (best-effort).`,
    )
    return
  }

  const sql = postgres(url, { max: UKURAN_POOL_SATU })
  try {
    await sql.begin(async (tx) => {
      // Dua jalur referensi audit (AD-3): aktor user (actor_owner_id) dan
      // aktor system (actor_owner_id NULL, target 'owners:<id>' — mis. entry
      // seed audit-seed dan pendaftaran-kedaluwarsa cron).
      await tx`
        DELETE FROM audit_logs
        WHERE actor_owner_id IN (SELECT id FROM owners WHERE email LIKE ${PREFIX_EMAIL_SINTETIS})
          OR target IN (SELECT 'owners:' || id FROM owners WHERE email LIKE ${PREFIX_EMAIL_SINTETIS})
      `
      await tx`
        DELETE FROM coo_tenures
        WHERE owner_id IN (SELECT id FROM owners WHERE email LIKE ${PREFIX_EMAIL_SINTETIS})
      `
      await tx`
        DELETE FROM outbox_emails
        WHERE to_address LIKE ${PREFIX_EMAIL_SINTETIS}
      `
      await tx`
        DELETE FROM owners
        WHERE email LIKE ${PREFIX_EMAIL_SINTETIS}
      `
    })
  } finally {
    await sql.end({ timeout: DETIK_TUTUP_MAKS })
  }
}

/**
 * Hapus baris uji untuk email EKSAK yang diberikan (beserta audit/coo_tenures/
 * outbox terkait). Email kosong → no-op. Tidak pernah menyentuh baris di luar
 * daftar email eksplisit — baris nyata/seed dev aman.
 */
export async function hapusOwnerUji(emails: readonly string[]): Promise<void> {
  if (emails.length === 0) return

  const url = process.env.DATABASE_URL ?? URL_DB_ADMIN_DEFAULT
  const host = new URL(url).hostname
  if (!HOST_LOKAL.includes(host)) {
    // Best-effort: hygiene DB dev bukan prasyarat kebenaran test.
    console.warn(
      `[owner-reset] host DB '${host}' bukan lokal — reset baris uji dilewati (best-effort).`,
    )
    return
  }

  const sql = postgres(url, { max: UKURAN_POOL_SATU })
  try {
    await sql.begin(async (tx) => {
      // Dua jalur referensi audit (AD-3): aktor user (actor_owner_id) dan
      // aktor system (actor_owner_id NULL, target 'owners:<id>' — mis. entry
      // seed audit-seed dan pendaftaran-kedaluwarsa cron).
      await tx`
        DELETE FROM audit_logs
        WHERE actor_owner_id IN (SELECT id FROM owners WHERE email = ANY(${emails}))
          OR target IN (SELECT 'owners:' || id FROM owners WHERE email = ANY(${emails}))
      `
      await tx`
        DELETE FROM coo_tenures
        WHERE owner_id IN (SELECT id FROM owners WHERE email = ANY(${emails}))
      `
      await tx`
        DELETE FROM outbox_emails
        WHERE to_address = ANY(${emails})
      `
      await tx`
        DELETE FROM owners
        WHERE email = ANY(${emails})
      `
    })
  } finally {
    await sql.end({ timeout: DETIK_TUTUP_MAKS })
  }
}
