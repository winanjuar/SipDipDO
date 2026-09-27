/**
 * IDENTITY — siklus hidup owner/pendaftaran (AD-11), role & matriks keterbukaan
 * (AD-8), OTP MFA (AD-8), pergantian COO (FR-17).
 *
 * Cron harian pendaftaran (dipanggil server/jobs/daily.post.ts, Story 1.5):
 * - Pengingat H-3 (kalender Asia/Jakarta, FR-22) TUNGGAL pada hari
 *   `reminderOn` (matriks I/O beku): email ditulis sebagai baris outbox
 *   proofs DI DALAM transaksi job (AR-6); idempoten per hari — cek baris
 *   outbox (kind + penerima + payload.hari) sebelum insert.
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
 *
 * Keputusan COO (Story 1.6; hardening 2026-09-22): `keputusanCalon`
 * menjalankan SATU transaksi berurutan CAS-first — alasan wajib → otoritas
 * COO (`findActiveCooTenure` in-tx) → eksistensi calon → CAS
 * `UPDATE ... WHERE status='diajukan' RETURNING` (nol baris = kalah race →
 * 409, dievaluasi SEBELUM gerbang kelengkapan) → gerbang kelengkapan atas
 * baris PASCA-update yang di-join dalam tx yang sama (anti TOCTOU — PUT
 * /api/profile boleh mengosongkan field di antara baca dan CAS) → hitung
 * penolakan (bila menolak) → `writeAuditEntry` in-tx (AD-3). Gerbang gagal
 * = sentinel di-THROW di dalam tx → ROLLBACK total (status kembali
 * `diajukan`, TANPA audit), ditangkap di luar transaksi → 400 di lapis
 * handler. `daftarCalonVerifikasi` menyusun wire daftar kandidat COO.
 */
import { addCalendarDays, isDayOnOrBefore, jakartaDayKey, type DayKey } from '#shared/domain/calendar'
import { profilLengkap, sisaFieldKosong, type KunciFieldProfil, type ProfilValues } from '#shared/domain/profil'
import type { OwnerStatus } from '#shared/domain/identity'
import { hitungEntryAksi, writeAuditEntry } from '../audit/index'
import { adaOutboxEmail, enqueueEmail, OUTBOX_KIND_NOTIFIKASI } from '../proofs/index'
import type { Db } from '../../utils/db'
import type { HasilDaftarOwner, OwnerRecord } from './owner.repo'
import {
  aktifkanKembaliCalon,
  daftarOwnerByEmail,
  findActiveCooTenure,
  findOwnerByEmail,
  findOwnerById,
  kedaluwarsakanCalon,
  listCalonDiajukan,
  listCalonVerifikasi,
  simpanProfilCalon,
  tolakCalon,
  verifikasiCalon,
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
 * hari `reminderOn` saja (pengingat tunggal); idempoten per hari via cek baris
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

      if (deadline.reminderOn === today) {
        // Pengingat H-3 TUNGGAL — matriks I/O beku mem-pin reminderOn ===
        // today (bukan harian sejak H-3); idempoten per hari via cek baris
        // outbox (kind + penerima + payload.hari) DI DALAM transaksi sebelum
        // insert — dua run di hari sama menghasilkan satu baris (AR-6).
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

/* ------------------------------------------------------------------ *
 * Keputusan COO (Story 1.6) — verifikasi & penolakan pendaftar.
 * ------------------------------------------------------------------ */

/** Keputusan yang dapat diambil COO atas calon `diajukan`. */
export const KEPUTUSAN_COO = ['terverifikasi', 'ditolak'] as const
export type KeputusanCoo = (typeof KEPUTUSAN_COO)[number]

/** Satu baris kandidat verifikasi untuk COO (wire GET /api/pendaftar). */
export interface BarisCalonVerifikasi {
  id: string
  email: string
  /** Nama Lengkap (field #1); '' bila belum diisi. */
  nama: string
  createdAt: string
  /** Kelengkapan Profile 10 field (prasyarat verifikasi) — `profilLengkap()`. */
  profilLengkap: boolean
  /** Field wajib yang masih kosong (kunci kontrak wire English). */
  sisaField: KunciFieldProfil[]
}

/**
 * Daftar kandidat `diajukan` untuk COO (Story 1.6): urut `created_at`
 * terlama dulu; kelengkapan dievaluasi `profilLengkap()` dari baris yang
 * sama (bukan kolom DB — kelengkapan bukan kolom, AD-8).
 */
export async function daftarCalonVerifikasi(db: Db): Promise<BarisCalonVerifikasi[]> {
  const calon = await listCalonVerifikasi(db)
  return calon.map((baris) => ({
    id: baris.id,
    email: baris.email,
    nama: baris.fullName ?? '',
    createdAt: baris.createdAt,
    profilLengkap: profilLengkap(baris),
    sisaField: sisaFieldKosong(baris),
  }))
}

/**
 * Kode akhir keputusan — peta 1:1 ke status HTTP di lapis handler:
 * `sukses` 200; `tidak-ditemukan` 404; `kewenangan-berakhir` 403;
 * `status-berubah` 409 (kalah race CAS — dievaluasi SEBELUM gerbang
 * kelengkapan, hardening 2026-09-22); `profil-belum-lengkap` /
 * `alasan-wajib` 400 — kontrak "hanya satu penulis berhasil", BUKAN error
 * (AD-11); urutan prioritas 409 > 400 tetap.
 */
export type AkhirKeputusanCalon =
  | { akhir: 'sukses', id: string, email: string, status: OwnerStatus }
  | { akhir: 'tidak-ditemukan' }
  | { akhir: 'kewenangan-berakhir' }
  | { akhir: 'profil-belum-lengkap', sisaField: KunciFieldProfil[] }
  | { akhir: 'alasan-wajib' }
  | { akhir: 'status-berubah' }

/** Aksi audit penolakan — registry `shared/domain/audit.ts`. */
const AKSI_AUDIT_PENOLAKAN = 'pendaftaran-penolakan' as const

/** Aksi audit verifikasi — registry `shared/domain/audit.ts`. */
const AKSI_AUDIT_VERIFIKASI = 'pendaftaran-verifikasi' as const

/**
 * Sentinel rollback gerbang kelengkapan pasca-CAS (hardening 2026-09-22) —
 * objek unik khusus (BUKAN Error generik) yang di-THROW DI DALAM callback
 * `db.transaction` agar SELURUH transaksi di-ROLLBACK (status kembali
 * `diajukan`, TANPA audit); ditangkap DI LUAR transaksi lalu dipetakan ke
 * akhir `profil-belum-lengkap` (400). Error asing di-re-throw apa adanya.
 * Nilai yang di-RETURN dari callback tx = COMMIT — itulah sebabnya gagal
 * gerbang wajib lewat throw, bukan return.
 */
class SentinelProfilBelumLengkap {
  /** Field wajib yang masih kosong pada baris PASCA-update. */
  readonly sisaField: KunciFieldProfil[]

  constructor(sisaField: KunciFieldProfil[]) {
    this.sisaField = sisaField
  }
}

/**
 * Terima keputusan COO atas calon `diajukan` (Story 1.6; hardening
 * 2026-09-22) — SATU transaksi berurutan CAS-first (pola
 * `runRegistrationDailyJob`): alasan wajib non-kosong setelah trim
 * (divalidasi handler DAN di sini) → otoritas COO dievaluasi in-tx
 * (`findActiveCooTenure` — kewenangan pada saat commit, AD-8) → eksistensi
 * calon (baris dipakai untuk `details.email` audit) → CAS
 * `UPDATE ... WHERE status='diajukan' RETURNING` — nol baris = kalah race
 * (cron kedaluwarsa / COO lain lebih dulu) → `status-berubah` (409),
 * TANPA audit baru (AD-11) → gerbang kelengkapan ATAS BARIS PASCA-update
 * (`findOwnerById(tx, id)` kedua — kolom profil ada di tabel anak, sehingga
 * returning CAS mentah tidak cukup; `.returning()` owners tidak membawa
 * kolom join): `profilLengkap=false` pada verifikasi = throw sentinel →
 * rollback total (tanpa mutasi, tanpa audit — AD-8) → hitung penolakan
 * (bila menolak) → audit in-tx (AD-3), aktor user = COO, target
 * `owners:<id>`, email dari BACAAN PERTAMA (pra-CAS).
 *
 * `status` respons dibaca dari baris PASCA-CAS (bukan echo
 * `input.keputusan`) — wire mengikuti truth DB. Penolakan:
 * `rejectionReason` tersimpan apa adanya; `details.hitunganPenolakan` =
 * jumlah entry `pendaftaran-penolakan` untuk owner saat kejadian TERMASUK
 * entry yang sedang ditulis (keputusan owner 2026-09-21 — audit saja,
 * tanpa kolom tambahan).
 */
export async function keputusanCalon(
  input: { emailCoo: string, id: string, keputusan: KeputusanCoo, alasan?: string },
  db: Db,
): Promise<AkhirKeputusanCalon> {
  try {
    return await db.transaction(async (tx) => {
      // (1) Alasan penolakan wajib (gate kedua setelah handler) — tanpa mutasi.
      if (input.keputusan === 'ditolak' && (input.alasan ?? '').trim().length === 0) {
        return { akhir: 'alasan-wajib' }
      }

      // (2) Otoritas COO dievaluasi in-tx — kewenangan pada saat commit (AD-8).
      const now = new Date()
      const coo = await findOwnerByEmail(tx, input.emailCoo)
      if (!coo || !(await findActiveCooTenure(tx, coo.id, now))) {
        return { akhir: 'kewenangan-berakhir' }
      }

      // (3) Eksistensi calon — bacaan PERTAMA; emailnya dipakai audit.
      const calon = await findOwnerById(tx, input.id)
      if (!calon) return { akhir: 'tidak-ditemukan' }

      // (4) CAS — nol baris = kalah race → `status-berubah` (409), TANPA
      // audit baru (AD-11). Dievaluasi SEBELUM gerbang kelengkapan: race
      // status harus 409 meski profil calon kosong (hardening 2026-09-22).
      const cas = input.keputusan === 'terverifikasi'
        ? await verifikasiCalon(tx, input.id)
        : await tolakCalon(tx, input.id, input.alasan ?? '')
      if (!cas) return { akhir: 'status-berubah' }

      // (5) Baca ulang baris PASCA-update (join 3 tabel, dalam tx yang sama):
      // sumber `status` respons (bukan echo input) DAN basis gerbang
      // kelengkapan verifikasi — anti TOCTOU, PUT /api/profile boleh
      // mengosongkan field di antara bacaan pertama dan CAS.
      const calonSesudah = await findOwnerById(tx, input.id)
      if (!calonSesudah) {
        throw new Error('keputusanCalon: baris pasca-CAS tidak terbaca dalam transaksi.')
      }
      if (input.keputusan === 'terverifikasi' && !profilLengkap(calonSesudah)) {
        // Gerbang kelengkapan gagal PASCA-CAS → THROW sentinel di dalam tx =
        // ROLLBACK total (status kembali `diajukan`, TANPA audit); ditangkap
        // di luar `db.transaction` (AD-8: UI hanya lapisan pertama).
        throw new SentinelProfilBelumLengkap(sisaFieldKosong(calonSesudah))
      }

      if (input.keputusan === 'ditolak') {
        // (6a) Hitungan penolakan saat kejadian — termasuk entry yang sedang
        // ditulis (masih belum ter-insert pada saat hitung): +1.
        const hitunganSebelumnya = await hitungEntryAksi(tx, {
          action: AKSI_AUDIT_PENOLAKAN,
          target: `owners:${input.id}`,
        })
        await writeAuditEntry(tx, {
          actor: { kind: 'user', ownerId: coo.id },
          action: AKSI_AUDIT_PENOLAKAN,
          target: `owners:${input.id}`,
          details: {
            email: calon.email,
            alasan: input.alasan ?? '',
            hitunganPenolakan: hitunganSebelumnya + 1,
          },
        })
      } else {
        // (6b) Audit verifikasi in-tx (AD-3).
        await writeAuditEntry(tx, {
          actor: { kind: 'user', ownerId: coo.id },
          action: AKSI_AUDIT_VERIFIKASI,
          target: `owners:${input.id}`,
          details: { email: calon.email },
        })
      }

      // (7) Status respons DARI DB (baris pasca-CAS) — bukan echo input.
      return { akhir: 'sukses', id: cas.id, email: cas.email, status: calonSesudah.status }
    })
  } catch (error) {
    // Sentinel = kelengkapan gagal pasca-CAS; transaksi sudah di-rollback
    // total oleh throw — petakan ke akhir 400 tanpa mutasi. Error asing
    // (infrastruktur) di-re-throw apa adanya.
    if (error instanceof SentinelProfilBelumLengkap) {
      return { akhir: 'profil-belum-lengkap', sisaField: error.sisaField }
    }
    throw error
  }
}
