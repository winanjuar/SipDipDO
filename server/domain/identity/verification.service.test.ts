/**
 * UNIT — Story 1.6 "Verifikasi & Penolakan Pendaftar oleh COO": service
 * `keputusanCalon` (satu transaksi: otoritas COO in-tx → gerbang kelengkapan
 * → CAS → hitung penolakan → audit in-tx).
 *
 * Cakupan kontrak spec 1.6:
 * - CAS race: repo mengembalikan null (kalah race cron/COO lain) → akhir
 *   `status-berubah` (dipetakan handler ke 409 STATUS_BERUBAH) TANPA audit
 *   baru (AD-11 — "hanya satu penulis yang berhasil").
 * - Gerbang kelengkapan server (AD-8): verifikasi calon `profilLengkap=false`
 *   → `profil-belum-lengkap` (400 PROFILE_INCOMPLETE) tanpa mutasi/audit.
 * - Alasan penolakan wajib non-kosong setelah trim → `alasan-wajib` (400),
 *   divalidasi handler DAN service.
 * - Audit in-tx (AD-3): verifikasi → `pendaftaran-verifikasi`; penolakan →
 *   `pendaftaran-penolakan` dengan `details.alasan` +
 *   `details.hitunganPenolakan` (jumlah entry termasuk yang sedang ditulis).
 * - Otoritas COO dievaluasi in-tx (`findActiveCooTenure`) — tenure habis →
 *   `kewenangan-berakhir` (403).
 * - id tak dikenal → `tidak-ditemukan` (404 TIDAK_DITEMUKAN).
 *
 * DB TIDAK disentuh — transaksi + rantai Drizzle dipalsukan (pola
 * registration.service.test.ts / registration.service.expiry.test.ts).
 */
import { describe, expect, it } from 'vitest'
import { auditLogs, cooTenures, owners } from '../../../drizzle/schema'
import { keputusanCalon } from './registration.service'

/** Id sintetis deterministik (bentuk uuid). */
const ID_COO = '0f0e0d0c-0000-4000-8000-000000000201'
const ID_CALON = '0f0e0d0c-0000-4000-8000-000000000202'
const EMAIL_COO = 'uji.snddash.unit.coo@gmail.com'
const EMAIL_CALON = 'uji.snddash.unit.calon@gmail.com'

/** Baris join mentah calon — profil lengkap (10 field terisi, bank enum). */
const barisCalonLengkap = {
  id: ID_CALON,
  email: EMAIL_CALON,
  status: 'diajukan',
  rejectionReason: null,
  firstEffectiveAt: null,
  fullName: 'Calon Lengkap',
  alias: 'Calon',
  phoneNumber: '081200000001',
  emergencyContactName: 'Kontak Uji',
  emergencyContactPhoneNumber: '081300000001',
  emergencyContactRelationship: 'Saudara',
  storedBankName: 'BCA',
  accountHolderName: 'Calon Lengkap',
  accountNumber: '1234567890',
}

/** Baris join mentah calon — profil belum lengkap (semua field profil null). */
const barisCalonBelumLengkap = {
  id: ID_CALON,
  email: EMAIL_CALON,
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
}

/** Baris join mentah COO (owner terverifikasi dengan tenure aktif). */
const barisCoo = {
  id: ID_COO,
  email: EMAIL_COO,
  status: 'terverifikasi',
  rejectionReason: null,
  firstEffectiveAt: '2026-01-01T00:00:00.000Z',
  fullName: 'Coo Uji',
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

interface KonfigTxPalsu {
  /** Antrean hasil select pada tabel `owners` (COO dulu, lalu calon). */
  hasilOwners: unknown[][]
  /** Hasil select tenure COO (default: aktif). */
  hasilTenure?: unknown[]
  /** Hasil select hitungan audit (default: 0). */
  hasilHitunganAudit?: unknown[]
  /** Hasil `RETURNING` CAS UPDATE owners (default: menang). */
  casHasil?: unknown[]
}

/**
 * Fake tx — select membedakan tabel (owners = antrean berurutan, coo_tenures
 * = tenure, audit_logs = hitungan); update owners membawa `returning` CAS;
 * insert terekam untuk asersi in-tx (AD-3). `rollback` disertakan agar lolos
 * gerbang in-tx `writeAuditEntry` yang asli.
 */
function buatTxKeputusanPalsu(konfig: KonfigTxPalsu) {
  const insert: TulisanInsert[] = []
  const update: TulisanUpdate[] = []
  const txPalsu = {
    rollback: async () => {},
    insert: (tabel: unknown) => {
      const rantai = {
        values: (baris: Record<string, unknown>) => {
          insert.push({ tabel, baris })
          return rantai
        },
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
        then: (resolve: (nilai: unknown[]) => void) => {
          if (tabelTerpilih === owners) resolve(konfig.hasilOwners.shift() ?? [])
          else if (tabelTerpilih === cooTenures) resolve(konfig.hasilTenure ?? [{ id: 'tenure-aktif' }])
          else if (tabelTerpilih === auditLogs) resolve(konfig.hasilHitunganAudit ?? [{ jumlah: 0 }])
          else resolve([])
        },
      }
      return rantai
    },
    update: (tabel: unknown) => {
      const rantai = {
        set: (nilai: Record<string, unknown>) => {
          update.push({ tabel, set: nilai })
          return rantai
        },
        where: () => rantai,
        returning: async () => konfig.casHasil ?? [{ id: ID_CALON, email: EMAIL_CALON }],
      }
      return rantai
    },
  }
  const dbPalsu = {
    transaction: async <T>(callback: (tx: typeof txPalsu) => Promise<T>) => callback(txPalsu),
  }
  return { dbPalsu, insert, update }
}

const panggil = (dbPalsu: unknown, input: { keputusan: 'terverifikasi' | 'ditolak', alasan?: string }) =>
  keputusanCalon(
    {
      emailCoo: EMAIL_COO,
      id: ID_CALON,
      keputusan: input.keputusan,
      ...(input.alasan !== undefined ? { alasan: input.alasan } : {}),
    },
    dbPalsu as unknown as Parameters<typeof keputusanCalon>[1],
  )

describe('keputusanCalon — audit in-tx (Story 1.6, AD-3)', () => {
  it('verifikasi calon lengkap → CAS status terverifikasi + entry audit pendaftaran-verifikasi (aktor COO, target owners:<id>)', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      hasilOwners: [[barisCoo], [barisCalonLengkap]],
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'terverifikasi' })

    expect(hasil).toEqual({ akhir: 'sukses', id: ID_CALON, email: EMAIL_CALON, status: 'terverifikasi' })

    // Satu CAS UPDATE owners (status setelah WHERE diajukan) + satu INSERT audit.
    expect(update).toHaveLength(1)
    expect(update[0]?.tabel).toBe(owners)
    expect(update[0]?.set?.status).toBe('terverifikasi')
    expect(update[0]?.set?.rejectionReason).toBeUndefined()

    expect(insert).toHaveLength(1)
    expect(insert[0]?.tabel).toBe(auditLogs)
    expect(insert[0]?.baris).toEqual({
      action: 'pendaftaran-verifikasi',
      actorOwnerId: ID_COO,
      target: `owners:${ID_CALON}`,
      details: { email: EMAIL_CALON },
    })
  })

  it('tolak dengan alasan → CAS status ditolak + rejection_reason tersimpan + audit details.alasan & hitunganPenolakan (termasuk entry yang sedang ditulis)', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      hasilOwners: [[barisCoo], [barisCalonLengkap]],
      hasilHitunganAudit: [{ jumlah: 2 }],
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'ditolak', alasan: 'Dokumen tidak sah.' })

    expect(hasil).toEqual({ akhir: 'sukses', id: ID_CALON, email: EMAIL_CALON, status: 'ditolak' })
    expect(update[0]?.set?.status).toBe('ditolak')
    expect(update[0]?.set?.rejectionReason).toBe('Dokumen tidak sah.')

    expect(insert).toHaveLength(1)
    expect(insert[0]?.baris).toEqual({
      action: 'pendaftaran-penolakan',
      actorOwnerId: ID_COO,
      target: `owners:${ID_CALON}`,
      details: {
        email: EMAIL_CALON,
        alasan: 'Dokumen tidak sah.',
        hitunganPenolakan: 3, // 2 entry sebelumnya + entry yang sedang ditulis.
      },
    })
  })
})

describe('keputusanCalon — gerbang kelengkapan & alasan wajib (server-truth, AD-8)', () => {
  it('verifikasi calon belum lengkap → profil-belum-lengkap + sisaField, TANPA mutasi/audit', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      hasilOwners: [[barisCoo], [barisCalonBelumLengkap]],
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'terverifikasi' })

    expect(hasil.akhir).toBe('profil-belum-lengkap')
    if (hasil.akhir === 'profil-belum-lengkap') {
      expect(hasil.sisaField).toContain('fullName')
      expect(hasil.sisaField).toContain('accountNumber')
    }
    expect(update).toHaveLength(0)
    expect(insert).toHaveLength(0)
  })

  it('tolak tanpa alasan / alasan whitespace → alasan-wajib, TANPA mutasi/audit', async () => {
    for (const alasan of ['', '   ']) {
      const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
        hasilOwners: [[barisCoo], [barisCalonLengkap]],
      })
      const hasil = await panggil(dbPalsu, { keputusan: 'ditolak', alasan })
      expect(hasil).toEqual({ akhir: 'alasan-wajib' })
      expect(update).toHaveLength(0)
      expect(insert).toHaveLength(0)
    }
  })
})

describe('keputusanCalon — race CAS & otoritas COO (AD-11/AD-8)', () => {
  it('CAS kalah race (returning kosong) → status-berubah TANPA audit baru', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      hasilOwners: [[barisCoo], [barisCalonLengkap]],
      casHasil: [], // cron kedaluwarsa / COO lain menang lebih dulu.
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'terverifikasi' })

    expect(hasil).toEqual({ akhir: 'status-berubah' })
    expect(update).toHaveLength(1) // CAS dicoba — nol baris ter-update.
    expect(insert).toHaveLength(0) // Tanpa audit baru.
  })

  it('id tak dikenal → tidak-ditemukan TANPA mutasi/audit', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      hasilOwners: [[barisCoo], []], // antrean calon habis = id tidak ada.
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'terverifikasi' })

    expect(hasil).toEqual({ akhir: 'tidak-ditemukan' })
    expect(update).toHaveLength(0)
    expect(insert).toHaveLength(0)
  })

  it('tenure COO tidak berlaku in-tx → kewenangan-berakhir TANPA mutasi/audit', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      hasilOwners: [[barisCoo], [barisCalonLengkap]],
      hasilTenure: [], // tidak ada tenure berlaku pada `now`.
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'terverifikasi' })

    expect(hasil).toEqual({ akhir: 'kewenangan-berakhir' })
    expect(update).toHaveLength(0)
    expect(insert).toHaveLength(0)
  })
})
