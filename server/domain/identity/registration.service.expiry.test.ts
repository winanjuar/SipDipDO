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
 * - Kelengkapan Profil = 10 kolom profil owners non-null (gmail = kolom
 *   email sesi): namaLengkap, alias, nomorHp, kontakDarurat,
 *   nomorHpKontakDarurat, hubunganDenganOwner, namaBank, pemilikRekening,
 *   nomorRekening — BUKAN bagian dari kontrak wire di sini, hanya bentuk
 *   baris palsu.
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
 *  2026-09-08 (hari-7) — lihat registrationDeadline di registration.service.test.ts. */
const DIAJUKAN_PADA = '2026-09-01'
const HARI_REMINDER = '2026-09-05'
const HARI_EXPIRY = '2026-09-08'

/** Baris owner palsu — profil belum lengkap (kolom profil null). */
const barisCalonBelumLengkap = {
  id: '0f0e0d0c-0000-4000-8000-000000000101',
  email: 'uji.snddash.unit.cron-belum-lengkap@gmail.com',
  status: 'diajukan',
  diajukanPada: DIAJUKAN_PADA,
  namaLengkap: null,
  alias: null,
  nomorHp: null,
  kontakDarurat: null,
  nomorHpKontakDarurat: null,
  hubunganDenganOwner: null,
  namaBank: null,
  pemilikRekening: null,
  nomorRekening: null,
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
        returning: async () => [],
      }
      return rantai
    },
    select: () => {
      const rantai = {
        from: () => rantai,
        where: () => rantai,
        limit: () => rantai,
        then: (resolve: (nilai: unknown[]) => void) => resolve(hasilSelect),
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
        returning: async () => [],
      }
      return rantai
    },
  }
  const dbPalsu = {
    transaction: async <T>(callback: (tx: typeof txPalsu) => Promise<T>) => callback(txPalsu),
  }
  return { dbPalsu, tulisan }
}

/** Signature green-phase belum ada — cast eksplisit (lihat asumsi header). */
const jalankanJob = (today: string, db: unknown): Promise<{ reminded: number, expired: number, remindedEmails: string[], expiredEmails: string[] }> =>
  (runRegistrationDailyJob as unknown as (
    today: ReturnType<typeof asDayKey>,
    db: unknown,
  ) => Promise<{ reminded: number, expired: number, remindedEmails: string[], expiredEmails: string[] }>)(
    asDayKey(today),
    db,
  )

describe('runRegistrationDailyJob — pengingat H-3 (CAP-4, AR-6)', () => {
  it.skip('pada hari reminderOn → INSERT outboxEmails untuk calon diajukan belum lengkap + balikan memuat email', async () => {
    const { dbPalsu, tulisan } = buatDbJobPalsu([barisCalonBelumLengkap])

    const hasil = await jalankanJob(HARI_REMINDER, dbPalsu)

    expect(hasil.reminded).toBe(1)
    expect(hasil.remindedEmails).toContain(barisCalonBelumLengkap.email)
    const insertOutbox = tulisan.find(t => t.tabel === outboxEmails) as TulisanInsert | undefined
    expect(insertOutbox).toBeDefined()
    expect(insertOutbox?.baris?.to ?? insertOutbox?.baris?.email).toBe(barisCalonBelumLengkap.email)
  })
})

describe('runRegistrationDailyJob — kedaluwarsa hari-7 via CAS + audit (AD-11, AD-3)', () => {
  it.skip('pada hari expiresOn → CAS UPDATE owners (diajukan→kedaluwarsa) + INSERT auditLogs in-tx', async () => {
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
  it.skip('profil sudah lengkap / status bukan diajukan → tanpa tulisan, tanpa email, kontrak balikan penuh', async () => {
    const barisLengkap = {
      ...barisCalonBelumLengkap,
      id: '0f0e0d0c-0000-4000-8000-000000000102',
      email: 'uji.snddash.unit.cron-lengkap@gmail.com',
      namaLengkap: 'Uji Lengkap',
      alias: 'Uji',
      nomorHp: '081200000001',
      kontakDarurat: 'Kontak Uji',
      nomorHpKontakDarurat: '081300000001',
      hubunganDenganOwner: 'Saudara',
      namaBank: 'Bank Uji',
      pemilikRekening: 'Uji Lengkap',
      nomorRekening: '1234567890',
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
