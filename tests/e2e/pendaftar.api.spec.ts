/**
 * ATDD — Story 1.6 "Verifikasi & Penolakan Pendaftar oleh COO" (API — matriks
 * I/O spec 1-6):
 * - GET /api/pendaftar: 401 tanpa sesi / 403 non-COO / 200 COO urut
 *   `created_at` terlama dulu dengan field wire kontrak.
 * - POST /api/pendaftar/keputusan: 401/403 gate; verifikasi calon lengkap →
 *   200 + audit `pendaftaran-verifikasi` + landing berikutnya /personal;
 *   verifikasi belum lengkap → 400 PROFILE_INCOMPLETE tanpa mutasi; tolak
 *   tanpa alasan → 400 ALASAN_WAJIB; tolak dengan alasan → 200 + alasan
 *   tersimpan apa adanya + audit `pendaftaran-penolakan` (details.alasan +
 *   details.hitunganPenolakan); tolak calon BELUM lengkap → 200 + audit
 *   (asimetri gerbang ter-pin, hardening 2026-09-22); id tak dikenal → 404
 *   TIDAK_DITEMUKAN; keputusan ganda (status sudah bukan `diajukan`) → 409
 *   STATUS_BERUBAH tanpa audit baru (kontrak CAS AD-11); superRefine
 *   `{terverifikasi, alasan}` → 400 BAD_REQUEST (hardening 2026-09-22);
 *   TOCTOU: profil dikosongkan pasca-seed via PUT parsial → 400
 *   PROFILE_INCOMPLETE + baris tetap `diajukan` TANPA audit (pin integrasi
 *   rollback total pasca-CAS — fake tx unit tidak mengamati rollback DB).
 * - CHECK constraint `owners_ditolak_wajib_rejection_reason` (jalur DB yang
 *   tidak pernah tersentuh handler/service) diuji langsung ke DB lokal via
 *   `cobaTulisDitolakTanpaAlasan` (pola admin-client pendaftar-reset.ts) —
 *   host non-lokal = honest-skip dengan alasan (bukan throw).
 *
 * Persona via `mintSesiPemilik` (coo / calon-*); profil lengkap calon diisi
 * via PUT /api/profile (pola kelengkapan-profil.spec.ts). Cleanup otomatis:
 * fixture `cleanup` me-flush registry email mint (pola cleanup.track).
 * Pembacaan audit mengikuti `nextPage` antar-halaman (DB dev append-only
 * bersama — target bisa jatuh di luar halaman 1).
 */
import { z } from 'zod'
import { faker } from '@faker-js/faker/locale/id_ID'
import { test, expect, log } from '../support/merged-fixtures'
import { mintSesiPemilik } from '../support/helpers/sesi-minting'
import {
  bacaAuditSemuaHalaman,
  emailSintetisUji,
  headerCookieDariMint,
  seedCalonLengkap,
} from '../support/helpers/pendaftar-uji'
import { cobaTulisDitolakTanpaAlasan } from '../support/helpers/pendaftar-reset'
import { PANJANG_MAKS_ALASAN_PENOLAKAN } from '#shared/domain/identity'

/** Status HTTP kontrak matriks I/O. */
const STATUS_OK = 200
const STATUS_BAD_REQUEST = 400
const STATUS_UNAUTHORIZED = 401
const STATUS_FORBIDDEN = 403
const STATUS_NOT_FOUND = 404
const STATUS_CONFLICT = 409

const PATH_PENDAFTAR = '/api/pendaftar'
const PATH_KEPUTUSAN = '/api/pendaftar/keputusan'

/** Hari backdate IDENTIK untuk pasangan pin tie-breaker FIFO (asc owners.id). */
const DIAJUKAN_PADA_IDENTIK = '2026-09-15'

/** Envelope error seragam — kontrak server/utils/api-error.ts. */
const SkemaEnvelopeError = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
})
type EnvelopeError = z.infer<typeof SkemaEnvelopeError>

/** Respons GET /api/pendaftar — wire kontrak spec 1.6. */
const SkemaDaftarPendaftar = z.object({
  data: z.array(z.object({
    id: z.uuid(),
    email: z.string().min(1),
    nama: z.string(),
    createdAt: z.string().min(1),
    profilLengkap: z.boolean(),
    sisaField: z.array(z.string()),
  })),
})
type DaftarPendaftar = z.infer<typeof SkemaDaftarPendaftar>

/** Respons POST /api/pendaftar/keputusan sukses. */
const SkemaKeputusanSukses = z.object({
  id: z.uuid(),
  email: z.string().min(1),
  status: z.enum(['terverifikasi', 'ditolak']),
})
type KeputusanSukses = z.infer<typeof SkemaKeputusanSukses>

/** Respons GET /api/landing (pola landing.api.spec.ts). */
const SkemaLanding = z.union([
  z.object({
    path: z.string().min(1),
    role: z.enum(['coo', 'pemegang_saham', 'tanpa_saham', 'calon_owner']),
  }),
  z.object({ unlinked: z.literal(true) }),
])
type Landing = z.infer<typeof SkemaLanding>

/** Respons GET /api/register/status khusus calon. */
const SkemaStatusPendaftaran = z.object({
  status: z.enum(['diajukan', 'ditolak', 'kedaluwarsa']),
  rejectionReason: z.string(),
})
type StatusPendaftaran = z.infer<typeof SkemaStatusPendaftaran>


test.describe('[P0] Gate /api/pendaftar (AD-8)', () => {
  test('[P0] GET tanpa sesi → envelope 401 seragam', async ({ apiRequest }) => {
    await log.step('GIVEN permintaan GET /api/pendaftar tanpa cookie sesi')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 401 dengan envelope { code, message, details } seragam')
    expect(status).toBe(STATUS_UNAUTHORIZED)
    expect(body.code).toBe('UNAUTHORIZED')
  })

  test('[P0] POST keputusan tanpa sesi → envelope 401 seragam', async ({ apiRequest }) => {
    await log.step('GIVEN permintaan POST /api/pendaftar/keputusan tanpa cookie sesi')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: faker.string.uuid(), keputusan: 'terverifikasi' },
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 401 UNAUTHORIZED')
    expect(status).toBe(STATUS_UNAUTHORIZED)
    expect(body.code).toBe('UNAUTHORIZED')
  })

  test('[P1] GET oleh non-COO (calon) → envelope 403 FORBIDDEN', async ({ apiRequest }) => {
    await log.step('GIVEN sesi calon owner diajukan')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-diajukan',
      email: emailSintetisUji(),
    })

    await log.step('WHEN GET /api/pendaftar dengan sesi calon')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookies),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 403 FORBIDDEN — daftar pendaftar khusus COO')
    expect(status).toBe(STATUS_FORBIDDEN)
    expect(body.code).toBe('FORBIDDEN')
  })

  test('[P1] POST keputusan oleh non-COO (pemegang saham) → envelope 403 FORBIDDEN', async ({ apiRequest }) => {
    await log.step('GIVEN sesi pemegang saham (bukan COO)')
    const cookies = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })

    await log.step('WHEN POST /api/pendaftar/keputusan dengan sesi non-COO')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: faker.string.uuid(), keputusan: 'terverifikasi' },
      headers: headerCookieDariMint(cookies),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 403 FORBIDDEN')
    expect(status).toBe(STATUS_FORBIDDEN)
    expect(body.code).toBe('FORBIDDEN')
  })
})

test.describe('[P0] GET /api/pendaftar — daftar calon untuk COO', () => {
  test('[P0] 200 { data } urut created_at terlama dulu dengan field wire kontrak', async ({ apiRequest }) => {
    await log.step('GIVEN dua calon diajukan dengan waktu pendaftaran berbeda (backdated via diajukanPada)')
    const emailLama = emailSintetisUji()
    const emailBaru = emailSintetisUji()
    await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-diajukan',
      email: emailLama,
      diajukanPada: '2026-09-01',
    })
    await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-diajukan',
      email: emailBaru,
      diajukanPada: '2026-09-20',
    })

    await log.step('AND dua calon lain dengan diajukanPada IDENTIK — pin tie-breaker FIFO (asc owners.id)')
    const emailTiePertama = emailSintetisUji()
    const emailTieKedua = emailSintetisUji()
    await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-diajukan',
      email: emailTiePertama,
      diajukanPada: DIAJUKAN_PADA_IDENTIK,
    })
    await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-diajukan',
      email: emailTieKedua,
      diajukanPada: DIAJUKAN_PADA_IDENTIK,
    })

    await log.step('WHEN COO membuka GET /api/pendaftar, lalu mengulang GET kedua')
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const { status, body } = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    const daftarKedua = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })

    await log.step('THEN 200 — kedua calon tampil, urut terlama dulu, field wire lengkap')
    expect(status).toBe(STATUS_OK)
    const indeksLama = body.data.findIndex(baris => baris.email === emailLama)
    const indeksBaru = body.data.findIndex(baris => baris.email === emailBaru)
    expect(indeksLama).toBeGreaterThanOrEqual(0)
    expect(indeksBaru).toBeGreaterThanOrEqual(0)
    expect(indeksLama).toBeLessThan(indeksBaru)
    for (const baris of body.data.filter(b => b.email === emailLama || b.email === emailBaru)) {
      expect(baris.id).toBeTruthy()
      expect(baris.createdAt).toBeTruthy()
      expect(typeof baris.profilLengkap).toBe('boolean')
      expect(Array.isArray(baris.sisaField)).toBe(true)
    }

    await log.step('AND tie-breaker: pasangan created_at identik terurut sesuai id ASCENDING dan urutan relatifnya STABIL antar-GET')
    const indeksEmail = (data: DaftarPendaftar['data'], email: string) => {
      const indeks = data.findIndex(baris => baris.email === email)
      expect(indeks).toBeGreaterThanOrEqual(0)
      return indeks
    }
    const idTiePertama = body.data.find(baris => baris.email === emailTiePertama)?.id ?? ''
    const idTieKedua = body.data.find(baris => baris.email === emailTieKedua)?.id ?? ''
    expect(idTiePertama).not.toBe('')
    expect(idTieKedua).not.toBe('')

    const indeksTiePertama = indeksEmail(body.data, emailTiePertama)
    const indeksTieKedua = indeksEmail(body.data, emailTieKedua)
    // id lebih kecil wajib lebih dulu — asersi ini GAGAL bila tie-breaker
    // `asc(owners.id)` dihapus (urutan created_at identik jadi arbitrer).
    expect(indeksTiePertama < indeksTieKedua).toBe(idTiePertama < idTieKedua)

    const indeksTiePertamaKedua = indeksEmail(daftarKedua.body.data, emailTiePertama)
    const indeksTieKeduaKedua = indeksEmail(daftarKedua.body.data, emailTieKedua)
    expect(indeksTiePertamaKedua < indeksTieKeduaKedua).toBe(idTiePertama < idTieKedua)
  })
})

test.describe('[P0] POST /api/pendaftar/keputusan — verifikasi', () => {
  test('[P0] verifikasi calon lengkap → 200 terverifikasi + audit pendaftaran-verifikasi + landing berikutnya /personal', async ({ apiRequest }) => {
    await log.step('GIVEN calon diajukan dengan Profil LENGKAP (prasyarat verifikasi terpenuhi)')
    const { email: emailCalon, cookies: cookieCalonAsli } = await seedCalonLengkap(apiRequest)
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const daftar = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    const target = daftar.body.data.find(baris => baris.email === emailCalon)
    expect(target).toBeDefined()
    expect(target?.profilLengkap).toBe(true)

    await log.step('WHEN COO memverifikasi calon tersebut')
    const { status, body } = await apiRequest<KeputusanSukses>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: target?.id, keputusan: 'terverifikasi' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaKeputusanSukses,
    })

    await log.step('THEN 200 — status berubah diajukan → terverifikasi via CAS')
    expect(status).toBe(STATUS_OK)
    expect(body.status).toBe('terverifikasi')
    expect(body.email).toBe(emailCalon)

    await log.step('AND entry audit pendaftaran-verifikasi tercatat (aktor user COO, target owners:<id>)')
    const audit = await bacaAuditSemuaHalaman(apiRequest)
    const entry = audit.find(e => e.action === 'pendaftaran-verifikasi' && e.target === `owners:${target?.id}`)
    expect(entry).toBeDefined()
    expect(entry?.actor.kind).toBe('user')
    expect(entry?.details).toEqual({ email: emailCalon })

    await log.step('AND login berikutnya calon → landing /personal (owner terverifikasi tanpa saham) — SESI ASLI calon dipakai ulang (role dibaca per-request, tanpa mint yang men-upsert status)')
    const landing = await apiRequest<Landing>({
      method: 'GET',
      path: '/api/landing',
      headers: headerCookieDariMint(cookieCalonAsli),
      validateSchema: SkemaLanding,
    })
    expect(landing.body).toEqual({ path: '/personal', role: 'tanpa_saham' })
  })

  test('[P0] verifikasi calon belum lengkap → 400 PROFILE_INCOMPLETE tanpa mutasi status', async ({ apiRequest }) => {
    await log.step('GIVEN calon diajukan TANPA mengisi Profil')
    const emailCalon = emailSintetisUji()
    await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-diajukan',
      email: emailCalon,
    })
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const daftar = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    const target = daftar.body.data.find(baris => baris.email === emailCalon)
    expect(target).toBeDefined()
    expect(target?.profilLengkap).toBe(false)

    await log.step('WHEN COO mencoba memverifikasi calon belum lengkap')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: target?.id, keputusan: 'terverifikasi' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 400 PROFILE_INCOMPLETE dengan details.sisaField non-kosong')
    expect(status).toBe(STATUS_BAD_REQUEST)
    expect(body.code).toBe('PROFILE_INCOMPLETE')
    expect(Array.isArray((body.details as { sisaField?: unknown }).sisaField)).toBe(true)
    expect((body.details as { sisaField: unknown[] }).sisaField.length).toBeGreaterThan(0)

    await log.step('AND status calon TIDAK berubah — masih terdaftar di daftar `diajukan` COO + tanpa audit verifikasi')
    const daftarPasca = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    expect(daftarPasca.body.data.some(baris => baris.email === emailCalon)).toBe(true)
    const auditPasca = await bacaAuditSemuaHalaman(apiRequest)
    const adaAuditVerifikasi = auditPasca.some(
      e => e.action === 'pendaftaran-verifikasi' && e.target === `owners:${target?.id}`,
    )
    expect(adaAuditVerifikasi).toBe(false)
  })

  test('[P0] TOCTOU: profil dikosongkan pasca-seed → verifikasi 400 PROFILE_INCOMPLETE + baris tetap diajukan (rollback total)', async ({ apiRequest }) => {
    // Matriks I/O #1 hardening: PUT /api/profile kini mengizinkan simpan
    // parsial, sehingga calon lengkap bisa mengosongkan field di antara
    // baca dan CAS COO. Gerbang kelengkapan dievaluasi atas baris PASCA-CAS
    // dalam tx — gagal = throw sentinel → ROLLBACK total: status tetap
    // `diajukan`, TANPA audit (fake tx unit tidak mengamati rollback DB
    // nyata — pin integrasi ini di sini).
    await log.step('GIVEN calon diajukan berprofil LENGKAP (seed) + sesi COO')
    const { email: emailCalon, cookies: cookieCalonAsli } = await seedCalonLengkap(apiRequest)
    // COO dengan EMAIL UNIK (preset 'coo' tetap: terverifikasi + tenure
    // aktif): baris COO tetap bersama (`uji.snddash.e2e.coo@…`) dapat
    // dihapus cleanup worker browser-project lain di tengah test (flake
    // DB-dev bersama — kewenangan 403 / redirect-login 200 sesaat); email
    // unik hanya terdaftar di Set worker ini sehingga tidak mungkin
    // di-yank selama test berjalan.
    const cookieCoo = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'coo',
      email: emailSintetisUji(),
    })
    const daftar = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    const target = daftar.body.data.find(baris => baris.email === emailCalon)
    expect(target).toBeDefined()
    expect(target?.profilLengkap).toBe(true)

    await log.step('WHEN calon mengosongkan profilnya sendiri via PUT /api/profile (simpan parsial — body minimal; field tak dikirim ikut dikosongkan) — SESI ASLI calon, bukan re-mint')
    const kosongkan = await apiRequest<{ profileComplete: boolean, remainingFields: string[] }>({
      method: 'PUT',
      path: '/api/profile',
      body: { fullName: '', accountNumber: '' },
      headers: headerCookieDariMint(cookieCalonAsli),
    })
    expect(kosongkan.status).toBe(200)
    expect(kosongkan.body.profileComplete).toBe(false)
    expect(kosongkan.body.remainingFields).toContain('fullName')
    expect(kosongkan.body.remainingFields).toContain('accountNumber')

    await log.step('WHEN COO memverifikasi calon yang kini KOSONG (CAS menang atas status, gerbang kelengkapan pasca-CAS yang menolak)')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: target?.id, keputusan: 'terverifikasi' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 400 PROFILE_INCOMPLETE — details.sisaField memuat field yang dikosongkan')
    expect(status).toBe(STATUS_BAD_REQUEST)
    expect(body.code).toBe('PROFILE_INCOMPLETE')
    const sisaField = (body.details as { sisaField?: unknown }).sisaField
    expect(Array.isArray(sisaField)).toBe(true)
    expect(sisaField as string[]).toContain('fullName')
    expect(sisaField as string[]).toContain('accountNumber')

    await log.step('AND INTI PIN ROLLBACK: calon MASIH terdaftar `diajukan` dengan profilLengkap=false — bukti rollback total pasca-CAS (tidak ada partial-commit)')
    const daftarPasca = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    const barisPasca = daftarPasca.body.data.find(baris => baris.email === emailCalon)
    expect(barisPasca).toBeDefined()
    expect(barisPasca?.profilLengkap).toBe(false)

    await log.step('AND TANPA entry audit pendaftaran-verifikasi untuk owners:<id> (baca lintas-halaman — audit tidak ikut commit)')
    // Satu retry saat helper lempar: bacaan audit self-mint baris COO tetap
    // yang bisa di-yank worker lain di tengah baca (302 → login) — mint
    // ulang internal percobaan kedua memperbaiki barisnya (flake dikenal,
    // bukan sinyal produk).
    let auditPasca: Awaited<ReturnType<typeof bacaAuditSemuaHalaman>>
    try {
      auditPasca = await bacaAuditSemuaHalaman(apiRequest)
    } catch {
      auditPasca = await bacaAuditSemuaHalaman(apiRequest)
    }
    const adaAuditVerifikasi = auditPasca.some(
      e => e.action === 'pendaftaran-verifikasi' && e.target === `owners:${target?.id}`,
    )
    expect(adaAuditVerifikasi).toBe(false)
  })
})

test.describe('[P0] POST /api/pendaftar/keputusan — penolakan', () => {
  test('[P0] tolak tanpa alasan / whitespace → 400 ALASAN_WAJIB tanpa mutasi', async ({ apiRequest }) => {
    await log.step('GIVEN calon diajukan (profil lengkap — penolakan tetap sah untuk calon mana pun)')
    const { email: emailCalon } = await seedCalonLengkap(apiRequest)
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const daftar = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    const target = daftar.body.data.find(baris => baris.email === emailCalon)
    expect(target).toBeDefined()

    await log.step('WHEN COO menolak tanpa alasan, lalu dengan alasan whitespace saja')
    const tanpaAlasan = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: target?.id, keputusan: 'ditolak' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })
    const alasanSpasi = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: target?.id, keputusan: 'ditolak', alasan: '   ' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN keduanya 400 ALASAN_WAJIB')
    expect(tanpaAlasan.status).toBe(STATUS_BAD_REQUEST)
    expect(tanpaAlasan.body.code).toBe('ALASAN_WAJIB')
    expect(alasanSpasi.status).toBe(STATUS_BAD_REQUEST)
    expect(alasanSpasi.body.code).toBe('ALASAN_WAJIB')

    await log.step('AND status calon tetap diajukan — masih terdaftar di daftar COO + tanpa audit penolakan')
    const daftarPasca = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    expect(daftarPasca.body.data.some(baris => baris.email === emailCalon)).toBe(true)
    const auditPasca = await bacaAuditSemuaHalaman(apiRequest)
    const adaAuditPenolakan = auditPasca.some(
      e => e.action === 'pendaftaran-penolakan' && e.target === `owners:${target?.id}`,
    )
    expect(adaAuditPenolakan).toBe(false)
  })

  test('[P0] tolak calon BELUM lengkap (profil kosong) → 200 ditolak + audit pendaftaran-penolakan (asimetri gerbang — hanya verifikasi digerbangi)', async ({ apiRequest }) => {
    await log.step('GIVEN calon diajukan TANPA mengisi Profil (mint saja — tanpa PUT /api/profile)')
    const emailCalon = emailSintetisUji()
    await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-diajukan',
      email: emailCalon,
    })
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const daftar = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    const target = daftar.body.data.find(baris => baris.email === emailCalon)
    expect(target).toBeDefined()
    expect(target?.profilLengkap).toBe(false)

    await log.step('WHEN COO menolak calon belum lengkap dengan alasan')
    const alasanCoo = `Profil tidak pernah dilengkapi (${faker.string.alphanumeric(4)}).`
    const { status, body } = await apiRequest<KeputusanSukses>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: target?.id, keputusan: 'ditolak', alasan: alasanCoo },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaKeputusanSukses,
    })

    await log.step('THEN 200 ditolak — penolakan TIDAK digerbangi kelengkapan (asimetri ter-pin)')
    expect(status).toBe(STATUS_OK)
    expect(body.status).toBe('ditolak')

    await log.step('AND entry audit pendaftaran-penolakan tercatat dengan details.alasan')
    const audit = await bacaAuditSemuaHalaman(apiRequest)
    const entry = audit.find(e => e.action === 'pendaftaran-penolakan' && e.target === `owners:${target?.id}`)
    expect(entry).toBeDefined()
    expect(entry?.details.alasan).toBe(alasanCoo)
  })

  test('[P0] tolak dengan alasan → 200 ditolak + alasan tersimpan apa adanya + audit pendaftaran-penolakan (alasan + hitunganPenolakan)', async ({ apiRequest }) => {
    await log.step('GIVEN calon diajukan dan COO siap menolak')
    const { email: emailCalon, cookies: cookieCalonAsli } = await seedCalonLengkap(apiRequest)
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const daftar = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    const target = daftar.body.data.find(baris => baris.email === emailCalon)
    expect(target).toBeDefined()
    const alasanCoo = `Data rekening perlu diperiksa ulang (${faker.string.alphanumeric(4)}).`

    await log.step('WHEN COO menolak dengan alasan eksplisit')
    const { status, body } = await apiRequest<KeputusanSukses>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: target?.id, keputusan: 'ditolak', alasan: alasanCoo },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaKeputusanSukses,
    })

    await log.step('THEN 200 — status ditolak')
    expect(status).toBe(STATUS_OK)
    expect(body.status).toBe('ditolak')

    await log.step('AND alasan tampil APA ADANYA ke pendaftar via /api/register/status — SESI ASLI calon (ditolak tetap calon_owner; role dibaca per-request, tanpa mint yang men-upsert)')
    const statusCalon = await apiRequest<StatusPendaftaran>({
      method: 'GET',
      path: '/api/register/status',
      headers: headerCookieDariMint(cookieCalonAsli),
      validateSchema: SkemaStatusPendaftaran,
    })
    expect(statusCalon.body.status).toBe('ditolak')
    expect(statusCalon.body.rejectionReason).toBe(alasanCoo)

    await log.step('AND entry audit pendaftaran-penolakan memuat details.alasan verbatim + details.hitunganPenolakan >= 1')
    const audit = await bacaAuditSemuaHalaman(apiRequest)
    const entry = audit.find(e => e.action === 'pendaftaran-penolakan' && e.target === `owners:${target?.id}`)
    expect(entry).toBeDefined()
    expect(entry?.actor.kind).toBe('user')
    expect(entry?.details.alasan).toBe(alasanCoo)
    expect(typeof entry?.details.hitunganPenolakan).toBe('number')
    expect(entry?.details.hitunganPenolakan as number).toBeGreaterThanOrEqual(1)
  })
})

test.describe('[P0] POST /api/pendaftar/keputusan — id tak dikenal & race CAS (AD-11)', () => {
  test('[P0] id tak dikenal → 404 TIDAK_DITEMUKAN envelope', async ({ apiRequest }) => {
    await log.step('GIVEN sesi COO dan id acak yang tidak ada di DB')
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })

    await log.step('WHEN POST keputusan dengan id tak dikenal')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: faker.string.uuid(), keputusan: 'terverifikasi' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 404 TIDAK_DITEMUKAN')
    expect(status).toBe(STATUS_NOT_FOUND)
    expect(body.code).toBe('TIDAK_DITEMUKAN')
  })

  test('[P0] keputusan ganda (status sudah bukan diajukan) → 409 STATUS_BERUBAH tanpa audit baru', async ({ apiRequest }) => {
    await log.step('GIVEN calon lengkap yang sudah DIVERIFIKASI sekali (keputusan pertama menang CAS)')
    const { email: emailCalon } = await seedCalonLengkap(apiRequest)
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const daftar = await apiRequest<DaftarPendaftar>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    const target = daftar.body.data.find(baris => baris.email === emailCalon)
    expect(target).toBeDefined()
    const pertama = await apiRequest<KeputusanSukses>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: target?.id, keputusan: 'terverifikasi' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaKeputusanSukses,
    })
    expect(pertama.status).toBe(STATUS_OK)

    await log.step('WHEN keputusan kedua dikirim untuk calon yang sama (kalah race — status sudah bukan diajukan)')
    const kedua = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: target?.id, keputusan: 'terverifikasi' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 409 STATUS_BERUBAH — kontrak CAS satu penulis (AD-11)')
    expect(kedua.status).toBe(STATUS_CONFLICT)
    expect(kedua.body.code).toBe('STATUS_BERUBAH')

    await log.step('AND TANPA audit baru — tepat satu entry pendaftaran-verifikasi untuk owner tsb')
    const audit = await bacaAuditSemuaHalaman(apiRequest)
    const entries = audit.filter(e => e.action === 'pendaftaran-verifikasi' && e.target === `owners:${target?.id}`)
    expect(entries).toHaveLength(1)
  })

  test('[P1] superRefine: alasan pada keputusan terverifikasi → 400 BAD_REQUEST dengan issue pada alasan (tidak sampai service)', async ({ apiRequest }) => {
    await log.step('GIVEN sesi COO dan id uuid valid')
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })

    await log.step('WHEN POST { keputusan: "terverifikasi", alasan: "..." } — alasan diposkan bersama verifikasi')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: faker.string.uuid(), keputusan: 'terverifikasi', alasan: 'alasan tidak relevan' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 400 BAD_REQUEST — superRefine menolak (issue path alasan), service tidak pernah dijalankan')
    expect(status).toBe(STATUS_BAD_REQUEST)
    expect(body.code).toBe('BAD_REQUEST')
    const masalah = (body.details as { masalah?: unknown }).masalah
    expect(Array.isArray(masalah)).toBe(true)
    expect((masalah as string[]).some(teks => teks.toLowerCase().includes('alasan'))).toBe(true)
  })

  test('[P1] body tidak valid (id bukan uuid / keputusan asing / alasan terlalu panjang) → 400 BAD_REQUEST envelope', async ({ apiRequest }) => {
    await log.step('GIVEN sesi COO')
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })

    await log.step('WHEN POST keputusan dengan id bukan uuid, keputusan di luar enum, lalu alasan melewati batas PANJANG_MAKS_ALASAN_PENOLAKAN')
    const idRusak = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: 'bukan-uuid', keputusan: 'terverifikasi' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })
    const keputusanAsing = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: faker.string.uuid(), keputusan: 'kedaluwarsa' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })
    const alasanKebanyakan = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: faker.string.uuid(), keputusan: 'ditolak', alasan: 'x'.repeat(PANJANG_MAKS_ALASAN_PENOLAKAN + 1) },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN semuanya 400 BAD_REQUEST')
    expect(idRusak.status).toBe(STATUS_BAD_REQUEST)
    expect(idRusak.body.code).toBe('BAD_REQUEST')
    expect(keputusanAsing.status).toBe(STATUS_BAD_REQUEST)
    expect(keputusanAsing.body.code).toBe('BAD_REQUEST')
    expect(alasanKebanyakan.status).toBe(STATUS_BAD_REQUEST)
    expect(alasanKebanyakan.body.code).toBe('BAD_REQUEST')
  })
})

test.describe('[P1] CHECK constraint DB — penolakan wajib beralasan (jalur DB murni)', () => {
  // Satu-satunya cakupan ber-DB untuk `owners_ditolak_wajib_rejection_reason`:
  // handler/service selalu menahan tulisan invalid sebelum menyentuh DB, maka
  // constraint diuji langsung via klien postgres mentah pada DB lokal yang
  // sudah di-migrate (pola admin-client pendaftar-reset.ts). Tulisan invalid
  // tidak pernah commit — tidak perlu cleanup.
  test('[P1] INSERT `ditolak` tanpa alasan (NULL) dan alasan blank → keduanya gagal 23514', async () => {
    const hasil = await cobaTulisDitolakTanpaAlasan()

    // Honest-skip (hardening adv#10+edge#4): host DB uji non-lokal TIDAK
    // me-throw — helper mengembalikan alasan, test dilewati secara jujur.
    if (!hasil.ok) {
      test.skip(true, hasil.alasan)
      return
    }

    await log.step('GIVEN DB lokal dengan migrasi CHECK constraint ter-apply')

    await log.step('THEN INSERT ditolak dengan rejection_reason NULL maupun blank sama-sama ditolak constraint (23514)')
    expect(hasil.kodeAlasanNull).toBe('23514')
    expect(hasil.kodeAlasanBlank).toBe('23514')
  })
})

test.describe('[P0] GET /api/pendaftar/:id — detail data pendaftar (penyempurnaan 2026-09-23)', () => {
  test('[P1] tanpa sesi → 401 envelope', async ({ apiRequest }) => {
    await log.step('GIVEN GET detail dengan id acak tanpa cookie sesi')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: `${PATH_PENDAFTAR}/${faker.string.uuid()}`,
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 401 UNAUTHORIZED')
    expect(status).toBe(STATUS_UNAUTHORIZED)
    expect(body.code).toBe('UNAUTHORIZED')
  })

  test('[P1] non-COO (calon) → 403 envelope', async ({ apiRequest }) => {
    await log.step('GIVEN sesi calon owner')
    const cookies = await mintSesiPemilik(apiRequest, {
      userIdentifier: 'calon-diajukan',
      email: emailSintetisUji(),
    })

    await log.step('WHEN GET detail dengan sesi calon')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: `${PATH_PENDAFTAR}/${faker.string.uuid()}`,
      headers: headerCookieDariMint(cookies),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 403 FORBIDDEN — detail khusus COO')
    expect(status).toBe(STATUS_FORBIDDEN)
    expect(body.code).toBe('FORBIDDEN')
  })

  test('[P1] id bukan uuid → 400 BAD_REQUEST envelope', async ({ apiRequest }) => {
    await log.step('GIVEN sesi COO')
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })

    await log.step('WHEN GET detail dengan id bukan uuid')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: `${PATH_PENDAFTAR}/bukan-uuid`,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 400 BAD_REQUEST')
    expect(status).toBe(STATUS_BAD_REQUEST)
    expect(body.code).toBe('BAD_REQUEST')
  })

  test('[P0] id tak dikenal → 404 TIDAK_DITEMUKAN envelope', async ({ apiRequest }) => {
    await log.step('GIVEN sesi COO dan id acak yang tidak ada di DB')
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })

    await log.step('WHEN GET detail dengan id tak dikenal')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: `${PATH_PENDAFTAR}/${faker.string.uuid()}`,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })

    await log.step('THEN 404 TIDAK_DITEMUKAN')
    expect(status).toBe(STATUS_NOT_FOUND)
    expect(body.code).toBe('TIDAK_DITEMUKAN')
  })

  test('[P0] detail calon diajukan → 200 seluruh isian (bentuk wire profile); pasca-verifikasi → 404', async ({ apiRequest }) => {
    await log.step('GIVEN calon diajukan berprofil LENGKAP tersimpan')
    const { email } = await seedCalonLengkap(apiRequest)
    const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const daftar = await apiRequest<{ data: Array<{ id: string, email: string }> }>({
      method: 'GET',
      path: PATH_PENDAFTAR,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaDaftarPendaftar,
    })
    const target = daftar.body.data.find(baris => baris.email === email)
    expect(target).toBeDefined()

    await log.step('WHEN COO membuka GET /api/pendaftar/:id')
    const { status, body } = await apiRequest<Record<string, unknown>>({
      method: 'GET',
      path: `${PATH_PENDAFTAR}/${target?.id}`,
      headers: headerCookieDariMint(cookieCoo),
    })

    await log.step('THEN 200 — seluruh isian wire profile terbaca (bentuk PERSIS GET /api/profile)')
    expect(status).toBe(STATUS_OK)
    expect(body).toMatchObject({
      id: target?.id,
      email,
      status: 'diajukan',
      bankName: 'BCA',
      profilLengkap: true,
      sisaField: [],
    })
    expect(typeof body.accountNumber).toBe('string')
    expect((body.accountNumber as string).length).toBeGreaterThan(0)
    expect(typeof body.emergencyContactName).toBe('string')

    await log.step('AND pasca-verifikasi (status bukan diajukan) → 404 TIDAK_DITEMUKAN')
    const verifikasi = await apiRequest<KeputusanSukses>({
      method: 'POST',
      path: PATH_KEPUTUSAN,
      body: { id: target?.id, keputusan: 'terverifikasi' },
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaKeputusanSukses,
    })
    expect(verifikasi.status).toBe(STATUS_OK)

    const pasca = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: `${PATH_PENDAFTAR}/${target?.id}`,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaEnvelopeError,
    })
    expect(pasca.status).toBe(STATUS_NOT_FOUND)
    expect(pasca.body.code).toBe('TIDAK_DITEMUKAN')
  })
})
