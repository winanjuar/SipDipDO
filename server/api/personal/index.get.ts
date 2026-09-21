import { profilLengkap } from '#shared/domain/profil'
import { buildPrincipal, createIdentityRepo, findOwnerByEmail } from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'

/**
 * GET /api/personal — profil MILIK-SENDIRI read-only untuk role
 * `tanpa_saham` (Story 1.7, FR-15 matriks §4.8; AD-8). Handler tipis pola
 * `landing.get.ts`: sesi → 401 envelope seragam; `buildPrincipal` → role
 * lain (calon_owner/pemegang_saham/coo) → 403 envelope TANPA baca data;
 * role `tanpa_saham` → 200 `{ email, status, ...10 field wire Profil,
 * profileComplete, firstEffectiveAt }` via repo `findOwnerByEmail`.
 *
 * `resolveRole` memetakan `keluar` → `tanpa_saham` SEBELUM melihat
 * `firstEffectiveAt` (access.service) — owner `keluar` yang PERNAH membeli
 * tetap dilayani endpoint ini. `firstEffectiveAt` ikut dikirim agar lapisan
 * halaman menilai `aksesPenuh()` lewat predikat kanonik (AD-8/AD-11 — bukan
 * dari `positions.shares` live). Operasi BACA — tanpa audit (FR-22 audit =
 * aksi mutasi). Bentuk wire sama dengan `/api/profile` (kunci English,
 * normalisasi owner 2026-09-18).
 */
export default defineEventHandler(async (event) => {
  const email = await getSessionEmail(event)
  if (!email) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Sesi tidak ditemukan — masuk lewat halaman Login.',
      details: {},
    })
  }

  const principal = await buildPrincipal(createIdentityRepo(useDb()), email)
  if (principal.unlinked) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Sesi tidak terhubung ke owner mana pun.',
      details: {},
    })
  }
  if (principal.role !== 'tanpa_saham') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Hanya owner tanpa saham yang dapat membaca Halaman Personal.',
      details: {},
    })
  }

  const owner = await findOwnerByEmail(useDb(), email)
  if (!owner) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Sesi tidak terhubung ke owner mana pun.',
      details: {},
    })
  }

  return {
    email: owner.email,
    status: owner.status,
    fullName: owner.fullName ?? '',
    alias: owner.alias ?? '',
    gmail: owner.email,
    phoneNumber: owner.phoneNumber ?? '',
    emergencyContactName: owner.emergencyContactName ?? '',
    emergencyContactPhoneNumber: owner.emergencyContactPhoneNumber ?? '',
    emergencyContactRelationship: owner.emergencyContactRelationship ?? '',
    bankName: owner.bankName ?? '',
    otherBankName: owner.otherBankName ?? '',
    accountHolderName: owner.accountHolderName ?? '',
    accountNumber: owner.accountNumber ?? '',
    profileComplete: profilLengkap(owner),
    firstEffectiveAt: owner.firstEffectiveAt,
  }
})
