/**
 * ATDD GREEN-PHASE (Vitest) — kontrak CAS pendaftaran mandiri Story 1.4:
 * `daftarOwnerByEmail(db, { email })` INSERT `ON CONFLICT (email) DO NOTHING`
 * idempotent per email (AD-11) — baris existing TIDAK PERNAH dimutasi;
 * bila insert tidak mengembalikan baris, baris existing dibaca via SELECT
 * (jalur fallback) dan `baru: false`.
 *
 * DB TIDAK disentuh — rantai Drizzle dipalsukan (fake chain), pola
 * audit.repo.test.ts.
 */
import { describe, expect, test } from 'vitest'
import { owners } from '../../../drizzle/schema'
import { daftarOwnerByEmail } from './owner.repo'

const MODUL_REPO = './owner.repo'

/** Baris owner sintetis untuk hasil returning/SELECT. */
const barisOwner = (email: string) => ({
  id: '0f0e0d0c-0000-4000-8000-000000000001',
  email,
  status: 'diajukan',
  rejectionReason: null,
  firstEffectiveAt: null,
})

/** Rekaman rantai insert palsu: payload values + perilaku konflik. */
interface RekamanInsert {
  values?: Record<string, unknown>
  konflik?: { target?: unknown }
  selectDipanggil: number
}

/** Rantai insert palsu: insert(t).values(baris).onConflictDoNothing(k).returning() */
function buatRantaiInsert(rekaman: RekamanInsert, hasilReturning: unknown[]) {
  const rantai = {
    values: (baris: Record<string, unknown>) => {
      rekaman.values = baris
      return rantai
    },
    onConflictDoNothing: (konflik: { target?: unknown }) => {
      rekaman.konflik = konflik
      return rantai
    },
    returning: async () => hasilReturning,
  }
  return rantai
}

/** Rantai select palsu (thenable) untuk jalur fallback findOwnerByEmail. */
function buatDbPalsu(rekaman: RekamanInsert, hasilReturning: unknown[], hasilSelect: unknown[]) {
  return {
    insert: () => buatRantaiInsert(rekaman, hasilReturning),
    select: () => {
      rekaman.selectDipanggil += 1
      const rantai = {
        from: () => rantai,
        where: () => rantai,
        limit: () => rantai,
        then: (resolve: (nilai: unknown[]) => void) => resolve(hasilSelect),
      }
      return rantai
    },
  }
}

describe('server/domain/identity/owner.repo — daftarOwnerByEmail (Story 1.4, AD-11)', () => {
  test('email baru → INSERT satu-satunya jalan; values hanya email; DO NOTHING (bukan DO UPDATE)', async () => {
    const rekaman: RekamanInsert = { selectDipanggil: 0 }
    const baris = barisOwner('uji.snddash.baru@gmail.com')
    const dbPalsu = buatDbPalsu(rekaman, [baris], [])

    const hasil = await daftarOwnerByEmail(dbPalsu, { email: baris.email })

    expect(hasil).toEqual({ rekaman: baris, baru: true })
    // INSERT-CAS: payload HANYA email — status default 'diajukan' dari DB.
    expect(rekaman.values).toEqual({ email: baris.email })
    // Konflik = DO NOTHING dengan target email unik — baris existing tidak
    // pernah ditulis-ulang (bukan onConflictDoUpdate).
    expect(rekaman.konflik?.target).toBe(owners.email)
    // Baris baru → fallback SELECT tidak diperlukan.
    expect(rekaman.selectDipanggil).toBe(0)
  })

  test('ON CONFLICT jalur fallback SELECT: returning kosong → baris existing dibaca, baru: false', async () => {
    const rekaman: RekamanInsert = { selectDipanggil: 0 }
    const existing = barisOwner('uji.snddash.existing@gmail.com')
    const dbPalsu = buatDbPalsu(rekaman, [], [existing])

    const hasil = await daftarOwnerByEmail(dbPalsu, { email: existing.email })

    // Baris existing dikembalikan APA ADANYA — tanpa mutasi (status/umur
    // baris tetap; idempoten = baris sama).
    expect(hasil).toEqual({ rekaman: existing, baru: false })
    expect(rekaman.selectDipanggil).toBe(1)
    expect(rekaman.konflik?.target).toBe(owners.email)
  })

  test('returning kosong DAN SELECT kosong → kontrak rusak, melempar (defensif)', async () => {
    const rekaman: RekamanInsert = { selectDipanggil: 0 }
    const dbPalsu = buatDbPalsu(rekaman, [], [])

    await expect(
      daftarOwnerByEmail(dbPalsu, { email: 'uji.snddash.hilang@gmail.com' }),
    ).rejects.toThrow('daftarOwnerByEmail')
  })

  test('permukaan modul mengekspos fungsi CAS pendaftaran (Story 1.4)', async () => {
    const modul = (await import(MODUL_REPO)) as Record<string, unknown>
    expect(Object.keys(modul)).toContain('daftarOwnerByEmail')
  })
})
