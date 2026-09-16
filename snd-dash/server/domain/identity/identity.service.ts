// server/domain/identity/identity.service.ts
//
// Orkestrasi siklus hidup & keterbukaan IDENTITY (FR-13/FR-15/FR-22).
//
// Tanggung jawab:
//   - Fungsi keterbukaan murni: `aksesPenuh`, `perluReferral` (dihitung dari
//     status + firstEffectiveAt, BUKAN dari positions.shares live — §4.8/AD-8).
//   - Pilihan referral: `pilihanReferral` (delegasi repo).
//   - Re-validasi kelengkapan Profile in-tx: `requireVerifiedProfile`.
//   - Transisi status compare-and-set (AD-11): submitRegistration,
//     verifyRegistration, rejectRegistration, markFirstPurchaseEffective, markExit.
//
// Setiap transisi menulis entri audit yang sesuai (FR-22 §22.3, FR-12). Penulisan
// audit di-route lewat pintu AUDIT (`../audit`); saat pintu index belum ada,
// helper `writeAudit` memanggil repo audit sehingga tetap in-tx dan mudah di-wire
// ulang ke `AuditModule.write` tanpa mengubah pemanggil.

import type { Tx } from '../../utils/db'
import { withTransaction } from '../../utils/db'
import type { JakartaDate, Uuid } from '../../../shared/domain/types'
import { isExpiredDay7, toJakartaDate } from '../../../shared/domain/calendar'
import * as repo from './identity.repo'
import type { CooTenure, Owner, ReferralChoice } from './events'
import { insert as auditInsert } from '../audit/audit.repo'
import type { AuditAction, AuditEntry } from '../audit/events'

// ---------------------------------------------------------------------------
// Error domain — coded, extensible (mirror `ApiError('CODE', details)` design).
// ---------------------------------------------------------------------------

/** Kode error siklus hidup IDENTITY yang dikenal pemanggil (route/lintas modul). */
export type IdentityErrorCode =
  | 'OWNER_NOT_FOUND'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'ILLEGAL_TRANSITION'
  | 'PROFILE_INCOMPLETE'
  | 'POSITIONS_NOT_ZERO'
  | 'NOT_COO'
  // MFA/OTP (FR-3, FR-20 §20.2, AD-8) — verifikasi & konsumsi OTP.
  | 'OTP_INVALID' // kode salah (masih ada sisa percobaan)
  | 'OTP_EXPIRED' // kode kedaluwarsa / tidak ada kode hidup
  | 'OTP_COOLDOWN' // kirim ulang ditolak (cooldown 60s belum lewat)
  | 'OTP_BLOCKED' // >= 3 percobaan gagal dalam jendela 300s
  | 'MFA_FAILED' // konsumsi single-use kalah balapan / gagal umum

/** Error transisi/validasi siklus hidup dengan kode + detail terstruktur. */
export class IdentityError extends Error {
  constructor(
    readonly code: IdentityErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(code)
    this.name = 'IdentityError'
  }
}

// ---------------------------------------------------------------------------
// Audit door — in-tx write (AD-3). Wire ulang ke AuditModule.write bila tersedia.
// ---------------------------------------------------------------------------

async function writeAudit(
  tx: Tx,
  action: AuditAction,
  actor: Uuid | null,
  target: Uuid | string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  const entry: AuditEntry = {
    actor,
    action,
    target: target ?? null,
    details,
  }
  await auditInsert(tx, entry)
}

// ---------------------------------------------------------------------------
// Lifecycle & access — fungsi kanonik keterbukaan (AD-8/§4.8)
// ---------------------------------------------------------------------------

/**
 * Membaca entitas Owner (status + firstEffectiveAt) untuk keputusan akses.
 * Dipakai lintas modul (orders submit, access guard). Menerima `db` atau `tx`.
 */
export async function getLifecycle(
  reader: Pick<Tx, 'select'>,
  ownerId: Uuid,
): Promise<Owner> {
  const owner = await repo.findById(reader, ownerId)
  if (!owner) throw new IdentityError('OWNER_NOT_FOUND', { ownerId })
  return owner
}

/**
 * Keterbukaan penuh (FR-15 §15.6/§15.8): TRUE hanya bila Owner telah memiliki
 * Pembelian Pertama efektif DAN saat ini bukan berstatus Keluar.
 *
 * Owner tanpa saham ('terverifikasi' sebelum pembelian pertama) maupun 'keluar'
 * TIDAK memperoleh akses penuh — konsisten dengan matriks keterbukaan yang
 * dihitung dari status/lifecycle, bukan dari positions.shares live (AD-8).
 */
export function aksesPenuh(owner: Owner): boolean {
  return owner.firstEffectiveAt !== null && owner.status !== 'keluar'
}

/**
 * Referral wajib s.d. Pembelian Pertama efektif (FR-22 §22.8): TRUE selama Owner
 * belum pernah memiliki pembelian pertama yang efektif.
 */
export function perluReferral(owner: Owner): boolean {
  return owner.firstEffectiveAt === null
}

/**
 * Pilihan referral yang sah (FR-22 §22.8): pemegang saham atau Owner yang belum
 * pernah membeli. Delegasi ke repo (query positions + owners) in-tx.
 */
export function pilihanReferral(tx: Tx): Promise<ReferralChoice[]> {
  return repo.listReferralChoices(tx)
}

/**
 * Re-validasi kelengkapan Profile DI DALAM transaksi (FR-22 §22.4).
 *
 * Dipakai jalur verifikasi & finalisasi agar keputusan memakai kondisi terkini
 * (bukan snapshot lama). Melempar `PROFILE_INCOMPLETE` bila belum lengkap.
 */
export async function requireVerifiedProfile(
  tx: Tx,
  ownerId: Uuid,
): Promise<void> {
  const complete = await repo.isProfileComplete(tx, ownerId)
  if (!complete) throw new IdentityError('PROFILE_INCOMPLETE', { ownerId })
}

// ---------------------------------------------------------------------------
// Status transitions — compare-and-set atas status prior (AD-11)
// ---------------------------------------------------------------------------

/**
 * Pendaftaran mandiri (FR-22 §22.1/§22.2): membuat Owner baru berstatus
 * 'diajukan' (unik per email, AD-7). Bila email sudah terdaftar dan berstatus
 * 'kedaluwarsa', pendaftaran ulang dilakukan via CAS kedaluwarsa→diajukan
 * (reset alasan penolakan). Email dengan status hidup lain ditolak.
 */
export function submitRegistration(googleEmail: string): Promise<Owner> {
  return withTransaction(async (tx) => {
    const existing = await repo.findByEmail(tx, googleEmail)

    if (existing) {
      if (existing.status === 'kedaluwarsa') {
        // Re-daftar: CAS kedaluwarsa → diajukan (AD-11), bersihkan alasan lama.
        const affected = await repo.casStatus(
          tx,
          existing.id,
          'kedaluwarsa',
          'diajukan',
          { rejectionReason: null },
        )
        if (affected === 0) {
          throw new IdentityError('ILLEGAL_TRANSITION', {
            ownerId: existing.id,
            from: existing.status,
            to: 'diajukan',
          })
        }
        await writeAudit(tx, 'registration_verified', null, existing.id, {
          reregistered: true,
        })
        const refreshed = await repo.findById(tx, existing.id)
        return refreshed!
      }
      // Email dengan status hidup lain (diajukan/terverifikasi/ditolak/keluar).
      throw new IdentityError('EMAIL_ALREADY_REGISTERED', {
        email: googleEmail,
        status: existing.status,
      })
    }

    const owner = await repo.insertOwner(tx, { email: googleEmail })
    await repo.insertEmptyProfile(tx, owner.id)
    return owner
  })
}

/**
 * Verifikasi pendaftaran oleh COO (FR-22 §22.2/§22.3/§22.4): CAS
 * 'diajukan' → 'terverifikasi'. Prasyarat: Profile lengkap (re-validasi in-tx).
 * Mencatat aktor, waktu (implisit createdAt), dan jenis aksi pada audit.
 */
export async function verifyRegistration(
  tx: Tx,
  ownerId: Uuid,
  cooId: Uuid,
): Promise<void> {
  // FR-22 §22.4 — verifikasi tak tersedia bila Profile belum lengkap.
  await requireVerifiedProfile(tx, ownerId)
  const affected = await repo.casStatus(tx, ownerId, 'diajukan', 'terverifikasi')
  if (affected === 0) {
    throw new IdentityError('ILLEGAL_TRANSITION', {
      ownerId,
      from: 'diajukan',
      to: 'terverifikasi',
    })
  }
  await writeAudit(tx, 'registration_verified', cooId, ownerId, {})
}

/**
 * Penolakan pendaftaran oleh COO (FR-22 §22.2/§22.3): CAS
 * 'diajukan' → 'ditolak' dengan alasan. Mencatat aktor, waktu, dan alasan.
 */
export async function rejectRegistration(
  tx: Tx,
  ownerId: Uuid,
  cooId: Uuid,
  reason: string,
): Promise<void> {
  const affected = await repo.casStatus(tx, ownerId, 'diajukan', 'ditolak', {
    rejectionReason: reason,
  })
  if (affected === 0) {
    throw new IdentityError('ILLEGAL_TRANSITION', {
      ownerId,
      from: 'diajukan',
      to: 'ditolak',
    })
  }
  await writeAudit(tx, 'registration_rejected', cooId, ownerId, { reason })
}

/**
 * Menandai Pembelian Pertama efektif (FR-15 §15.8 / FR-22 §22.10): set
 * `first_effective_at` idempoten (hanya bila masih NULL) DI DALAM transaksi
 * finalisasi. Membuka keterbukaan penuh secara otomatis via `aksesPenuh`.
 *
 * Bila Owner sebelumnya 'keluar', pembelian efektif baru mengaktifkannya kembali
 * dengan transparansi penuh (FR-13 §13.7): CAS keluar → terverifikasi.
 */
export async function markFirstPurchaseEffective(
  tx: Tx,
  ownerId: Uuid,
  at: Date,
): Promise<void> {
  const owner = await repo.findById(tx, ownerId)
  if (!owner) throw new IdentityError('OWNER_NOT_FOUND', { ownerId })

  const firstTime = await repo.setFirstEffectiveAt(tx, ownerId, at)

  // Reaktivasi Owner Keluar yang membeli lagi (FR-13 §13.7).
  if (owner.status === 'keluar') {
    await repo.casStatus(tx, ownerId, 'keluar', 'terverifikasi')
    await writeAudit(tx, 'owner_reactivated', null, ownerId, { at: at.toISOString() })
  }

  if (firstTime === 1) {
    // Stempel Pembelian Pertama baru diset — event lifecycle (dikonsumsi lintas modul).
    await writeAudit(tx, 'base_data_change', null, ownerId, {
      event: 'FirstPurchaseEffective',
      at: at.toISOString(),
    })
  }
}

/**
 * Menandai Owner Keluar (FR-13 §13.6 / FR-16 §16.8): CAS status → 'keluar'
 * SETELAH re-validasi posisi shares = 0 in-tx (Owner tanpa saham). Menolak bila
 * masih memegang shares. Transisi sah dari 'terverifikasi' (tanpa saham) —
 * pemegang saham aktif tidak dapat langsung ditandai Keluar.
 */
export async function markExit(tx: Tx, ownerId: Uuid): Promise<void> {
  const owner = await repo.findById(tx, ownerId)
  if (!owner) throw new IdentityError('OWNER_NOT_FOUND', { ownerId })

  // Re-validasi shares = 0 in-tx (proyeksi positions, AD-4).
  const shares = await repo.sumShares(tx, ownerId)
  if (shares !== 0) {
    throw new IdentityError('POSITIONS_NOT_ZERO', { ownerId, shares })
  }

  const affected = await repo.casStatus(tx, ownerId, 'terverifikasi', 'keluar')
  if (affected === 0) {
    throw new IdentityError('ILLEGAL_TRANSITION', {
      ownerId,
      from: owner.status,
      to: 'keluar',
    })
  }
  await writeAudit(tx, 'owner_exited', null, ownerId, {})
}

// ---------------------------------------------------------------------------
// Siklus hidup pendaftar (FR-22 §22.5/§22.6) — pengingat H-3 + kedaluwarsa hari-7
// ---------------------------------------------------------------------------

/**
 * Hasil satu pemrosesan siklus hidup pendaftar oleh cron (FR-22 §22.5/§22.6).
 * `reminders` = pendaftar yang BARU dikirimi pengingat H-3 (idempoten, tepat
 * satu email). `expired` = pendaftar yang di-kedaluwarsa-kan (CAS
 * 'diajukan' → 'kedaluwarsa'). Pemanggil (job) meng-enqueue email untuk tiap
 * entri `reminders` via hook proofs — DI DALAM transaksi cron yang sama (AD-5).
 */
export interface RegistrationLifecycleResult {
  reminders: Array<{ ownerId: Uuid; email: string; name: string | null }>
  expired: Uuid[]
}

/**
 * Memproses siklus hidup pendaftar Profile-tak-lengkap DI DALAM transaksi cron
 * `tx` (FR-22 §22.5/§22.6), invarian terhadap jam pemicu (UTC) — batas hari
 * dihitung atas selisih hari kalender Asia/Jakarta lewat `jakartaToday`
 * (dihitung pemanggil dari `toJakartaDate(new Date())`, AD-9).
 *
 * Untuk tiap Owner berstatus 'diajukan' yang Profile-nya belum lengkap, dengan
 * tanggal pengajuan `submitDate = toJakartaDate(owner.created_at)`:
 *   - hari-7 tercapai (`isExpiredDay7(submitDate, jakartaToday)`) → CAS
 *     'diajukan' → 'kedaluwarsa' (guard status prior, AD-11) + audit
 *     'registration_rejected' (aktor 'system', reason 'expired_incomplete').
 *   - else hari-3 tercapai (selisih ≥ 3) DAN pengingat belum pernah dikirim →
 *     `markReminderSent` (CAS NULL → now) dan catat pada `reminders` agar job
 *     meng-enqueue tepat satu email pengingat (§22.5). Idempotensi dijaga oleh
 *     kolom `reminder_sent_at` (jalankan cron berkali-kali → satu email).
 *
 * Kedaluwarsa diprioritaskan atas pengingat: pendaftar yang sudah melewati
 * hari-7 langsung di-kedaluwarsa-kan tanpa pengingat tambahan.
 *
 * Mengembalikan daftar pengingat baru + id yang di-kedaluwarsa-kan.
 */
export async function expireRegistrations(
  tx: Tx,
  jakartaToday: JakartaDate,
): Promise<RegistrationLifecycleResult> {
  const registrants = await repo.listIncompleteRegistrants(tx)
  const now = new Date()

  const result: RegistrationLifecycleResult = { reminders: [], expired: [] }

  for (const r of registrants) {
    const submitDate = toJakartaDate(r.submittedAt)

    // Kedaluwarsa hari-7 (FR-22 §22.6) — prioritas atas pengingat.
    if (isExpiredDay7(submitDate, jakartaToday)) {
      const affected = await repo.casStatus(
        tx,
        r.ownerId,
        'diajukan',
        'kedaluwarsa',
      )
      if (affected === 0) continue // kalah race (verifikasi/tolak bersamaan).
      await writeAudit(tx, 'registration_rejected', null, r.ownerId, {
        event: 'RegistrationExpired',
        reason: 'expired_incomplete',
        submittedAt: submitDate,
        jakartaToday,
      })
      result.expired.push(r.ownerId)
      continue
    }

    // Pengingat H-3 (FR-22 §22.5) — kirim tepat satu (idempoten via CAS).
    if (dayDiff(submitDate, jakartaToday) >= REMINDER_DAY_THRESHOLD) {
      if (r.reminderSentAt !== null) continue // sudah pernah dikirim.
      const marked = await repo.markReminderSent(tx, r.ownerId, now)
      if (marked === 0) continue // kalah race — pengingat lain sudah menandai.
      result.reminders.push({
        ownerId: r.ownerId,
        email: r.email,
        name: r.name,
      })
    }
  }

  return result
}

/** Ambang pengingat H-3 (FR-22 §22.5): hari kalender ke-3 sejak pengajuan. */
const REMINDER_DAY_THRESHOLD = 3

/**
 * Selisih HARI KALENDER Asia/Jakarta (b − a) atas dua `JakartaDate` ('YYYY-MM-DD').
 * Konsisten dengan `calendar.isExpiredDay7` (tengah hari UTC, tanpa DST) sehingga
 * ambang H-3 memakai definisi hari yang sama dengan kedaluwarsa hari-7 (AD-9).
 */
function dayDiff(a: JakartaDate, b: JakartaDate): number {
  const toEpochDay = (d: JakartaDate): number => {
    const [y, m, day] = d.split('-').map(Number) as [number, number, number]
    return Math.floor(Date.UTC(y, m - 1, day) / 86_400_000)
  }
  return toEpochDay(b) - toEpochDay(a)
}

// ---------------------------------------------------------------------------
// COO authority — otoritas & pergantian mandat COO (FR-15 §15.2, FR-17, AD-8)
// ---------------------------------------------------------------------------

/**
 * Memastikan `userId` adalah COO yang BERTUGAS pada waktu `at` (FR-15 §15.2).
 *
 * Otoritas COO dicek DI DALAM transaksi finalisasi (AD-8) — bukan sekadar sesi —
 * dengan memeriksa `coo_tenures` yang aktif pada `at` (startedAt <= at AND
 * (endedAt IS NULL OR endedAt > at)). Mengembalikan `CooTenure` agar jalur
 * finalisasi dapat mencatat transaksi di bawah COO yang bertugas (FR-17 §17.3).
 * Melempar `NOT_COO` bila pengguna tidak sedang memegang mandat pada saat itu.
 *
 * Menerima `db` bound-schema maupun handle `tx` (dipakai baik in-tx finalisasi
 * maupun guard akses read-only, lih. design.md A.5 requireAccess).
 */
export async function assertCooAt(
  reader: Pick<Tx, 'select'>,
  userId: Uuid,
  at: Date,
): Promise<CooTenure> {
  const tenure = await repo.findActiveTenure(reader, userId, at)
  if (!tenure) {
    throw new IdentityError('NOT_COO', { userId, at: at.toISOString() })
  }
  return tenure
}

/**
 * Pergantian mandat COO (FR-17): mengalihkan peran COO dari `fromCoo` ke
 * `toOwner` dengan referensi MoM, DI DALAM transaksi pemanggil.
 *
 * Langkah (semua in-tx, atomik):
 *   1. Validasi `fromCoo` benar-benar COO yang bertugas saat ini (FR-17 §17.3).
 *   2. Akhiri tenure aktif `fromCoo` (endedAt = now).
 *   3. Buka tenure baru untuk `toOwner` (startedAt = now, momRef).
 *   4. Kembalikan `fromCoo` menjadi Owner biasa & cabut akses transaksional:
 *      hapus peran 'coo', pastikan peran 'owner' (FR-17 §17.2).
 *   5. Berikan peran 'coo' + 'owner' kepada `toOwner`.
 *   6. Tulis audit 'coo_transfer' dengan referensi MoM (FR-17 §17.1).
 */
export async function transferCoo(
  tx: Tx,
  fromCoo: Uuid,
  toOwner: Uuid,
  momRef: Uuid,
): Promise<void> {
  const now = new Date()

  // FR-17 §17.3 — hanya COO yang bertugas yang dapat menyerahkan mandat.
  await assertCooAt(tx, fromCoo, now)

  // Akhiri tenure lama & buka tenure baru (rentang waktu berdampingan).
  await repo.endActiveTenures(tx, fromCoo, now)
  const tenure = await repo.openTenure(tx, toOwner, now, momRef)

  // FR-17 §17.2 — COO lama kembali menjadi Owner biasa, akses transaksional dicabut.
  await repo.removeRole(tx, fromCoo, 'coo')
  await repo.addRole(tx, fromCoo, 'owner')

  // COO baru memperoleh mandat (peran 'coo') sekaligus tetap Owner.
  await repo.addRole(tx, toOwner, 'coo')
  await repo.addRole(tx, toOwner, 'owner')

  // FR-17 §17.1 — keputusan pergantian tercatat dengan referensi MoM.
  await writeAudit(tx, 'coo_transfer', fromCoo, toOwner, {
    momRef,
    tenureId: tenure.id,
    at: now.toISOString(),
  })
}
