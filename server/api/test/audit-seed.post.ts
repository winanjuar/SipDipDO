import { defineEventHandler, getHeader, readBody } from 'h3'
import { writeAuditEntry } from '../../domain/audit'
import { upsertOwnerByEmail } from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { tripleGuardLolos } from './login.post'

/**
 * POST /api/test/audit-seed — seed entry audit untuk uji E2E/API, DEV-ONLY
 * triple-guard (pola `server/api/test/login.post.ts` — predikat guard
 * dipakai ulang dari sana, satu sumber kebenaran): NODE_ENV ≠ production +
 * ENABLE_TEST_AUTH aktif + header TEST_AUTH_SECRET cocok. Di produksi
 * endpoint ini mati total.
 *
 * Kontrak body: `{ jumlah: <n> }`. Entry ditulis lewat API PUBLIK modul
 * audit (`writeAuditEntry`) dalam SATU transaksi (AD-3) — endpoint ini tidak
 * pernah menyentuh tabel `audit_logs` di luar pintu modul (AD-5) dan tidak
 * menulis tabel tetangga (owner sintetis hanya via API publik identity).
 * Aktor user memakai owner sintetis khusus seed; detail ditulis panjang agar
 * tampilan halaman memotong JSON (kontrak elipsis testid audit-trail).
 * Pembersihan baris seed menyusul kontrak Story 1.4 (tabel append-only,
 * tanpa jalur delete).
 */

/** Email owner sintetis khusus seed audit — cocok pola `emailUjiSah` mint. */
const EMAIL_AKTOR_SEED = 'uji.snddash.e2e.audit-seed@gmail.com'

/** Batas jumlah entry per pemanggilan seed (dev-only anti kebablasan). */
const MAKS_JUMLAH_SEED = 200
/** Jumlah entry bila body tanpa `jumlah`. */
const JUMLAH_DEFAULT_SEED = 1
/** Entry bernomor ganjil ditulis sebagai aktor system (selang-seling user/system). */
const PARITAS_SISTEM = 2

/** Catatan panjang pada details — menjamin JSON terpotong di tampilan (elipsis). */
const CATATAN_SEED = 'Entry uji E2E sepenuhnya sintetis; audit_logs append-only sehingga baris seed tersisa di DB dev dan pembersihan menyusul kontrak Story 1.4.'

export default defineEventHandler(async (event) => {
  const env = process.env
  if (!tripleGuardLolos({
    nodeEnv: env.NODE_ENV,
    enableFlag: env.ENABLE_TEST_AUTH,
    presentedSecret: getHeader(event, 'test_auth_secret') ?? '',
    registeredSecret: env.TEST_AUTH_SECRET ?? '',
  })) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'TEST_AUTH_DISABLED',
      message: 'Endpoint seed audit hanya untuk pengujian (triple guard tidak terpenuhi).',
      details: {},
    })
  }

  const body = (await readBody<{ jumlah?: unknown }>(event).catch(() => undefined)) ?? {}
  const jumlah = typeof body.jumlah === 'number' ? body.jumlah : JUMLAH_DEFAULT_SEED
  if (!Number.isInteger(jumlah) || jumlah < 0 || jumlah > MAKS_JUMLAH_SEED) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: `jumlah harus bilangan bulat 0..${MAKS_JUMLAH_SEED}.`,
      details: { jumlah: body.jumlah ?? null },
    })
  }

  const db = useDb()

  // Aktor user entry seed — owner sintetis via API publik identity (idempoten).
  const aktor = await upsertOwnerByEmail(db, {
    email: EMAIL_AKTOR_SEED,
    status: 'terverifikasi',
    rejectionReason: null,
    firstEffectiveAt: null,
  })

  // SATU transaksi (AD-3): seluruh entry seed commit atau rollback bersama.
  await db.transaction(async (tx) => {
    for (let i = 0; i < jumlah; i += 1) {
      const sistem = i % PARITAS_SISTEM === 1
      await writeAuditEntry(tx, {
        actor: sistem ? { kind: 'system' } : { kind: 'user', ownerId: aktor.id },
        action: sistem ? 'pendaftaran-kedaluwarsa' : 'pendaftaran-diajukan',
        target: `owners:${aktor.id}`,
        details: { sumber: 'uji-e2e', iterasi: i, catatan: CATATAN_SEED },
      })
    }
  })

  return { jumlah }
})
