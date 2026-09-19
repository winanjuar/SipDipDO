/**
 * ATDD GREEN-PHASE (Vitest) — kontrak CAS pendaftaran mandiri Story 1.4 +
 * normalisasi owner 2026-09-18: `daftarOwnerByEmail(db, { email })` INSERT
 * `ON CONFLICT (email) DO NOTHING` idempotent per email (AD-11) — baris
 * existing TIDAK PERNAH dimutasi; rekaman bentuk wire dibaca ulang via join
 * 3 tabel (owners + 2 anak 1:1).
 *
 * DB TIDAK disentuh — rantai Drizzle dipalsukan (fake chain), pola
 * audit.repo.test.ts.
 */
import { describe, expect, test } from 'vitest'
import { owners } from '../../../drizzle/schema'
import { daftarOwnerByEmail } from './owner.repo'

const MODUL_REPO = './owner.repo'

const ID_TETAP = '0f0e0d0c-0000-4000-8000-000000000001'

/** Baris mentah join 3 tabel untuk hasil SELECT (anak belum ada = NULL). */
const barisJoinMentah = (email: string) => ({
  id: ID_TETAP,
  email,
  status: 'diajukan',
  rejectionReason: null,
  firstEffectiveAt: null,
  fullName: null,
  alias: null,
  phoneNumber: null,
  emergencyContactName: null,
  emergencyContactPhoneNumber: null,
  emergencyContactRelationship: null,
  storedBankName: null,
  accountHolderName: null,
  accountNumber: null,
})

/** Bentuk wire yang dijanjikan repo (bank terurai dua field; tanpa kolom mentah). */
const barisWire = (email: string) => ({
  id: ID_TETAP,
  email,
  status: 'diajukan',
  rejectionReason: null,
  firstEffectiveAt: null,
  fullName: null,
  alias: null,
  phoneNumber: null,
  emergencyContactName: null,
  emergencyContactPhoneNumber: null,
  emergencyContactRelationship: null,
  bankName: null,
  otherBankName: null,
  accountHolderName: null,
  accountNumber: null,
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

/** Rantai select palsu (thenable) untuk baca ulang join 3 tabel. */
function buatDbPalsu(rekaman: RekamanInsert, hasilReturning: unknown[], hasilSelect: unknown[]) {
  return {
    insert: () => buatRantaiInsert(rekaman, hasilReturning),
    select: () => {
      rekaman.selectDipanggil += 1
      const rantai = {
        from: () => rantai,
        leftJoin: () => rantai,
        where: () => rantai,
        limit: () => rantai,
        then: (resolve: (nilai: unknown[]) => void) => resolve(hasilSelect),
      }
      return rantai
    },
  }
}

describe('server/domain/identity/owner.repo — daftarOwnerByEmail (Story 1.4, AD-11)', () => {
  test('email baru → INSERT satu-satunya jalan tulis; values email + kode referral; DO NOTHING (bukan DO UPDATE)', async () => {
    const rekaman: RekamanInsert = { selectDipanggil: 0 }
    const email = 'uji.snddash.baru@gmail.com'
    const dbPalsu = buatDbPalsu(rekaman, [{ id: ID_TETAP }], [barisJoinMentah(email)])

    const hasil = await daftarOwnerByEmail(dbPalsu as Parameters<typeof daftarOwnerByEmail>[0], { email })

    expect(hasil).toEqual({ rekaman: barisWire(email), baru: true })
    // INSERT-CAS: payload email + kode referral milik owner (Story 1.4,
    // keputusan owner 2026-09-18) — status default 'diajukan' dari DB.
    expect(rekaman.values?.email).toBe(email)
    expect(String(rekaman.values?.referralCode)).toMatch(/^[A-Za-z0-9]{8}$/)
    // Konflik = DO NOTHING dengan target email unik — baris existing tidak
    // pernah ditulis-ulang (bukan onConflictDoUpdate).
    expect(rekaman.konflik?.target).toBe(owners.email)
    // Rekaman bentuk wire dibaca ulang via join 3 tabel (insert hanya
    // returning id — anak 1:1 belum ada, profil NULL).
    expect(rekaman.selectDipanggil).toBe(1)
  })

  test('ON CONFLICT jalur fallback SELECT: returning kosong → baris existing dibaca, baru: false', async () => {
    const rekaman: RekamanInsert = { selectDipanggil: 0 }
    const existing = barisJoinMentah('uji.snddash.existing@gmail.com')
    const dbPalsu = buatDbPalsu(rekaman, [], [existing])

    const hasil = await daftarOwnerByEmail(dbPalsu as Parameters<typeof daftarOwnerByEmail>[0], { email: existing.email })

    // Baris existing dikembalikan APA ADANYA — tanpa mutasi (status/umur
    // baris tetap; idempoten = baris sama).
    expect(hasil).toEqual({ rekaman: barisWire(existing.email), baru: false })
    expect(rekaman.selectDipanggil).toBe(1)
    expect(rekaman.konflik?.target).toBe(owners.email)
  })

  test('returning kosong DAN SELECT kosong → kontrak rusak, melempar (defensif)', async () => {
    const rekaman: RekamanInsert = { selectDipanggil: 0 }
    const dbPalsu = buatDbPalsu(rekaman, [], [])

    await expect(
      daftarOwnerByEmail(dbPalsu as Parameters<typeof daftarOwnerByEmail>[0], { email: 'uji.snddash.hilang@gmail.com' }),
    ).rejects.toThrow('daftarOwnerByEmail')
  })

  test('tabrakan UNIQUE kode referral (23505) diulang, lalu berhasil — bukan error ke pemanggil', async () => {
    const rekaman: RekamanInsert = { selectDipanggil: 0 }
    const email = 'uji.snddash.tabrakan@gmail.com'
    let panggilanInsert = 0
    const dbTabrakanLaluSukses = {
      insert: () => {
        panggilanInsert += 1
        const rantai = {
          values: (nilai: Record<string, unknown>) => {
            if (panggilanInsert === 1) {
              throw Object.assign(new Error('duplicate key value violates unique constraint "owners_referral_code_unique"'), { code: '23505' })
            }
            rekaman.values = nilai
            return rantai
          },
          onConflictDoNothing: (konflik: { target?: unknown }) => {
            rekaman.konflik = konflik
            return rantai
          },
          returning: async () => [{ id: ID_TETAP }],
        }
        return rantai
      },
      select: () => {
        rekaman.selectDipanggil += 1
        const rantai = {
          from: () => rantai,
          leftJoin: () => rantai,
          where: () => rantai,
          limit: () => rantai,
          then: (resolve: (nilai: unknown[]) => void) => resolve([barisJoinMentah(email)]),
        }
        return rantai
      },
    } as unknown as Parameters<typeof daftarOwnerByEmail>[0]

    const hasil = await daftarOwnerByEmail(dbTabrakanLaluSukses, { email })

    expect(panggilanInsert).toBe(2)
    expect(hasil).toEqual({ rekaman: barisWire(email), baru: true })
    expect(String(rekaman.values?.referralCode)).toMatch(/^[A-Za-z0-9]{8}$/)
  })

  test('tabrakan kode referral menetap (sampai batas coba) → error 23505 terakhir diteruskan', async () => {
    let panggilanInsert = 0
    const dbSelaluTabrakan = {
      insert: () => {
        panggilanInsert += 1
        return {
          values: (): never => {
            throw Object.assign(new Error('duplicate key value violates unique constraint "owners_referral_code_unique"'), { code: '23505' })
          },
        }
      },
    } as unknown as Parameters<typeof daftarOwnerByEmail>[0]

    await expect(
      daftarOwnerByEmail(dbSelaluTabrakan, { email: 'uji.snddash.tabrakan.abadi@gmail.com' }),
    ).rejects.toMatchObject({ code: '23505' })
    expect(panggilanInsert).toBe(3)
  })

  test('permukaan modul mengekspos fungsi CAS pendaftaran (Story 1.4)', async () => {
    const modul = (await import(MODUL_REPO)) as Record<string, unknown>
    expect(Object.keys(modul)).toContain('daftarOwnerByEmail')
  })
})
