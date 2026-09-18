import { profilLengkap, sisaFieldKosong } from '#shared/domain/profil'
import { bacaReferralOwner, findOwnerByEmail } from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail, getSessionNama } from '../../utils/session'

/**
 * GET /api/profile — baca kelengkapan Profile calon owner (Story 1.5, CAP-1/
 * CAP-2). Handler tipis: sesi → 401; selain calon `diajukan` → 403 (CAP-3).
 * Respons `{ ...field, gmail = email sesi, profileComplete, remainingFields }`
 * — nilai persisten antar-panggilan; `remainingFields` PERSIS kunci field
 * wajib yang kosong (indikator UX-DR16 dipin di kontrak wire; `otherBankName`
 * hanya wajib bila Bank "Lainnya"). Kunci wire English (normalisasi owner
 * 2026-09-18): bank diurai dari nilai tunggal `bank_name` oleh repo
 * (`namaBankKeWire`) — "Lainnya" + `otherBankName` untuk teks bebas. Termasuk
 * `referralCode` (kode milik owner — readonly di tampilan), `usedReferralCode`
 * (DORMANT null sampai Epic 3), dan `namaDariGoogle` (nama profil akun Google
 * sesi — prefill AWAL field Nama di halaman bila kolom masih kosong; tidak
 * pernah menimpa data tersimpan).
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
  const namaDariGoogle = await getSessionNama(event)

  return {
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
    remainingFields: sisaFieldKosong(owner),
    referralCode: referral?.referralCode ?? '',
    usedReferralCode: referral?.usedReferralCode ?? null,
    namaDariGoogle: namaDariGoogle ?? '',
  }
})
