import type { OwnerStatus } from '#shared/domain/identity'

/**
 * Status owner pemilik Halaman Personal — `resolveRole` memetakan
 * `terverifikasi` maupun `keluar` ke role `tanpa_saham` (AD-8: keluar
 * → tanpa_saham SEBELUM melihat `firstEffectiveAt`).
 */
export type StatusPersonal = Extract<OwnerStatus, 'terverifikasi' | 'keluar'>

/**
 * Kontrak respons GET /api/personal (server/api/personal/index.get.ts) —
 * bentuk wire Profil sama dengan `/api/profile` (kunci English, normalisasi
 * owner 2026-09-18) + `status` + `firstEffectiveAt`. `firstEffectiveAt`
 * dipakai lapisan halaman untuk menilai predikat kanonik `aksesPenuh()`
 * (AD-8/AD-11 — tidak pernah dari `positions.shares` live).
 */
export interface PersonalRespons {
  email: string
  status: StatusPersonal
  fullName: string
  alias: string
  gmail: string
  phoneNumber: string
  emergencyContactName: string
  emergencyContactPhoneNumber: string
  emergencyContactRelationship: string
  bankName: string
  otherBankName: string
  accountHolderName: string
  accountNumber: string
  profileComplete: boolean
  firstEffectiveAt: string | null
}
