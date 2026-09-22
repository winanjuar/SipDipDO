/**
 * UNIT — Story 1.6 "Verifikasi & Penolakan Pendaftar oleh COO" + hardening
 * pasca-review (2026-09-22): service `keputusanCalon` (satu transaksi
 * berurutan CAS-first: alasan wajib → otoritas COO in-tx → eksistensi →
 * CAS → gerbang kelengkapan atas baris PASCA-update → hitung penolakan →
 * audit in-tx).
 *
 * Cakupan kontrak spec 1.6 + hardening:
 * - Predikat CAS TER-ASSERT (hardening adv#7): where-clause UPDATE
 *   dipasangkap fake tx dan diurai — wajib memuat `eq(owners.id)` &
 *   `eq(owners.status,'diajukan')` (AD-11); fake tx lama menelan `.where()`.
 * - Urutan evaluasi: CAS dievaluasi SEBELUM gerbang kelengkapan — race
 *   status = `status-berubah` (409), bukan 400, TANPA audit baru (AD-11).
 * - Anti TOCTOU (hardening adv#1+edge#1): kelengkapan dievaluasi pada baris
 *   PASCA-update (bacaan kedua, joined) — profil yang dikosongkan di antara
 *   baca dan CAS → sentinel → rollback total → `profil-belum-lengkap` +
 *   sisaField, TANPA audit.
 * - Asimetri gerbang (hardening adv#9): hanya VERIFIKASI digerbangi —
 *   penolakan calon belum-lengkap tetap sukses + audit.
 * - Alasan penolakan wajib non-kosong setelah trim → `alasan-wajib` (400),
 *   divalidasi handler DAN service; `alasan` pada `terverifikasi` ditolak
 *   superRefine handler — dipin di level API (pendaftar.api.spec.ts).
 * - Audit in-tx (AD-3): verifikasi → `pendaftaran-verifikasi`; penolakan →
 *   `pendaftaran-penolakan` dengan `details.alasan` +
 *   `details.hitunganPenolakan` (jumlah entry termasuk yang sedang ditulis).
 * - Otoritas COO dievaluasi in-tx (`findActiveCooTenure`) — tenure habis →
 *   `kewenangan-berakhir` (403); id tak dikenal → `tidak-ditemukan` (404).
 * - `status` respons DARI DB (baris pasca-CAS), bukan echo input (adv#8).
 *
 * DB TIDAK disentuh — transaksi + rantai Drizzle dipalsukan (pola
 * registration.service.test.ts / registration.service.expiry.test.ts).
 */
import { Column, getTableName, is, Param, SQL } from 'drizzle-orm'
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

/** Varian baris dengan status lain — simulasi bacaan PASCA-CAS. */
const denganStatus = (baris: typeof barisCalonLengkap, status: string, rejectionReason: string | null = null) => ({
  ...baris,
  status,
  rejectionReason,
})

interface TulisanInsert {
  tabel: unknown
  baris: Record<string, unknown>
}

interface TulisanUpdate {
  tabel: unknown
  set: Record<string, unknown>
}

interface KonfigTxPalsu {
  /** Antrean hasil select pada tabel `owners` — berurutan: COO → calon
   *  (pra-CAS) → calon (PASCA-CAS, bacaan kedua service). */
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
 * = tenure, audit_logs = hitungan); update owners membawa `returning` CAS
 * dan MENYANGGAP where-clause (hardening: predikat CAS ter-assert); insert
 * terekam untuk asersi in-tx (AD-3). `rollback` disertakan agar lolos
 * gerbang in-tx `writeAuditEntry` yang asli.
 */
function buatTxKeputusanPalsu(konfig: KonfigTxPalsu) {
  const insert: TulisanInsert[] = []
  const update: TulisanUpdate[] = []
  const klausaWhereUpdate: unknown[] = []
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
        where: (arg: unknown) => {
          klausaWhereUpdate.push(arg)
          return rantai
        },
        returning: async () => konfig.casHasil ?? [{ id: ID_CALON, email: EMAIL_CALON }],
      }
      return rantai
    },
  }
  const dbPalsu = {
    transaction: async <T>(callback: (tx: typeof txPalsu) => Promise<T>) => callback(txPalsu),
  }
  return { dbPalsu, insert, update, klausaWhereUpdate }
}

/**
 * Urai klausa where Drizzle → nama kolom + nilai param — pin predikat CAS
 * (AD-11) pada level unit tanpa DB: `and(eq(owners.id, …),
 * eq(owners.status,'diajukan'))` wajib terbaca dari where UPDATE.
 */
function uraiKlausaWhere(klausa: unknown): { kolom: string[], nilai: unknown[] } {
  const kolom: string[] = []
  const nilai: unknown[] = []
  const kunjungi = (simpul: unknown): void => {
    if (is(simpul, Column)) {
      kolom.push(`${getTableName(simpul.table)}.${simpul.name}`)
      return
    }
    if (is(simpul, Param)) {
      nilai.push(simpul.value)
      return
    }
    if (is(simpul, SQL)) {
      for (const bagian of simpul.queryChunks) kunjungi(bagian)
    }
  }
  kunjungi(klausa)
  return { kolom, nilai }
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
  it('verifikasi calon lengkap → CAS terverifikasi + audit pendaftaran-verifikasi; status respons dari baris PASCA-CAS (bukan echo input)', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      hasilOwners: [[barisCoo], [barisCalonLengkap], [denganStatus(barisCalonLengkap, 'terverifikasi')]],
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'terverifikasi' })

    expect(hasil).toEqual({ akhir: 'sukses', id: ID_CALON, email: EMAIL_CALON, status: 'terverifikasi' })

    // Satu CAS UPDATE owners + satu INSERT audit.
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

  it('tolak dengan alasan → CAS ditolak + rejection_reason tersimpan + audit details.alasan & hitunganPenolakan (termasuk entry yang sedang ditulis)', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      hasilOwners: [
        [barisCoo],
        [barisCalonLengkap],
        [denganStatus(barisCalonLengkap, 'ditolak', 'Dokumen tidak sah.')],
      ],
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

describe('keputusanCalon — predikat CAS ter-assert (hardening adv#7, AD-11)', () => {
  it('where UPDATE CAS memuat eq(owners.id) & eq(owners.status, diajukan)', async () => {
    const { dbPalsu, klausaWhereUpdate } = buatTxKeputusanPalsu({
      hasilOwners: [[barisCoo], [barisCalonLengkap], [denganStatus(barisCalonLengkap, 'terverifikasi')]],
    })

    await panggil(dbPalsu, { keputusan: 'terverifikasi' })

    // TEPAT satu CAS UPDATE owners, dengan predikat guard race (AD-11).
    expect(klausaWhereUpdate).toHaveLength(1)
    const { kolom, nilai } = uraiKlausaWhere(klausaWhereUpdate[0])
    expect(kolom).toContain('owners.id')
    expect(kolom).toContain('owners.status')
    expect(nilai).toContain(ID_CALON)
    expect(nilai).toContain('diajukan')
  })

  it('CAS kalah race (returning kosong) → status-berubah TANPA audit baru — dievaluasi SEBELUM gerbang kelengkapan', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      // Bacaan kedua TIDAK dikonsumsi — kalah race berhenti sebelum gerbang.
      hasilOwners: [[barisCoo], [barisCalonBelumLengkap]],
      casHasil: [], // cron kedaluwarsa / COO lain menang lebih dulu.
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'terverifikasi' })

    // Profil calon KOSONG pun tetap 409 (bukan 400) — urutan baru CAS-first.
    expect(hasil).toEqual({ akhir: 'status-berubah' })
    expect(update).toHaveLength(1) // CAS dicoba — nol baris ter-update.
    expect(insert).toHaveLength(0) // Tanpa audit baru.
  })
})

describe('keputusanCalon — gerbang kelengkapan PASCA-CAS & asimetri (hardening, AD-8)', () => {
  it('TOCTOU: profil dikosongkan di antara baca dan CAS → sentinel → profil-belum-lengkap + sisaField, TANPA audit (rollback total)', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      // Bacaan pertama LENGKAP; bacaan kedua (pasca-CAS) kosong — PUT
      // /api/profile menyempitkan profil di antara keduanya.
      hasilOwners: [[barisCoo], [barisCalonLengkap], [barisCalonBelumLengkap]],
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'terverifikasi' })

    expect(hasil.akhir).toBe('profil-belum-lengkap')
    if (hasil.akhir === 'profil-belum-lengkap') {
      expect(hasil.sisaField).toContain('fullName')
      expect(hasil.sisaField).toContain('accountNumber')
    }
    // CAS sempat dijalankan lalu transaksi di-ROLLBACK oleh throw sentinel
    // (fake tidak mengamati rollback — yang ter-assert: TIDAK ada tulisan
    // setelah gerbang, sehingga tidak ada audit yang ikut commit).
    expect(update).toHaveLength(1)
    expect(insert).toHaveLength(0)
  })

  it('baris pasca-CAS tetap kosong → profil-belum-lengkap, TANPA audit', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      hasilOwners: [[barisCoo], [barisCalonBelumLengkap], [barisCalonBelumLengkap]],
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'terverifikasi' })

    expect(hasil.akhir).toBe('profil-belum-lengkap')
    if (hasil.akhir === 'profil-belum-lengkap') {
      expect(hasil.sisaField).toContain('fullName')
    }
    expect(update).toHaveLength(1)
    expect(insert).toHaveLength(0)
  })

  it('asimetri gerbang: tolak calon BELUM lengkap → tetap sukses ditolak + audit pendaftaran-penolakan (hanya verifikasi digerbangi)', async () => {
    const { dbPalsu, insert, update } = buatTxKeputusanPalsu({
      hasilOwners: [
        [barisCoo],
        [barisCalonBelumLengkap],
        [denganStatus(barisCalonBelumLengkap, 'ditolak', 'Data tidak dapat dikonfirmasi.')],
      ],
    })

    const hasil = await panggil(dbPalsu, { keputusan: 'ditolak', alasan: 'Data tidak dapat dikonfirmasi.' })

    expect(hasil).toEqual({ akhir: 'sukses', id: ID_CALON, email: EMAIL_CALON, status: 'ditolak' })
    expect(update[0]?.set?.status).toBe('ditolak')
    expect(insert).toHaveLength(1)
    expect(insert[0]?.baris).toEqual({
      action: 'pendaftaran-penolakan',
      actorOwnerId: ID_COO,
      target: `owners:${ID_CALON}`,
      details: {
        email: EMAIL_CALON,
        alasan: 'Data tidak dapat dikonfirmasi.',
        hitunganPenolakan: 1,
      },
    })
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

describe('keputusanCalon — eksistensi & otoritas COO (AD-8)', () => {
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
