// server/domain/proofs/index.ts
//
// Pintu lintas-modul SATU-SATUNYA untuk domain proofs (FR-11, AD-5).
//
// Modul lain HANYA boleh mengimpor dari sini (bukan dari service/repo internal),
// mengikuti design.md PART A A.4 `ProofsModule`:
//   enqueueProof(tx, ledgerTxId) — baris outbox 'proof' DI DALAM tx aksi (AD-5)
//   enqueueEmail(tx, email)      — email notifikasi generik in-tx (OTP tidak lewat sini)
//   renderProofPdf(ledgerTxId)   — fungsi MURNI state ledger pada titik potong
//                                  (regenerate-on-demand, byte-identik → Property 11)
//   drainOutbox()                — async + retry; kegagalan persisten wajib terlihat (log+alert)
//
// `enqueueProof` adalah pintu kanonik yang MENGGANTIKAN hook sementara
// `ledger/proof.hook.ts`. Sesuai instruksi task, modul ledger TIDAK diubah di
// sini; penggantian pemanggil (swap hook → `proofs.enqueueProof`) dilakukan
// terpisah tanpa mengubah kontrak `confirmOrder`.

import type { Tx } from '../../utils/db'
import type { Uuid } from '../../../shared/domain/types'
import * as service from './proofs.service'
import type { OutboundEmail } from './events'

/** Kontrak lintas-modul domain proofs (design.md A.4). */
export interface ProofsModule {
  /** Baris outbox Bukti Transaksi DI DALAM transaksi aksi (AD-5). */
  enqueueProof(tx: Tx, ledgerTxId: Uuid): Promise<void>
  /** Email notifikasi generik in-tx (mis. COO new-order, FR-19 §8). */
  enqueueEmail(tx: Tx, email: OutboundEmail): Promise<void>
  /** Bukti = fungsi murni state ledger pada titik potong (regenerate-on-demand). */
  renderProofPdf(ledgerTxId: Uuid): Promise<Uint8Array>
  /** Drain outbox async + retry; kegagalan terus-menerus → log + alert (§20.10). */
  drainOutbox(): Promise<void>
}

/** Implementasi pintu proofs — objek tunggal yang memenuhi `ProofsModule`. */
export const proofs: ProofsModule = {
  enqueueProof: service.enqueueProof,
  enqueueEmail: service.enqueueEmail,
  renderProofPdf: service.renderProofPdf,
  drainOutbox: service.drainOutbox,
}

// Re-ekspor tipe kontrak & error + titik suntik transport/alert agar bootstrap
// runtime dan pemanggil lintas modul cukup mengimpor dari pintu ini.
export type {
  OutboundEmail,
  ProofData,
  OutboxKind,
  OutboxRow,
  ProofsErrorCode,
} from './events'
export { ProofsError } from './events'
export type { EmailTransport, AlertHook } from './proofs.service'
export { setTransport, setAlertHook, MAX_ATTEMPTS } from './proofs.service'
