/**
 * Kontrak wire /api/admin/owners (Story 1.8) + helper tampilan halaman
 * manajemen owner COO. Bentuk wire cermin server/domain/identity/owner.service.ts.
 */

import type { OwnerStatus } from '#shared/domain/identity'

/** Ringkasan owner untuk daftar GET /api/admin/owners. */
export interface OwnerListItem {
  id: string
  fullName: string | null
  alias: string | null
  email: string
  phoneNumber: string | null
  status: OwnerStatus
  profileComplete: boolean
  createdAt: string
}

/** Respons GET /api/admin/owners. */
export interface ListOwnersResponse {
  owners: OwnerListItem[]
}

/** Kontak darurat owner (nested dalam GetOwnerResponse). */
export interface EmergencyContactDetail {
  name: string | null
  phoneNumber: string | null
  relationship: string | null
}

/** Rekening bank owner (nested dalam GetOwnerResponse). */
export interface BankAccountDetail {
  bankName: string | null
  otherBankName: string | null
  accountHolderName: string | null
  accountNumber: string | null
}

/** Detail owner lengkap GET /api/admin/owners/:id. */
export interface OwnerDetail {
  id: string
  email: string
  status: OwnerStatus
  rejectionReason: string | null
  firstEffectiveAt: string | null
  fullName: string | null
  alias: string | null
  phoneNumber: string | null
  profileComplete: boolean
  createdAt: string
  updatedAt: string
}

/** Response lengkap GET /api/admin/owners/:id. */
export interface GetOwnerResponse {
  owner: OwnerDetail
  emergencyContact: EmergencyContactDetail | null
  bankAccount: BankAccountDetail | null
}

/** Body PUT /api/admin/owners/:id. */
export interface UpdateOwnerRequest {
  fullName?: string
  alias?: string
  phoneNumber?: string
  emergencyContact?: {
    name?: string
    phoneNumber?: string
    relationship?: string
  }
  bankAccount?: {
    bankName?: string
    otherBankName?: string
    accountHolderName?: string
    accountNumber?: string
  }
}

/** Body POST /api/admin/owners. */
export interface CreateOwnerRequest {
  email: string
  fullName?: string
  alias?: string
  phoneNumber?: string
  emergencyContact?: {
    name?: string
    phoneNumber?: string
    relationship?: string
  }
  bankAccount?: {
    bankName?: string
    otherBankName?: string
    accountHolderName?: string
    accountNumber?: string
  }
}

/** Response sukses POST /api/admin/owners. */
export interface CreateOwnerResponse {
  success: true
  owner: OwnerDetail
}

/* ------------------------------------------------------------------ *
 * Helper tampilan — label & varian badge status owner.
 * ------------------------------------------------------------------ */

/** Label Indonesia status owner — untuk tampilan UI. */
export const LABEL_STATUS: Record<OwnerStatus, string> = {
  diajukan: 'Diajukan',
  terverifikasi: 'Terverifikasi',
  ditolak: 'Ditolak',
  kedaluwarsa: 'Kedaluwarsa',
  keluar: 'Keluar',
}

/** Varian badge per status — sesuai UX-DR2 (success/warn/destructive/muted). */
export const BADGE_VARIANT: Record<OwnerStatus, 'success' | 'warn' | 'destructive' | 'muted'> = {
  diajukan: 'warn',
  terverifikasi: 'success',
  ditolak: 'destructive',
  kedaluwarsa: 'muted',
  keluar: 'muted',
}

/** Zona tampilan waktu — konvensi spine (Asia/Jakarta, AD-9). */
const ZONA_WAKTU = 'Asia/Jakarta'
/** Lokal format waktu — UI Bahasa Indonesia. */
const LOKAL_WAKTU = 'id-ID'

const PEMFORMAT_WAKTU = new Intl.DateTimeFormat(LOKAL_WAKTU, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: ZONA_WAKTU,
})

/** Format waktu pendek: "17 Sep 2026". */
export function formatTanggal(iso: string): string {
  return PEMFORMAT_WAKTU.format(new Date(iso))
}

/** Nama tampilan owner — fullName > alias > email. */
export function namaTampilan(owner: Pick<OwnerListItem, 'fullName' | 'alias' | 'email'>): string {
  return owner.fullName ?? owner.alias ?? owner.email
}
