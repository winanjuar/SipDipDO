/**
 * IDENTITY — siklus hidup owner/pendaftaran (AD-11), role & matriks keterbukaan
 * (AD-8), OTP MFA (AD-8), pergantian COO (FR-17).
 *
 * Cron harian pendaftaran (dipanggil server/jobs/daily.post.ts, Story 1.5):
 * - Pengingat H-3 (kalender Asia/Jakarta, FR-22): email ditulis sebagai baris
 *   outbox proofs DI DALAM transaksi job (AR-6); idempoten per hari — cek
 *   baris outbox (kind + penerima + payload.hari) sebelum insert.
 * - Kedaluwarsa hari ke-7: CAS `diajukan -> kedaluwarsa` + entry audit
 *   `pendaftaran-kedaluwarsa` (aktor system) in-tx, hanya bila baris
 *   ter-update; race vs simpan profil/verifikasi COO dijaga CAS yang sama
 *   (AD-11).
 * - Pendaftar yang Profilnya lengkap atau statusnya bukan `diajukan` → tanpa
 *   aksi (idempoten).
 *
 * Pendaftaran mandiri (Story 1.4, FR-22): `ajukanPendaftaran` membuka SATU
 * transaksi — INSERT-CAS idempotent per email + entry audit
 * `pendaftaran-diajukan` ditulis DALAM transaksi yang sama (AD-3), hanya saat
 * baris baru dibuat; cabang re-daftar Story 1.5: baris existing `kedaluwarsa`
 * di-CAS ke `diajukan` pada baris yang sama (+ audit `reDaftar: true`), status
 * lain dikembalikan tanpa mutasi.
 *
 * Simpan Profil (Story 1.5, CAP-1): `simpanProfil` membuka SATU transaksi —
 * UPDATE kolom profil + audit `profil-kelengkapan` (bila ada nilai berubah).
 * Email pendaftar ditentukan pemanggil dari sesi Google.
 */
import { addCalendarDays, isDayOnOrBefore, jakartaDayKey, type DayKey } from '#shared/domain/calendar'
import { profilLengkap, type ProfilValues } from '#shared/domain/profil'
import { writeAuditEntry } from '../audit/index'
import { adaOutboxEmail, enqueueEmail, OUTBOX_KIND_NOTIFIKASI } from '../proofs/index'
import type { Db } from '../../utils/db'
import type { HasilDaftarOwner, OwnerRecord } from './owner.repo'
import {
  aktifkanKembaliCalon,
  daftarOwnerByEmail,
  findOwnerByEmail,
  kedaluwarsakanCalon,
  listCalonDiajukan,
  simpanProfilCalon,
} from './owner.repo'

/** Batas kalender pendaftaran (FR-22): hari ke-7 sejak submit, zona Asia/Jakarta. */
export const REGISTRATION_EXPIRY_DAYS = 7

/** Pengingat dikirim H-3 sebelum hari kedaluwarsa. */
export const REGISTRATION_REMINDER_DAYS_BEFORE = 3

export interface RegistrationDeadline {
  submittedOn: DayKey
  reminderOn: DayKey
  expiresOn: DayKey
}

/**
 * Batas kalender pendaftaran dari hari submit (Asia/Jakarta) — murni, diuji di
 * shared/domain/calendar.test.ts. Dipakai cron harian dan pengecekan in-app.
 */
export function registrationDeadline(submittedOn: DayKey): RegistrationDeadline {
  const expiresOn = addCalendarDays(submittedOn, REGISTRATION_EXPIRY_DAYS)
  return {
    submittedOn,
    expiresOn,
    reminderOn: addCalendarDays(expiresOn, -REGISTRATION_REMINDER_DAYS_BEFORE),
  }
}

/** Kontrak balikan job harian pendaftaran — counter + daftar email terdampak
 *  (paritas wire `cron-harian.api.spec.ts`). */
export interface HasilJobHarianPendaftaran {
  reminded: number
  expired: number
  remindedEmails: string[]
  expiredEmails: string[]
}

/** Jenis pengingat pada payload outbox — membedakan dari notifikasi lain. */
const JENIS_PENGINGAT_PROFIL = 'pengingat-kelengkapan-profil'

/**
 * Job harian pendaftaran (Story 1.5, CAP-4) — SATU transaksi berisi seleksi
 * kandidat `diajukan`, pengingat outbox, dan CAS kedaluwarsa + audit (AD-3/
 * AD-11/AR-6). `today` disuntikkan endpoint (AD-9: batas hari dihitung di
 * dalam, bukan jam trigger); `submittedOn` diturunkan dari `createdAt` baris
 * (hari kalender Jakarta — tanpa kolom tanggal-submit). Pengingat hanya pada
 * hari `reminderOn` hingga jatuh tempo; idempoten per hari via cek baris
 * outbox. Kedaluwarsa menang atas pengingat bila keduanya relevan.
 */
export async function runRegistrationDailyJob(today: DayKey, db: Db): Promise<HasilJobHarianPendaftaran> {
  return db.transaction(async (tx) => {
    const calon = await listCalonDiajukan(tx)
    const remindedEmails: string[] = []
    const expiredEmails: string[] = []

    for (const baris of calon) {
      if (baris.status !== 'diajukan' || profilLengkap(baris)) continue

      const deadline = registrationDeadline(jakartaDayKey(new Date(baris.createdAt)))

      if (isDayOnOrBefore(deadline.expiresOn, today)) {
        // CAS — nol baris berarti kalah race (verifikasi COO/simpan profil
        // lebih dulu); audit hanya bila baris benar-benar ter-update (AD-3).
        const kedaluwarsa = await kedaluwarsakanCalon(tx, baris.id)
        if (kedaluwarsa) {
          await writeAuditEntry(tx, {
            actor: { kind: 'system' },
            action: 'pendaftaran-kedaluwarsa',
            target: `owners:${baris.id}`,
            details: { email: baris.email, expiresOn: deadline.expiresOn },
          })
          expiredEmails.push(baris.email)
        }
        continue
      }

      if (isDayOnOrBefore(deadline.reminderOn, today)) {
        // Idempoten per hari: baris outbox (kind + penerima + payload.hari)
        // dicek DI DALAM transaksi sebelum insert — dua run di hari sama
        // menghasilkan satu baris (AR-6).
        const sudahDiingatkan = await adaOutboxEmail(tx, {
          kind: OUTBOX_KIND_NOTIFIKASI,
          to: baris.email,
          hari: today,
        })
        if (sudahDiingatkan) continue
        await enqueueEmail(tx, {
          kind: OUTBOX_KIND_NOTIFIKASI,
          to: baris.email,
          payload: { hari: today, jenis: JENIS_PENGINGAT_PROFIL, expiresOn: deadline.expiresOn },
        })
        remindedEmails.push(baris.email)
      }
      // reminderOn > today → sebelum jendela H-3: tanpa email, tanpa mutasi.
    }

    return {
      reminded: remindedEmails.length,
      expired: expiredEmails.length,
      remindedEmails,
      expiredEmails,
    }
  })
}

/**
 * Ajukan pendaftaran owner mandiri (Story 1.4, FR-22; re-daftar Story 1.5,
 * CAP-5): SATU transaksi berisi INSERT-CAS idempotent per email
 * (`daftarOwnerByEmail`) + entry audit `pendaftaran-diajukan` (aktor user =
 * owner, target `owners:<id>`, details memuat email pendaftar) — audit
 * ditulis HANYA bila baris baru dibuat. Cabang re-daftar: baris existing
 * `kedaluwarsa` di-CAS ke `diajukan` pada baris yang SAMA (id tetap) + audit
 * `details.reDaftar: true`; POST ulang beruntun (kini `diajukan`) dan status
 * lain dikembalikan tanpa mutasi dan tanpa audit baru (matriks I/O spec 1.4).
 * Email datang dari sesi Google (keputusan di handler), bukan dari body.
 */
export async function ajukanPendaftaran(input: { email: string }, db: Db): Promise<HasilDaftarOwner> {
  return db.transaction(async (tx) => {
    const hasil = await daftarOwnerByEmail(tx, { email: input.email })
    if (hasil.baru) {
      await writeAuditEntry(tx, {
        actor: { kind: 'user', ownerId: hasil.rekaman.id },
        action: 'pendaftaran-diajukan',
        target: `owners:${hasil.rekaman.id}`,
        details: { email: input.email },
      })
      return hasil
    }
    if (hasil.rekaman.status !== 'kedaluwarsa') return hasil

    // Re-daftar (Story 1.5): CAS `kedaluwarsa -> diajukan` baris sama —
    // nol baris = kalah race (status sudah berubah lagi) → echo apa adanya.
    const aktif = await aktifkanKembaliCalon(tx, hasil.rekaman.id)
    if (!aktif) return hasil
    await writeAuditEntry(tx, {
      actor: { kind: 'user', ownerId: aktif.id },
      action: 'pendaftaran-diajukan',
      target: `owners:${aktif.id}`,
      details: { email: input.email, reDaftar: true },
    })
    return { rekaman: aktif, baru: false }
  })
}

/**
 * Simpan Profil calon (Story 1.5, CAP-1, FR-22): SATU transaksi berisi UPDATE
 * kolom profil (`simpanProfilCalon`) + entry audit `profil-kelengkapan`
 * (aktor user, in-tx AD-3) — audit hanya bila ada nilai yang berubah (PUT
 * dengan isian identik tidak menambah entry). Handler wajib menjamin status
 * calon `diajukan` dan kelengkapan 10 field SEBELUM memanggil (400/403).
 */
export async function simpanProfil(input: { email: string, nilai: ProfilValues }, db: Db): Promise<OwnerRecord> {
  return db.transaction(async (tx) => {
    const sebelum = await findOwnerByEmail(tx, input.email)
    if (!sebelum) {
      throw new Error('simpanProfil: baris owner tidak ditemukan untuk email sesi.')
    }
    const berubah = Object.entries(input.nilai).some(
      ([kunci, nilai]) => sebelum[kunci as keyof OwnerRecord] !== nilai,
    )
    const sesudah = await simpanProfilCalon(tx, input.email, input.nilai)
    if (berubah) {
      await writeAuditEntry(tx, {
        actor: { kind: 'user', ownerId: sesudah.id },
        action: 'profil-kelengkapan',
        target: `owners:${sesudah.id}`,
        details: { email: input.email, profileComplete: profilLengkap(sesudah) },
      })
    }
    return sesudah
  })
}
