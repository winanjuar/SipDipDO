import { profilLengkap, sisaFieldKosong } from '#shared/domain/profil'
import { bacaReferralOwner, findOwnerByEmail } from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'

/**
 * GET /api/profile — baca kelengkapan Profile calon owner (Story 1.5, CAP-1/
 * CAP-2). Handler tipis: sesi → 401; selain calon `diajukan` → 403 (CAP-3).
 * Respons `{ ...field, gmail = email sesi, profileComplete, remainingFields }`
 * — nilai persisten antar-panggilan; `remainingFields` PERSIS kunci field
 * kosong (indikator langkah UX-DR16 dipin di kontrak wire). Termasuk
 * `referralCode` (kode milik owner — readonly di tampilan) dan
 * `usedReferralCode` (DORMANT null sampai Epic 3 — permintaan owner
 * 2026-09-18: label & kotak tampilan disiapkan dulu).
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

  const owner = await findOwnerByEmail(useDb(), email)
  if (!owner || owner.status !== 'diajukan') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Hanya calon owner berstatus diajukan yang dapat membaca kelengkapan Profile.',
      details: {},
    })
  }

  const referral = await bacaReferralOwner(useDb(), email)

  return {
    namaLengkap: owner.namaLengkap ?? '',
    alias: owner.alias ?? '',
    gmail: owner.email,
    nomorHp: owner.nomorHp ?? '',
    kontakDarurat: owner.kontakDarurat ?? '',
    nomorHpKontakDarurat: owner.nomorHpKontakDarurat ?? '',
    hubunganDenganOwner: owner.hubunganDenganOwner ?? '',
    namaBank: owner.namaBank ?? '',
    pemilikRekening: owner.pemilikRekening ?? '',
    nomorRekening: owner.nomorRekening ?? '',
    profileComplete: profilLengkap(owner),
    remainingFields: sisaFieldKosong(owner),
    referralCode: referral?.referralCode ?? '',
    usedReferralCode: referral?.usedReferralCode ?? null,
  }
})
