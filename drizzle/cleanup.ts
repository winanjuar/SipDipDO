/**
 * Cleanup dev tabel `owners` — sisakan hanya email hardcode yang disepakati.
 *
 * Kebijakan: baris nyata tidak pernah masuk repo/DB dev — yang dihapus di sini
 * adalah baris sintetis (seed `uji.snddash.*` / mint E2E `uji.snddash.e2e.*`)
 * maupun baris uji manual lain. Meniru guard `drizzle/seed.ts`: tolak
 * NODE_ENV=production; host non-lokal butuh --paksa.
 *
 * Urutan hapus FK-safe: audit_logs -> coo_tenures -> outbox_emails -> owners.
 * audit_logs mencakup actor/target/details yatim; outbox_emails dicocokkan
 * via to_address (tanpa FK) bila ada.
 *
 * Jalankan:
 *   npm run db:cleanup            # sisakan 2 email default
 *   npm run db:cleanup -- --paksa  # izinkan host non-lokal
 */

import postgres from 'postgres'

const EMAIL_DIPERTAHANKAN: readonly string[] = ['winanjuar@gmail.com', 'yuckimoera@gmail.com']

const URL_DB_DEFAULT = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FLAG_PAKSA = '--paksa'
const HOST_LOKAL: readonly string[] = ['localhost', '127.0.0.1', '[::1]']

function hostLokal(urlDb: string): boolean {
  return HOST_LOKAL.includes(new URL(urlDb).hostname)
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cleanup menolak jalan di NODE_ENV=production.')
  }
  const urlDb = process.env.DATABASE_URL ?? URL_DB_DEFAULT
  if (!hostLokal(urlDb) && !process.argv.includes(FLAG_PAKSA)) {
    throw new Error(`Host DB '${new URL(urlDb).hostname}' non-lokal — butuh flag ${FLAG_PAKSA} bila memang disengaja.`)
  }

  const keepLower = EMAIL_DIPERTAHANKAN.map((e) => e.toLowerCase())
  const sql = postgres(urlDb, { max: 1, prepare: false })
  try {
    const sebelumOwners = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM owners`
    const sebelumAudit = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM audit_logs`
    const sebelumTenures = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM coo_tenures`
    const sebelumOutbox = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM outbox_emails`

    console.log(`Sebelum: owners=${sebelumOwners[0].count} audit_logs=${sebelumAudit[0].count} coo_tenures=${sebelumTenures[0].count} outbox_emails=${sebelumOutbox[0].count}`)
    console.log(`Mempertahankan: ${EMAIL_DIPERTAHANKAN.join(', ')}`)

    const ownersHapus = await sql<{ email: string }[]>`
      SELECT email FROM owners WHERE lower(email) <> ALL(${keepLower})
    `
    if (ownersHapus.length > 0) {
      console.log(`Akan menghapus ${ownersHapus.length} baris owners:`)
      for (const r of ownersHapus) console.log(`  - ${r.email}`)
    } else {
      console.log('Tidak ada baris owners yang perlu dihapus.')
    }

    // Hapus anak-anak owners terlebih dulu
    const hapusAudit = await sql`
      DELETE FROM audit_logs
      WHERE actor_owner_id IN (SELECT id FROM owners WHERE lower(email) <> ALL(${keepLower}))
         OR target IN (SELECT 'owners:' || id::text FROM owners WHERE lower(email) <> ALL(${keepLower}))
         OR lower(details->>'email') <> ALL(${keepLower}) AND details ? 'email'
         OR action = 'pendaftaran-kedaluwarsa' AND NOT (lower(details->>'email') = ANY(${keepLower}))
    `
    const hapusTenures = await sql`
      DELETE FROM coo_tenures WHERE owner_id IN (SELECT id FROM owners WHERE lower(email) <> ALL(${keepLower}))
    `
    const hapusOutbox = await sql`
      DELETE FROM outbox_emails WHERE lower(to_address) <> ALL(${keepLower})
    `
    const hapusOwners = await sql`
      DELETE FROM owners WHERE lower(email) <> ALL(${keepLower})
    `

    console.log(`Terhapus: audit_logs=${hapusAudit.count} coo_tenures=${hapusTenures.count} outbox_emails=${hapusOutbox.count} owners=${hapusOwners.count}`)

    const sisa = await sql<{ email: string; status: string }[]>`SELECT email, status FROM owners ORDER BY email`
    console.log('Sisa owners:')
    for (const r of sisa) console.log(`  - ${r.email} (${r.status})`)
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
