/**
 * Helper bersama spec E2E Story 1.6 (pendaftar.api.spec.ts +
 * pendaftar.spec.ts) — SATU sumber untuk persona mint, seed calon lengkap,
 * dan pembacaan audit lintas-halaman (DB dev append-only bersama: entry
 * target bisa jatuh di halaman mana pun, jadi baca ikuti `nextPage` sampai
 * habis — bukan halaman 1 saja).
 */
import { faker } from '@faker-js/faker/locale/id_ID'
import type { Cookie } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'
import type { ApiRequestFixtureParams } from '@seontechnologies/playwright-utils/api-request'
import { mintSesiPemilik } from './sesi-minting'

/** Tanda tangan minimal fixture apiRequest (playwright-utils) untuk helper. */
export type ApiRequestUji = <T = unknown>(params: ApiRequestFixtureParams) => Promise<{ status: number, body: T }>

/** Cookie[] hasil mint → header Cookie untuk apiRequest (apiRequest tidak
 *  berbagi cookie-jar browser). */
export function headerCookieDariMint(cookies: Cookie[]): Record<string, string> {
  return {
    Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
  }
}

/** Email sintetis unik pola mint dev-only (prefix terkunci — anti-timpa). */
export function emailSintetisUji(): string {
  const lokalUji = faker.internet.username().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  return `uji.snddash.e2e.${lokalUji}@gmail.com`
}

/** Factory nilai profil lengkap sintetis (pola kelengkapan-profil.spec.ts). */
export function profilLengkapUji(): Record<string, string> {
  return {
    fullName: `Uji ${faker.string.alphanumeric(6)}`,
    alias: faker.string.alphanumeric({ length: 5, casing: 'lower' }),
    phoneNumber: '0812' + faker.string.numeric(8),
    emergencyContactName: `Uji ${faker.string.alphanumeric(6)}`,
    emergencyContactPhoneNumber: '0813' + faker.string.numeric(8),
    emergencyContactRelationship: 'Saudara',
    bankName: 'BCA',
    otherBankName: '',
    accountHolderName: `Uji ${faker.string.alphanumeric(6)}`,
    accountNumber: faker.string.numeric(10),
  }
}

/** Seed calon `diajukan` dengan profil LENGKAP via PUT /api/profile. */
export async function seedCalonLengkap(apiRequest: ApiRequestUji): Promise<{ email: string, cookies: Cookie[] }> {
  const email = emailSintetisUji()
  const cookies = await mintSesiPemilik(apiRequest, {
    userIdentifier: 'tanpa-saham',
    status: 'diajukan',
    email,
  })
  const simpan = await apiRequest<{ profileComplete: boolean }>({
    method: 'PUT',
    path: '/api/profile',
    body: profilLengkapUji(),
    headers: headerCookieDariMint(cookies),
  })
  expect(simpan.status).toBe(200)
  return { email, cookies }
}

/** Satu entry audit (bentuk wire GET /api/audit — pola redaftar.api.spec.ts). */
export interface EntryAuditUji {
  id: string
  action: string
  actor: { kind: 'user' | 'system', ownerId: string | null }
  target: string | null
  details: Record<string, unknown>
  createdAt: string
}

const SkemaEntryAuditUji = z.object({
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

const SkemaHalamanAuditUji = z.object({
  data: z.array(SkemaEntryAuditUji),
  nextPage: z.union([z.number().int(), z.null()]),
})

/** Batas halaman audit yang diikuti — jaring pengaman loop (DB dev bersama
 *  selalu jauh di bawah ini; lewat = sesuatu salah, lempar daripada diam). */
const BATAS_HALAMAN_AUDIT = 50

/**
 * Baca SELURUH entry audit sebagai COO — ikuti `nextPage` antar-halaman
 * sampai habis (suite fullyParallel menambah entry di DB dev bersama,
 * sehingga target bisa jatuh di luar halaman 1).
 */
export async function bacaAuditSemuaHalaman(apiRequest: ApiRequestUji): Promise<EntryAuditUji[]> {
  const cookieCoo = await mintSesiPemilik(apiRequest, { userIdentifier: 'coo' })
  const semua: EntryAuditUji[] = []
  let halaman = 1
  for (let hitung = 1; ; hitung++) {
    if (hitung > BATAS_HALAMAN_AUDIT) {
      throw new Error(`bacaAuditSemuaHalaman: melewati batas ${BATAS_HALAMAN_AUDIT} halaman — pagination tidak kunjung habis.`)
    }
    const { body } = await apiRequest<{ data: EntryAuditUji[], nextPage: number | null }>({
      method: 'GET',
      path: `/api/audit?page=${halaman}`,
      headers: headerCookieDariMint(cookieCoo),
      validateSchema: SkemaHalamanAuditUji,
    })
    semua.push(...body.data)
    if (body.nextPage === null) break
    halaman = body.nextPage
  }
  return semua
}
