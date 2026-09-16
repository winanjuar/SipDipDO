// server/domain/identity/index.ts
//
// SATU-SATUNYA pintu lintas modul (cross-module door) untuk modul IDENTITY.
//
// Modul lain (orders, ledger, access guard, dst.) mengimpor HANYA dari sini —
// tidak langsung dari repo/service internal. Bentuk pintu mengikuti
// design.md PART A A.4 `IdentityModule`.
//
// Cakupan tugas 6.1: siklus hidup & keterbukaan + transisi status CAS.
// Otoritas COO (assertCooAt/transferCoo, tugas 6.2) dan MFA (requestOtp/
// verifyAndConsumeOtp, tugas 6.3) SENGAJA dibiarkan sebagai titik ekstensi:
// tambahkan implementasinya ke objek `identity` di bawah tanpa mengubah pemanggil.

import type { Tx } from '../../utils/db'
import type { MfaActionType, OwnerLifecycle, Uuid } from '../../../shared/domain/types'
import type { JakartaDate } from '../../../shared/domain/types'
import type { CooTenure, Owner, ReferralChoice } from './events'
import * as service from './identity.service'
import * as otp from './otp.service'

// Re-ekspor tipe domain yang menjadi bagian kontrak pintu.
export type { CooTenure, Owner, ReferralChoice, IdentityEvent } from './events'
export type { IdentityErrorCode, RegistrationLifecycleResult } from './identity.service'
export { IdentityError } from './identity.service'

/**
 * Kontrak pintu IDENTITY (design.md A.4).
 *
 * Catatan penyimpangan terdokumentasi: `aksesPenuh`/`perluReferral` menerima
 * entitas `Owner` (status + firstEffectiveAt), bukan sekadar `OwnerLifecycle`
 * string. Lifecycle string SAJA tidak cukup membedakan Owner 'terverifikasi'
 * sebelum vs sesudah Pembelian Pertama; keterbukaan penuh (FR-15 §15.8) menuntut
 * `firstEffectiveAt`. `OwnerLifecycle` tetap diimpor sebagai bagian kontrak tipe.
 */
export interface IdentityModule {
  // Lifecycle & access (AD-8/AD-11).
  getLifecycle(reader: Pick<Tx, 'select'>, ownerId: Uuid): Promise<Owner>
  aksesPenuh(owner: Owner): boolean
  perluReferral(owner: Owner): boolean
  pilihanReferral(tx: Tx): Promise<ReferralChoice[]>
  requireVerifiedProfile(tx: Tx, ownerId: Uuid): Promise<void>

  // Status transitions — compare-and-set atas status prior (AD-11).
  submitRegistration(googleEmail: string): Promise<Owner>
  verifyRegistration(tx: Tx, ownerId: Uuid, cooId: Uuid): Promise<void>
  rejectRegistration(
    tx: Tx,
    ownerId: Uuid,
    cooId: Uuid,
    reason: string,
  ): Promise<void>
  markFirstPurchaseEffective(tx: Tx, ownerId: Uuid, at: Date): Promise<void>
  markExit(tx: Tx, ownerId: Uuid): Promise<void>

  // Siklus hidup pendaftar (FR-22 §22.5/§22.6) — dipanggil cron DI DALAM `tx`.
  // Pengingat H-3 (idempoten, tepat satu email) + kedaluwarsa hari-7 (CAS
  // 'diajukan' → 'kedaluwarsa' + audit). Batas hari zona Asia/Jakarta (AD-9),
  // invarian terhadap jam pemicu UTC. Mengembalikan pengingat baru + id kedaluwarsa.
  expireRegistrations(
    tx: Tx,
    jakartaToday: JakartaDate,
  ): Promise<service.RegistrationLifecycleResult>

  // COO authority (AD-8) — dicek DI DALAM transaksi finalisasi (FR-15 §15.2, FR-17).
  // `assertCooAt` menerima `db` bound-schema maupun handle `tx` (guard & finalisasi).
  assertCooAt(reader: Pick<Tx, 'select'>, userId: Uuid, at: Date): Promise<CooTenure>
  transferCoo(tx: Tx, fromCoo: Uuid, toOwner: Uuid, momRef: Uuid): Promise<void>

  // MFA (FR-3, FR-20 §20.2, AD-8) — himpunan aksi tertutup (konfirmasi/
  // input_langsung/kompensasi). `requestOtp` membuka transaksinya sendiri
  // (invalidasi kode hidup + cooldown 60s + catat audit). `verifyAndConsumeOtp`
  // menerima `tx` dan mengonsumsi single-use via CAS DI DALAM tx finalisasi —
  // rollback luar meninggalkan OTP tidak terkonsumsi.
  requestOtp(
    actionType: MfaActionType,
    targetRef: Uuid,
    cooId: Uuid,
  ): Promise<void>
  verifyAndConsumeOtp(
    tx: Tx,
    actionType: MfaActionType,
    targetRef: Uuid,
    code: string,
  ): Promise<void>
}

/**
 * Implementasi pintu IDENTITY. Tunggal (stateless) — mendelegasikan ke service.
 * Modul lintas modul memakai objek ini: `import { identity } from '../identity'`.
 */
export const identity: IdentityModule = {
  getLifecycle: service.getLifecycle,
  aksesPenuh: service.aksesPenuh,
  perluReferral: service.perluReferral,
  pilihanReferral: service.pilihanReferral,
  requireVerifiedProfile: service.requireVerifiedProfile,
  submitRegistration: service.submitRegistration,
  verifyRegistration: service.verifyRegistration,
  rejectRegistration: service.rejectRegistration,
  markFirstPurchaseEffective: service.markFirstPurchaseEffective,
  markExit: service.markExit,
  expireRegistrations: service.expireRegistrations,
  assertCooAt: service.assertCooAt,
  transferCoo: service.transferCoo,
  requestOtp: otp.requestOtp,
  verifyAndConsumeOtp: otp.verifyAndConsumeOtp,
}

// Ekspor tipe kontrak yang mungkin dipakai pemanggil untuk anotasi.
export type { OwnerLifecycle }
