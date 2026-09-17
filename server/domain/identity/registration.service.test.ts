import { describe, expect, it } from 'vitest'
import { asDayKey } from '#shared/domain/calendar'
import { auditLogs, owners } from '../../../drizzle/schema'
import {
  REGISTRATION_EXPIRY_DAYS,
  REGISTRATION_REMINDER_DAYS_BEFORE,
  ajukanPendaftaran,
  registrationDeadline,
  runRegistrationDailyJob,
} from './registration.service'

describe('registrationDeadline (FR-22/AD-11 — hari kalender, zona Asia/Jakarta)', () => {
  it('submit 2026-09-01 -> reminder 2026-09-05 (H-3), expiry 2026-09-08 (hari ke-7)', () => {
    expect(registrationDeadline(asDayKey('2026-09-01'))).toEqual({
      submittedOn: '2026-09-01',
      reminderOn: '2026-09-05',
      expiresOn: '2026-09-08',
    })
  })

  it('konstanta batas dipinkan (7 hari expiry, pengingat H-3)', () => {
    expect(REGISTRATION_EXPIRY_DAYS).toBe(7)
    expect(REGISTRATION_REMINDER_DAYS_BEFORE).toBe(3)
  })
})

describe('runRegistrationDailyJob (kerangka cron scaffold)', () => {
  it('no-op dengan kontrak balikan tetap sampai jalur cron ada (Story 1.5/1.6)', async () => {
    await expect(runRegistrationDailyJob(asDayKey('2026-09-16'))).resolves.toEqual({ reminded: 0, expired: 0 })
  })
})

/**
 * DB TIDAK disentuh — transaksi + rantai Drizzle dipalsukan (pola
 * audit.repo.test.ts). `txPalsu` membawa `rollback` agar lolos gerbang
 * in-tx `writeAuditEntry` (AD-3) yang asli; seluruh INSERT terekam untuk
 * asersi (owners vs auditLogs dibedakan referensi tabel).
 */
interface TulisanInsert {
  tabel: unknown
  baris: Record<string, unknown>
}

function buatDbTransaksiPalsu(hasilReturning: unknown[], hasilSelect: unknown[]) {
  const tulisan: TulisanInsert[] = []
  const txPalsu = {
    rollback: async () => {},
    insert: (tabel: unknown) => {
      const rantai = {
        values: (baris: Record<string, unknown>) => {
          tulisan.push({ tabel, baris })
          return rantai
        },
        onConflictDoNothing: () => rantai,
        returning: async () => hasilReturning,
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
  }
  const dbPalsu = {
    transaction: async <T>(callback: (tx: typeof txPalsu) => Promise<T>) => callback(txPalsu),
  }
  return { dbPalsu, tulisan }
}

describe('ajukanPendaftaran (Story 1.4, FR-22/AD-3/AD-11 — matriks I/O spec)', () => {
  it('baris baru → entry audit pendaftaran-diajukan tertulis DALAM transaksi yang sama', async () => {
    const baris = {
      id: '0f0e0d0c-0000-4000-8000-000000000001',
      email: 'uji.snddash.diajukan@gmail.com',
      status: 'diajukan',
      rejectionReason: null,
      firstEffectiveAt: null,
    }
    const { dbPalsu, tulisan } = buatDbTransaksiPalsu([baris], [])

    const hasil = await ajukanPendaftaran({ email: baris.email }, dbPalsu)

    expect(hasil.baru).toBe(true)
    expect(hasil.rekaman).toEqual(baris)

    // Dua tulisan dalam SATU transaksi: baris owner + entry audit.
    expect(tulisan).toHaveLength(2)
    const [insertOwner, insertAudit] = tulisan
    expect(insertOwner.tabel).toBe(owners)
    expect(insertOwner.baris).toEqual({ email: baris.email })

    // Envelope audit AD-3: aktor user = owner baru, action dari registry,
    // target konvensi `owners:<id>`, details memuat email pendaftar.
    expect(insertAudit.tabel).toBe(auditLogs)
    expect(insertAudit.baris).toEqual({
      action: 'pendaftaran-diajukan',
      actorOwnerId: baris.id,
      target: `owners:${baris.id}`,
      details: { email: baris.email },
    })
  })

  it('email existing → baris dikembalikan tanpa mutasi dan TANPA audit baru', async () => {
    const existing = {
      id: '0f0e0d0c-0000-4000-8000-000000000002',
      email: 'uji.snddash.existing@gmail.com',
      status: 'terverifikasi',
      rejectionReason: null,
      firstEffectiveAt: '2026-01-01T00:00:00.000Z',
    }
    const { dbPalsu, tulisan } = buatDbTransaksiPalsu([], [existing])

    const hasil = await ajukanPendaftaran({ email: existing.email }, dbPalsu)

    // Baris existing apa adanya — status terverifikasi/keluar tidak pernah
    // tertimpa; idempoten = baris sama, `baru: false`.
    expect(hasil).toEqual({ rekaman: existing, baru: false })

    // Satu-satunya tulisan = INSERT-CAS (DO NOTHING, payload hanya email);
    // TIDAK ada entry audit baru, TIDAK ada penulisan-ulang baris.
    expect(tulisan).toHaveLength(1)
    expect(tulisan[0].tabel).toBe(owners)
    expect(tulisan[0].baris).toEqual({ email: existing.email })
  })
})
