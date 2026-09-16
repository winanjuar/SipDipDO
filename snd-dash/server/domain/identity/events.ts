// server/domain/identity/events.ts
//
// Definisi event & tipe domain siklus hidup IDENTITY (FR-13/FR-15/FR-22).
//
// Modul ini adalah SATU sumber kebenaran untuk bentuk entitas Owner dan event
// lintas modul yang dipancarkan saat transisi status. Nilai lifecycle memakai
// union kanonik dari `shared/domain/types.ts` (OwnerLifecycle) sehingga selaras
// dengan enum DB `owner_lifecycle` (drizzle/schema.ts).
//
// Referensi:
//   design.md PART A A.4 IdentityModule (lifecycle & access + CAS transitions)
//   FR-13 §13.5–13.7 : representasi status (pemegang saham / tanpa saham / Keluar)
//   FR-15 §15.5–15.6 : akses per status
//   FR-22 §22.1/22.2/22.4/22.8 : pendaftaran → Diajukan; transisi tertutup; referral

import type { OwnerLifecycle, Uuid } from '../../../shared/domain/types'

/**
 * Entitas Owner sebagaimana relevan bagi keputusan siklus hidup & akses.
 *
 * `firstEffectiveAt` adalah penanda event Pembelian Pertama efektif (FR-15 §15.8,
 * FR-22 §22.10). Lifecycle string SAJA tidak cukup menentukan keterbukaan penuh
 * (Owner 'terverifikasi' bisa sebelum ATAU sesudah pembelian pertama), maka
 * `aksesPenuh`/`perluReferral` memeriksa `firstEffectiveAt` di samping status.
 */
export interface Owner {
  id: Uuid
  email: string
  name: string | null
  status: OwnerLifecycle
  /** Waktu Pembelian Pertama menjadi efektif; NULL bila belum pernah efektif. */
  firstEffectiveAt: Date | null
  rejectionReason: string | null
}

/**
 * Tenure mandat COO (FR-17). Sebuah tenure aktif pada waktu `at` bila
 * `startedAt <= at` DAN (`endedAt IS NULL` ATAU `endedAt > at`). `momRef`
 * mereferensikan MoM keputusan pergantian COO (NULL untuk tenure awal migrasi).
 *
 * Dikembalikan oleh `assertCooAt` sehingga jalur finalisasi tahu COO yang
 * bertugas pada saat transaksi dicatat (FR-17 §17.3).
 */
export interface CooTenure {
  id: Uuid
  ownerId: Uuid
  startedAt: Date
  endedAt: Date | null
  momRef: Uuid | null
}

/**
 * Pilihan referral yang sah (FR-22 §22.8): Owner eksisting pemegang saham
 * (termasuk COO) ATAU Owner baru yang belum pernah membeli saham.
 */
export interface ReferralChoice {
  ownerId: Uuid
  name: string | null
  email: string
  /** true bila Owner sudah pemegang saham (punya posisi shares > 0). */
  isShareholder: boolean
}

/**
 * Event domain siklus hidup Owner. Dipancarkan oleh service saat transisi CAS
 * berhasil; dikonsumsi lintas modul (mis. LEDGER menandai Pembelian Pertama,
 * DISTRIBUTION menandai Keluar). Fase ini hanya mendefinisikan bentuk event —
 * pengiriman aktual di-wire pada tugas integrasi.
 */
export type IdentityEvent =
  | { type: 'RegistrationSubmitted'; ownerId: Uuid; email: string }
  | { type: 'RegistrationVerified'; ownerId: Uuid; cooId: Uuid }
  | { type: 'RegistrationRejected'; ownerId: Uuid; cooId: Uuid; reason: string }
  | { type: 'FirstPurchaseEffective'; ownerId: Uuid; at: Date }
  | { type: 'OwnerExited'; ownerId: Uuid }

/** Konstruktor event Pembelian Pertama efektif (FR-15 §15.8 / FR-22 §22.10). */
export function firstPurchaseEffective(ownerId: Uuid, at: Date): IdentityEvent {
  return { type: 'FirstPurchaseEffective', ownerId, at }
}

/** Konstruktor event Owner ditandai Keluar (FR-13 §13.6 / FR-16 §16.8). */
export function ownerExited(ownerId: Uuid): IdentityEvent {
  return { type: 'OwnerExited', ownerId }
}
