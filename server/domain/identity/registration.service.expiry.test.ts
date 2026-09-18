/**
 * ATDD RED-PHASE — Story 1.5 (Unit, Vitest): jalur eksekusi
 * `runRegistrationDailyJob` — CAP-4 boundary kanonik dengan jam disuntikkan.
 *
 * SEMUA test `test.skip()` — scaffold TDD red phase; hapus skip HANYA pada
 * tugas green-phase yang mengisi job (saat itu juga perbarui test stub lama
 * "no-op dengan kontrak balikan tetap" di registration.service.test.ts).
 *
 * ASUMSI KONTRAK GREEN-PHASE (red-phase, nyatakan eksplisit):
 * - Signature: `runRegistrationDailyJob(today: DayKey, db)` — db injectable
 *   seperti `ajukanPendaftaran` (pola service ini); pemanggilan memakai cast
 *   agar scaffold tetap terkompilasi sebelum signature baru ada.
 * - Kelengkapan Profil = field profil wire English non-null (gmail = kolom
 *   email sesi): fullName, alias, phoneNumber, emergencyContactName,
 *   emergencyContactPhoneNumber, emergencyContactRelationship, bankName,
 *   otherBankName, accountHolderName, accountNumber — BUKAN bagian dari
 *   kontrak wire di sini, hanya bentuk baris palsu.
 * - Pengingat H-3 → INSERT outboxEmails (in-tx, modul proofs via API publik);
 *   kedaluwarsa → CAS UPDATE owners (status diajukan → kedaluwarsa) + INSERT
 *   auditLogs — semuanya dalam transaksi yang sama (AD-3/AD-5/AD-11).
 * - Balikan kontrak baru: { reminded, expired, remindedEmails, expiredEmails }
 *   (paritas wire cron-harian.api.spec.ts).
 *
 * GAGAL SAAT RED: stub saat ini no-op { reminded: 0, expired: 0 } tanpa
 * menulis apa pun dan tanpa field emails — semua asersi muatan gagal.
 *
 * DB TIDAK disentuh — transaksi + rantai Drizzle dipalsukan (pola
 * registration.service.test.ts / audit.repo.test.ts).
 */
import { describe, expect, it } from 'vitest'
import { asDayKey } from '#shared/domain/calendar'
import { auditLogs, outboxEmails, owners } from '../../../drizzle/schema'
import { runRegistrationDailyJob } from './registration.service'

/** Hari uji — dianalisis dari konstanta deadline yang sudah terpin hijau:
 *  diajukanPada 2026-09-01 → reminderOn 2026-09-05 (H-3), expiresOn
 *  2026-09-08 (hari-7) — lihat registrationDeadline di registration.service.test.ts.
 *  Instant createdAt = pukul 17:00 WIB 2026-09-01 → jakartaDayKey = '2026-09-01'. */
const DIAJUKAN_PADA_INSTANT = '2026-09-01T10:00:00.000Z'
const HARI_REMINDER = '2026-09-05'
const HARI_EXPIRY = '2026-09-08'

/** Baris owner palsu — kolom MENTAH join 3 tabel (repo memetakan ke wire;
 *  profil belum lengkap = field profil null, bank tunggal `storedBankName`). */
const barisCalonBelumLengkap = {
  id: '0f0e0d0c-0000-4000-8000-000000000101',
  email: 'uji.snddash.unit.cron-belum-lengkap@gmail.com',
  status: 'diajukan',
  createdAt: DIAJUKAN_PADA_INSTANT,
  fullName: null,
  alias: null,
  phoneNumber: null,
  emergencyContactName: null,
  emergencyContactPhoneNumber: null,
  emergencyContactRelationship: null,
  storedBankName: null,
  accountHolderName: null,
  accountNumber: null,
}

interface TulisanInsert {
  tabel: unknown
  baris: Record<string, unknown>
}

interface TulisanUpdate {
  tabel: unknown
  set: Record<string, unknown>
}

/**
 * Fake tx dengan select + insert + update (tambahan `update` untuk CAS
 * kedaluwarsa — pola buatDbTransaksiPalsu registration.service.test.ts).
 * Penyesuaian green-phase Story 1.5 (alasan tercatat):
 * - select membedakan tabel — kandidat job = `owners` (hasilSelect); select
 *   lain (cek idempotensi outbox `adaOutboxEmail`) → kosong agar jalur
 *   reminder teruji sampai INSERT.
 * - `update.returning` mengembalikan satu baris = CAS MENANG (satu penulis);
 *   jalur CAS kalah tidak berbeda secara unit (guard ada di klausa WHERE SQL).
 */
function buatDbJobPalsu(hasilSelect: unknown[]) {
  const tulisan: (TulisanInsert | TulisanUpdate)[] = []
  const txPalsu = {
    rollback: async () => {},
    insert: (tabel: unknown) => {
      const rantai = {
        values: (baris: Record<string, unknown>) => {
          tulisan.push({ tabel, baris })
          return rantai
        },
        onConflictDoNothing: () => rantai,
        // Insert (outbox) selalu "berhasil" — repo proofs melempar bila
        // returning kosong (guard noUncheckedIndexedAccess).
        returning: async () => [{ id: 'insert-palsu' }],
      }
      return rantai
    },
    select: () => {
      let tabelTerpilih: unknown
      const rantai = {
        from: (tabel: unknown) => {
          tabelTerpilih = tabel
          return rantai
        },
        leftJoin: () => rantai,
        where: () => rantai,
        limit: () => rantai,
        then: (resolve: (nilai: unknown[]) => void) => resolve(tabelTerpilih === owners ? hasilSelect : []),
      }
      return rantai
    },
    update: (tabel: unknown) => {
      const rantai = {
        set: (nilai: Record<string, unknown>) => {
          tulisan.push({ tabel, set: nilai })
          return rantai
        },
        where: () => rantai,
        returning: async () => [{ id: 'cas-menang' }],
      }
      return rantai
    },
  }
  const dbPalsu = {
    transaction: async <T>(callback: (tx: typeof txPalsu) => Promise<T>) => callback(txPalsu),
  }
  return { dbPalsu, tulisan }
}

/** Signature green-phase sudah ada: `runRegistrationDailyJob(today, db)` —
 *  dbPalsu dilempar ke tipe parameter Db (pola cast scaffold). */
const jalankanJob = (today: string, db: unknown): Promise<{ reminded: number, expired: number, remindedEmails: string[], expiredEmails: string[] }> =>
  (runRegistrationDailyJob as unknown as (
    today: ReturnType<typeof asDayKey>,
    db: never,
  ) => Promise<{ reminded: number, expired: number, remindedEmails: string[], expiredEmails: string[] }>)(
    asDayKey(today),
    db as never,
  )

describe('runRegistrationDailyJob — pengingat H-3 (CAP-4, AR-6)', () => {
  it('pada hari reminderOn → INSERT outboxEmails untuk calon diajukan belum lengkap + balikan memuat email', async () => {
    const { dbPalsu, tulisan } = buatDbJobPalsu([barisCalonBelumLengkap])

    const hasil = await jalankanJob(HARI_REMINDER, dbPalsu)

    expect(hasil.reminded).toBe(1)
    expect(hasil.remindedEmails).toContain(barisCalonBelumLengkap.email)
    const insertOutbox = tulisan.find(t => t.tabel === outboxEmails) as TulisanInsert | undefined
    expect(insertOutbox).toBeDefined()
    // Kontrak repo proofs: values = { kind, toAddress, payload } (penyesuaian
    // green-phase — scaffold asumsi `to`/`email`).
    expect(insertOutbox?.baris?.toAddress ?? insertOutbox?.baris?.to).toBe(barisCalonBelumLengkap.email)
    expect(insertOutbox?.baris?.kind).toBe('notifikasi')
  })
})

describe('runRegistrationDailyJob — kedaluwarsa hari-7 via CAS + audit (AD-11, AD-3)', () => {
  it('pada hari expiresOn → CAS UPDATE owners (diajukan→kedaluwarsa) + INSERT auditLogs in-tx', async () => {
    const { dbPalsu, tulisan } = buatDbJobPalsu([barisCalonBelumLengkap])

    const hasil = await jalankanJob(HARI_EXPIRY, dbPalsu)

    expect(hasil.expired).toBe(1)
    expect(hasil.expiredEmails).toContain(barisCalonBelumLengkap.email)

    const updateOwner = tulisan.find(t => t.tabel === owners && 'set' in t) as TulisanUpdate | undefined
    expect(updateOwner).toBeDefined()
    expect(updateOwner?.set?.status).toBe('kedaluwarsa')

    const insertAudit = tulisan.find(t => t.tabel === auditLogs) as TulisanInsert | undefined
    expect(insertAudit).toBeDefined()
    expect(insertAudit?.baris?.target).toBe(`owners:${barisCalonBelumLengkap.id}`)
  })
})

describe('runRegistrationDailyJob — tanpa aksi di luar jendela (boundary kanonik)', () => {
  it('profil sudah lengkap / status bukan diajukan → tanpa tulisan, tanpa email, kontrak balikan penuh', async () => {
    const barisLengkap = {
      ...barisCalonBelumLengkap,
      id: '0f0e0d0c-0000-4000-8000-000000000102',
      email: 'uji.snddash.unit.cron-lengkap@gmail.com',
      fullName: 'Uji Lengkap',
      alias: 'Uji',
      phoneNumber: '081200000001',
      emergencyContactName: 'Kontak Uji',
      emergencyContactPhoneNumber: '081300000001',
      emergencyContactRelationship: 'Saudara',
      storedBankName: 'Bank Uji',
      accountHolderName: 'Uji Lengkap',
      accountNumber: '1234567890',
    }
    const barisTerverifikasi = {
      ...barisCalonBelumLengkap,
      id: '0f0e0d0c-0000-4000-8000-000000000103',
      email: 'uji.snddash.unit.cron-terverifikasi@gmail.com',
      status: 'terverifikasi',
    }
    const { dbPalsu, tulisan } = buatDbJobPalsu([barisLengkap, barisTerverifikasi])

    const hasil = await jalankanJob(HARI_REMINDER, dbPalsu)

    // Kontrak balikan penuh — stub lama tanpa field emails gagal di sini
    // (red jujur), sekaligus mencegah counter-nol palsu (test-quality:
    // asersi yang tidak bisa membedakan stub dari implementasi).
    expect(hasil).toEqual({ reminded: 0, expired: 0, remindedEmails: [], expiredEmails: [] })
    expect(tulisan).toHaveLength(0)
  })
})
