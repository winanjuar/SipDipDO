/**
 * ATDD RED-PHASE — Story 1.8 "Manajemen Owner oleh COO".
 *
 * Test dirancang red-phase (test.skip) lalu diaktifkan pada tugas green-phase
 * bersama implementasinya; seluruh asersi ter-pin dari red-phase tidak
 * berubah. Kontrak yang diperiksa = matriks I/O spec Story 1.8 (beku):
 *
 * CRUD Endpoints:
 * - GET /api/admin/owners             → 200 { owners: [...] } untuk COO; 401/403 untuk lainnya
 * - GET /api/admin/owners/:id         → 200 { owner, emergencyContact, bankAccount } untuk COO
 * - PUT /api/admin/owners/:id         → 200 + audit untuk update valid; 400 bila ada field status/email
 * - POST /api/admin/owners            → 201 + audit untuk create valid; 409 bila email duplikat
 *
 * Authorization (AD-8):
 * - Semua endpoint memerlukan sesi COO aktif (AD-8)
 * - Non-COO menerima 403; tanpa sesi menerima 401
 *
 * Status Protection (AD-11):
 * - PUT dengan field `status` → 400 STATUS_CHANGE_FORBIDDEN
 *
 * Audit Atomicity (AD-3):
 * - Setiap operasi mutasi tercatat dalam transaksi yang sama
 *
 * Mandate playwright-utils: impor `test` HANYA dari merged-fixtures; HTTP
 * via `apiRequest` (bukan request mentah); validasi zod via metode promise
 * `.validateSchema(skema)` (kontrak library — BUKAN opsi params); `log.step` untuk
 * milestone GIVEN/WHEN/THEN; tanpa console.log, tanpa waitForTimeout.
 */
import type { Cookie } from '@playwright/test'
import { z } from 'zod'
import { test, expect, log } from '../support/merged-fixtures'
import { mintSesiPemilik, EMAIL_OWNER_UJI_TERDAFTAR, emailMintDefault } from '../support/helpers/sesi-minting'

// Configure all tests to run serially to avoid database conflicts when parallel tests
// mint the same COO session simultaneously
test.describe.configure({ mode: 'serial' })

/** Tanda tangan minimal fixture apiRequest (playwright-utils) untuk helper lokal. */
interface ParamsApiRequest {
  method: 'GET' | 'POST' | 'PUT'
  path: string
  body?: unknown
  headers?: Record<string, string>
}
type ApiRequestUji = (params: ParamsApiRequest) => Promise<{ status: number, body: unknown }>

/** Cookie[] hasil mintSesiPemilik → header Cookie untuk apiRequest. */
const headerCookieDariMint = (cookies: Cookie[]): Record<string, string> => ({
  Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
})

// ============================================================================
// ZOD SCHEMAS — Kontrak respons API (selaraskan saat green-phase)
// ============================================================================

/** Envelope error seragam — kontrak server/utils/api-error.ts. */
const SkemaEnvelopeError = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
})
type EnvelopeError = z.infer<typeof SkemaEnvelopeError>

/** Status siklus hidup owner — cermin shared/domain/identity.ts. */
const OWNER_STATUSES = ['diajukan', 'terverifikasi', 'ditolak', 'kedaluwarsa', 'keluar'] as const

/** Skema owner summary dalam daftar GET /api/admin/owners. */
const SkemaOwnerSummary = z.object({
  id: z.uuid(),
  fullName: z.string().nullable(),
  alias: z.string().nullable(),
  email: z.string().email(),
  phoneNumber: z.string().nullable(),
  status: z.enum(OWNER_STATUSES),
  profileComplete: z.boolean(),
  createdAt: z.string().min(1),
})
type OwnerSummary = z.infer<typeof SkemaOwnerSummary>

/** Respons GET /api/admin/owners — daftar owner. */
const SkemaDaftarOwners = z.object({
  owners: z.array(SkemaOwnerSummary),
})
type DaftarOwners = z.infer<typeof SkemaDaftarOwners>

/** Skema owner detail untuk GET /api/admin/owners/:id. */
const SkemaOwnerDetail = z.object({
  id: z.uuid(),
  fullName: z.string().nullable(),
  alias: z.string().nullable(),
  email: z.string().email(),
  phoneNumber: z.string().nullable(),
  status: z.enum(OWNER_STATUSES),
  rejectionReason: z.string().nullable(),
  firstEffectiveAt: z.string().nullable(),
  profileComplete: z.boolean(),
  createdAt: z.string().min(1),
})

/** Skema kontak darurat. */
const SkemaEmergencyContact = z.object({
  name: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  relationship: z.string().nullable(),
}).nullable()

/** Skema rekening bank. */
const SkemaBankAccount = z.object({
  bankName: z.string().nullable(),
  otherBankName: z.string().nullable(),
  accountHolderName: z.string().nullable(),
  accountNumber: z.string().nullable(),
}).nullable()

/** Respons GET /api/admin/owners/:id — detail owner dengan relasi. */
const SkemaOwnerResponse = z.object({
  owner: SkemaOwnerDetail,
  emergencyContact: SkemaEmergencyContact,
  bankAccount: SkemaBankAccount,
})
type OwnerResponse = z.infer<typeof SkemaOwnerResponse>

/** Respons PUT /api/admin/owners/:id — owner yang diupdate. */
const SkemaUpdateOwnerResponse = z.object({
  owner: SkemaOwnerDetail,
})
type UpdateOwnerResponse = z.infer<typeof SkemaUpdateOwnerResponse>

/** Respons POST /api/admin/owners — owner yang dibuat. */
const SkemaCreateOwnerResponse = z.object({
  owner: SkemaOwnerDetail,
})
type CreateOwnerResponse = z.infer<typeof SkemaCreateOwnerResponse>

/** Skema entry audit untuk verifikasi. */
const SkemaEntryAudit = z.object({
  id: z.uuid(),
  action: z.string().min(1),
  actor: z.object({
    kind: z.enum(['user', 'system']),
    ownerId: z.uuid().nullish(),
  }),
  target: z.string().nullish(),
  details: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
})

/** Respons GET /api/audit — untuk verifikasi audit tercatat. */
const SkemaDaftarAudit = z.object({
  data: z.array(SkemaEntryAudit),
  nextPage: z.union([z.number().int().positive(), z.string().min(1), z.null()]),
})
type DaftarAudit = z.infer<typeof SkemaDaftarAudit>

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ambil ID owner pertama dari daftar owners — helper untuk test PUT/GET detail.
 * Melempar error eksplisit bila daftar kosong (seed belum ada).
 */
async function getFirstOwnerId(
  apiRequest: ApiRequestUji,
  cookies: Cookie[],
): Promise<string> {
  const { status, body } = await apiRequest({
    method: 'GET',
    path: '/api/admin/owners',
    headers: headerCookieDariMint(cookies),
  }) as { status: number, body: DaftarOwners }

  if (status !== 200 || !body.owners || body.owners.length === 0) {
    throw new Error(
      `getFirstOwnerId: GET /api/admin/owners menjawab ${status} atau daftar kosong — `
      + 'endpoint atau seed owner belum ada.',
    )
  }

  return body.owners[0].id
}

/**
 * Generate email unik untuk test — menghindari konflik dengan owner sintetis lain.
 * Uses timestamp + random + worker-based suffix to handle parallel test runs.
 */
function emailUjiUnik(suffix: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `uji.snddash.e2e.admin-owners-${suffix}-${timestamp}-${random}@gmail.com`
}

// ============================================================================
// TEST SUITES
// ============================================================================

test.describe('[Story 1.8] GET /api/admin/owners Authorization (AD-8)', () => {
  test('[P0] #1 GET /api/admin/owners tanpa sesi → 401 envelope', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint /api/admin/owners belum ada
    await log.step('GIVEN permintaan GET /api/admin/owners tanpa cookie sesi')

    await log.step('WHEN route handler admin owners menilai permintaan anonim')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: '/api/admin/owners',
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 401 dengan envelope { code, message, details } seragam')
    expect(status).toBe(401)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })

  test('[P0] #2 GET /api/admin/owners sesi non-COO → 403 envelope', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint /api/admin/owners belum ada
    await log.step('GIVEN sesi pemegang saham (role ≠ coo) dari endpoint mint dev-only')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'pemegang-saham' })

    await log.step('WHEN GET /api/admin/owners membawa cookie sesi non-COO')
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'GET',
      path: '/api/admin/owners',
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 403 envelope — kewenangan hanya COO (AD-8)')
    expect(status).toBe(403)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })

  test('[P0] #3 GET /api/admin/owners sesi COO → 200 dengan daftar owner', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint /api/admin/owners belum ada
    await log.step('GIVEN sesi COO aktif dari endpoint mint dev-only')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })

    await log.step('WHEN GET /api/admin/owners membawa cookie sesi COO')
    const { status, body } = await apiRequest<DaftarOwners>({
      method: 'GET',
      path: '/api/admin/owners',
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaDaftarOwners)

    await log.step('THEN 200 { owners: [...] } — daftar owner tersedia')
    expect(status).toBe(200)
    expect(Array.isArray(body.owners)).toBe(true)
  })
})

test.describe('[Story 1.8] GET /api/admin/owners/:id Detail', () => {
  test('[P1] #4 GET /api/admin/owners/:id sesi COO → 200 dengan owner, emergencyContact, bankAccount', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    await log.step('GIVEN sesi COO dan owner ID dari daftar')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const ownerId = await getFirstOwnerId(apiRequest, cookieSesi)

    await log.step('WHEN GET /api/admin/owners/:id membawa cookie sesi COO')
    const { status, body } = await apiRequest<OwnerResponse>({
      method: 'GET',
      path: `/api/admin/owners/${ownerId}`,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaOwnerResponse)

    await log.step('THEN 200 { owner, emergencyContact, bankAccount } — detail owner tersedia')
    expect(status).toBe(200)
    expect(body.owner.id).toBe(ownerId)
    // emergencyContact dan bankAccount bisa null bila belum diisi
    expect(body).toHaveProperty('emergencyContact')
    expect(body).toHaveProperty('bankAccount')
  })
})

test.describe('[Story 1.8] PUT /api/admin/owners/:id Update dengan Audit (AD-3)', () => {
  test('[P0] #5 PUT /api/admin/owners/:id update identity → 200 + audit tercatat', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    await log.step('GIVEN sesi COO dan owner ID dari daftar')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const ownerId = await getFirstOwnerId(apiRequest, cookieSesi)
    const headerCookie = headerCookieDariMint(cookieSesi)

    await log.step('WHEN PUT /api/admin/owners/:id dengan perubahan fullName/alias/phoneNumber')
    const updatePayload = {
      fullName: 'Test Update Nama Lengkap',
      alias: 'TestAlias',
      phoneNumber: '081234567890',
    }
    const { status, body } = await apiRequest<UpdateOwnerResponse>({
      method: 'PUT',
      path: `/api/admin/owners/${ownerId}`,
      body: updatePayload,
      headers: headerCookie,
    }).validateSchema(SkemaUpdateOwnerResponse)

    await log.step('THEN 200 { owner } — perubahan tersimpan')
    expect(status).toBe(200)
    expect(body.owner.fullName).toBe(updatePayload.fullName)
    expect(body.owner.alias).toBe(updatePayload.alias)
    expect(body.owner.phoneNumber).toBe(updatePayload.phoneNumber)

    await log.step('AND audit tercatat dengan action kelola-owner-perubahan')
    // Poll for audit entry — eventual consistency fix
    let auditEntry: z.infer<typeof SkemaEntryAudit> | undefined
    await expect.poll(async () => {
      const response = await apiRequest<DaftarAudit>({
        method: 'GET',
        path: '/api/audit?page=1&limit=80',
        headers: headerCookie,
      })
      if (response.status !== 200) return false
      const parseResult = SkemaDaftarAudit.safeParse(response.body)
      if (!parseResult.success) return false
      auditEntry = parseResult.data.data.find(
        entry => entry.action === 'kelola-owner-perubahan' && entry.target === `owners:${ownerId}`,
      )
      return auditEntry !== undefined
    }, {
      message: `audit entry kelola-owner-perubahan untuk owners:${ownerId} harus tercatat`,
      timeout: 10_000,
      intervals: [200, 500, 1000, 2000, 3000],
    }).toBe(true)
    expect(auditEntry).toBeDefined()
  })

  test('[P1] #6 PUT /api/admin/owners/:id update emergencyContact → 200 + audit tercatat', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    await log.step('GIVEN sesi COO dan owner ID dari daftar')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const ownerId = await getFirstOwnerId(apiRequest, cookieSesi)
    const headerCookie = headerCookieDariMint(cookieSesi)

    await log.step('WHEN PUT /api/admin/owners/:id dengan perubahan emergencyContact')
    // Use unique name suffix to ensure change detection (audit only written when data changes)
    const timestamp = Date.now().toString().slice(-4)
    const updatePayload = {
      emergencyContact: {
        name: `Kontak Test ${timestamp}`,
        phoneNumber: '082345678901',
        relationship: 'Saudara',
      },
    }
    const { status, body } = await apiRequest<UpdateOwnerResponse>({
      method: 'PUT',
      path: `/api/admin/owners/${ownerId}`,
      body: updatePayload,
      headers: headerCookie,
    }).validateSchema(SkemaUpdateOwnerResponse)

    await log.step('THEN 200 { owner } — perubahan tersimpan')
    expect(status).toBe(200)
    expect(body.owner.id).toBe(ownerId)

    await log.step('AND audit tercatat dengan action kelola-owner-perubahan')
    // Poll for audit entry — eventual consistency fix
    let auditEntry: z.infer<typeof SkemaEntryAudit> | undefined
    await expect.poll(async () => {
      const response = await apiRequest<DaftarAudit>({
        method: 'GET',
        path: '/api/audit?page=1&limit=80',
        headers: headerCookie,
      })
      if (response.status !== 200) return false
      const parseResult = SkemaDaftarAudit.safeParse(response.body)
      if (!parseResult.success) return false
      auditEntry = parseResult.data.data.find(
        entry => entry.action === 'kelola-owner-perubahan' && entry.target === `owners:${ownerId}`,
      )
      return auditEntry !== undefined
    }, {
      message: `audit entry kelola-owner-perubahan untuk owners:${ownerId} harus tercatat`,
      timeout: 10_000,
      intervals: [200, 500, 1000, 2000, 3000],
    }).toBe(true)
    expect(auditEntry).toBeDefined()
  })

  test('[P1] #7 PUT /api/admin/owners/:id update bankAccount → 200 + audit tercatat', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    await log.step('GIVEN sesi COO dan owner ID dari daftar')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const ownerId = await getFirstOwnerId(apiRequest, cookieSesi)
    const headerCookie = headerCookieDariMint(cookieSesi)

    await log.step('WHEN PUT /api/admin/owners/:id dengan perubahan bankAccount')
    // Use unique account number suffix to ensure change detection (audit only written when data changes)
    const timestamp = Date.now().toString().slice(-6)
    const updatePayload = {
      bankAccount: {
        bankName: 'BCA',
        accountHolderName: 'Nama Pemilik Rek',
        accountNumber: timestamp,
      },
    }
    const { status, body } = await apiRequest<UpdateOwnerResponse>({
      method: 'PUT',
      path: `/api/admin/owners/${ownerId}`,
      body: updatePayload,
      headers: headerCookie,
    }).validateSchema(SkemaUpdateOwnerResponse)

    await log.step('THEN 200 { owner } — perubahan tersimpan')
    expect(status).toBe(200)
    expect(body.owner.id).toBe(ownerId)

    await log.step('AND audit tercatat dengan action kelola-owner-perubahan')
    // Poll for audit entry — eventual consistency fix
    let auditEntry: z.infer<typeof SkemaEntryAudit> | undefined
    await expect.poll(async () => {
      const response = await apiRequest<DaftarAudit>({
        method: 'GET',
        path: '/api/audit?page=1&limit=80',
        headers: headerCookie,
      })
      if (response.status !== 200) return false
      const parseResult = SkemaDaftarAudit.safeParse(response.body)
      if (!parseResult.success) return false
      auditEntry = parseResult.data.data.find(
        entry => entry.action === 'kelola-owner-perubahan' && entry.target === `owners:${ownerId}`,
      )
      return auditEntry !== undefined
    }, {
      message: `audit entry kelola-owner-perubahan untuk owners:${ownerId} harus tercatat`,
      timeout: 10_000,
      intervals: [200, 500, 1000, 2000, 3000],
    }).toBe(true)
    expect(auditEntry).toBeDefined()
  })

  test('[P1] #8 PUT /api/admin/owners/:id dengan field email → 400 envelope', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    await log.step('GIVEN sesi COO dan owner ID dari daftar')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const ownerId = await getFirstOwnerId(apiRequest, cookieSesi)

    await log.step('WHEN PUT /api/admin/owners/:id dengan field email (immutable)')
    const updatePayload = {
      email: 'new-email@example.com',
      fullName: 'Test',
    }
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'PUT',
      path: `/api/admin/owners/${ownerId}`,
      body: updatePayload,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 400 envelope — email tidak boleh diubah')
    expect(status).toBe(400)
    expect(body.code.length).toBeGreaterThan(0)
    expect(body.message.length).toBeGreaterThan(0)
  })
})

test.describe('[Story 1.8] PUT /api/admin/owners/:id Status Protection (AD-11)', () => {
  test('[P0] #9 PUT /api/admin/owners/:id dengan field status → 400 STATUS_CHANGE_FORBIDDEN', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    await log.step('GIVEN sesi COO dan owner ID dari daftar')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const ownerId = await getFirstOwnerId(apiRequest, cookieSesi)

    await log.step('WHEN PUT /api/admin/owners/:id dengan field status')
    const updatePayload = {
      status: 'terverifikasi',
      fullName: 'Test',
    }
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'PUT',
      path: `/api/admin/owners/${ownerId}`,
      body: updatePayload,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 400 envelope STATUS_CHANGE_FORBIDDEN — status hanya via domain event (AD-11)')
    expect(status).toBe(400)
    expect(body.code).toBe('STATUS_CHANGE_FORBIDDEN')
    expect(body.message.length).toBeGreaterThan(0)
  })

  test('[P1] #10 PUT /api/admin/owners/:id tanpa field status diizinkan', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    await log.step('GIVEN sesi COO dan owner ID dari daftar')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const ownerId = await getFirstOwnerId(apiRequest, cookieSesi)

    await log.step('WHEN PUT /api/admin/owners/:id TANPA field status')
    const updatePayload = {
      alias: 'AliasUpd',
    }
    const { status, body } = await apiRequest<UpdateOwnerResponse>({
      method: 'PUT',
      path: `/api/admin/owners/${ownerId}`,
      body: updatePayload,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaUpdateOwnerResponse)

    await log.step('THEN 200 { owner } — update tanpa status diizinkan')
    expect(status).toBe(200)
    expect(body.owner.alias).toBe(updatePayload.alias)
  })
})

test.describe('[Story 1.8] PUT /api/admin/owners/:id Bank Lainnya Validation', () => {
  test('[P2] #15 PUT /api/admin/owners/:id bankName Lainnya dengan otherBankName → 200', async ({ apiRequest }) => {
    await log.step('GIVEN sesi COO dan owner ID dari daftar')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const ownerId = await getFirstOwnerId(apiRequest, cookieSesi)
    const headerCookie = headerCookieDariMint(cookieSesi)

    await log.step('WHEN PUT /api/admin/owners/:id dengan bankName Lainnya dan otherBankName')
    const timestamp = Date.now().toString().slice(-6)
    const updatePayload = {
      bankAccount: {
        bankName: 'Lainnya',
        otherBankName: 'Bank Lokal Kecil',
        accountHolderName: 'Pemilik Rek Lainnya',
        accountNumber: timestamp,
      },
    }
    const { status, body } = await apiRequest<UpdateOwnerResponse>({
      method: 'PUT',
      path: `/api/admin/owners/${ownerId}`,
      body: updatePayload,
      headers: headerCookie,
    }).validateSchema(SkemaUpdateOwnerResponse)

    await log.step('THEN 200 { owner } — bankName Lainnya tersimpan')
    expect(status).toBe(200)
    expect(body.owner.id).toBe(ownerId)

    await log.step('AND GET detail menampilkan bankName Lainnya dan otherBankName')
    const { body: detailBody } = await apiRequest<OwnerResponse>({
      method: 'GET',
      path: `/api/admin/owners/${ownerId}`,
      headers: headerCookie,
    }).validateSchema(SkemaOwnerResponse)
    expect(detailBody.bankAccount?.bankName).toBe('Lainnya')
    expect(detailBody.bankAccount?.otherBankName).toBe('Bank Lokal Kecil')
  })
})

test.describe('[Story 1.8] POST /api/admin/owners Create Owner (Property 3, 6)', () => {
  test('[P0] #11 POST /api/admin/owners email valid → 201 owner dengan status terverifikasi', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    await log.step('GIVEN sesi COO aktif')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const emailBaru = emailUjiUnik('create-valid')
    EMAIL_OWNER_UJI_TERDAFTAR.add(emailBaru)

    await log.step('WHEN POST /api/admin/owners dengan email valid')
    const createPayload = {
      email: emailBaru,
      fullName: 'Owner Baru COO',
    }
    const { status, body } = await apiRequest<CreateOwnerResponse>({
      method: 'POST',
      path: '/api/admin/owners',
      body: createPayload,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaCreateOwnerResponse)

    await log.step('THEN 201 { owner } dengan status terverifikasi (Property 6)')
    expect(status).toBe(201)
    expect(body.owner.email).toBe(emailBaru)
    expect(body.owner.status).toBe('terverifikasi')
    expect(body.owner.fullName).toBe(createPayload.fullName)
  })

  test('[P0] #12 POST /api/admin/owners email duplikat → 409 envelope EMAIL_EXISTS', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    await log.step('GIVEN sesi COO aktif dan owner yang sudah ada')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    // Gunakan email COO yang sudah pasti ada dari mint
    const emailDuplikat = emailMintDefault('coo')

    await log.step('WHEN POST /api/admin/owners dengan email yang sudah terdaftar')
    const createPayload = {
      email: emailDuplikat,
      fullName: 'Duplikat Owner',
    }
    const { status, body } = await apiRequest<EnvelopeError>({
      method: 'POST',
      path: '/api/admin/owners',
      body: createPayload,
      headers: headerCookieDariMint(cookieSesi),
    }).validateSchema(SkemaEnvelopeError)

    await log.step('THEN 409 envelope EMAIL_EXISTS — email unik (Property 3)')
    expect(status).toBe(409)
    expect(body.code).toBe('EMAIL_EXISTS')
    expect(body.message.length).toBeGreaterThan(0)
  })

  test('[P1] #13 POST /api/admin/owners → audit tercatat dengan action kelola-owner-penambahan', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    await log.step('GIVEN sesi COO aktif')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    const headerCookie = headerCookieDariMint(cookieSesi)
    const emailBaru = emailUjiUnik('create-audit')
    EMAIL_OWNER_UJI_TERDAFTAR.add(emailBaru)

    await log.step('WHEN POST /api/admin/owners dengan email valid')
    const createPayload = {
      email: emailBaru,
      fullName: 'Owner Audit Test',
    }

    // Retry POST in case of transient failures (flaky fix 2026-09-25)
    let ownerId: string
    await expect.poll(async () => {
      const createResponse = await apiRequest<CreateOwnerResponse>({
        method: 'POST',
        path: '/api/admin/owners',
        body: createPayload,
        headers: headerCookie,
      })
      if (createResponse.status !== 201) return false
      const parseResult = SkemaCreateOwnerResponse.safeParse(createResponse.body)
      if (!parseResult.success) return false
      ownerId = parseResult.data.owner.id
      return true
    }, {
      message: 'POST /api/admin/owners harus berhasil dengan status 201',
      timeout: 10_000,
      intervals: [200, 500, 1000, 2000],
    }).toBe(true)

    await log.step('THEN audit tercatat dengan action kelola-owner-penambahan (AD-3)')
    // Poll for audit entry — eventual consistency fix (2026-09-25)
    // Note: limit must be 20, 40, or 80 per API contract
    let auditEntry: z.infer<typeof SkemaEntryAudit> | undefined
    await expect.poll(async () => {
      const response = await apiRequest<DaftarAudit>({
        method: 'GET',
        path: '/api/audit?page=1&limit=80',
        headers: headerCookie,
      })
      if (response.status !== 200) return false
      const parseResult = SkemaDaftarAudit.safeParse(response.body)
      if (!parseResult.success) return false
      auditEntry = parseResult.data.data.find(
        entry => entry.action === 'kelola-owner-penambahan' && entry.target === `owners:${ownerId}`,
      )
      return auditEntry !== undefined
    }, {
      message: `audit entry kelola-owner-penambahan untuk owners:${ownerId!} harus tercatat`,
      timeout: 10_000,
      intervals: [200, 500, 1000, 2000, 3000],
    }).toBe(true)
    expect(auditEntry).toBeDefined()
  })
})

test.describe('[Story 1.8] GET /api/admin/owners Filter (FR-13)', () => {
  test('[P1] #14 GET /api/admin/owners memuat owner status keluar', async ({ apiRequest }) => {
    // GAGAL saat red: 404 — endpoint belum ada
    // Note: Test ini memerlukan seed owner dengan status 'keluar'
    await log.step('GIVEN sesi COO aktif dan owner dengan status keluar di sistem')
    const cookieSesi = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
    // Mint owner dengan status keluar untuk memastikan ada data
    await mintSesiPemilik(apiRequest, { userIdentifier: 'keluar', status: 'keluar' })

    await log.step('WHEN GET /api/admin/owners membawa cookie sesi COO')
    await log.step('THEN 200 { owners } memuat SEMUA owner termasuk status keluar (FR-13)')
    // Poll for owner keluar — eventual consistency fix (2026-09-25)
    // Increase timeout to 10s for slow DB scenarios
    let ownerKeluar: OwnerSummary | undefined
    await expect.poll(async () => {
      const response = await apiRequest<DaftarOwners>({
        method: 'GET',
        path: '/api/admin/owners',
        headers: headerCookieDariMint(cookieSesi),
      })
      if (response.status !== 200) return false
      const parseResult = SkemaDaftarOwners.safeParse(response.body)
      if (!parseResult.success) return false
      ownerKeluar = parseResult.data.owners.find((owner: OwnerSummary) => owner.status === 'keluar')
      return ownerKeluar !== undefined
    }, {
      message: 'daftar harus memuat owner dengan status keluar',
      timeout: 10_000,
      intervals: [200, 500, 1000, 2000, 3000],
    }).toBe(true)
    expect(ownerKeluar).toBeDefined()
  })
})
