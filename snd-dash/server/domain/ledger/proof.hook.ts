// server/domain/ledger/proof.hook.ts
//
// Hook enqueue Bukti Transaksi (FR-11/FR-20 §20.8) untuk jalur finalisasi.
//
// PROOFS/ProofsModule (task 15) BELUM dibangun. Design.md B.4 memanggil
// `proofs.enqueueProof(tx, ltx.id)` DI DALAM transaksi finalisasi (AD-5). Selama
// pintu PROOFS belum ter-wire, hook ini menulis satu baris `email_outbox`
// bertanda `kind: 'proof'` sebagai titik integrasi yang jelas — sejalan dengan
// pola `otp.email.ts`.
//
// GANTI isi fungsi ini dengan `proofs.enqueueProof(tx, ledgerTxId)` saat task 15
// selesai, TANPA mengubah pemanggil (`confirmOrder`). JANGAN hard-fail bila
// enqueue gagal: transaksi ledger sudah sah; drain/retry adalah tanggung jawab
// PROOFS (AD-5). Kegagalan enqueue ditelan (best-effort).

import type { Tx } from '../../utils/db'
import { schema } from '../../utils/db'
import type { Uuid } from '../../../shared/domain/types'

const { emailOutbox } = schema

/**
 * Meng-enqueue pembuatan/pengiriman Bukti Transaksi untuk `ledgerTxId` DI DALAM
 * transaksi finalisasi (AD-5), best-effort. `recipient` opsional (email owner)
 * — bila tersedia, dipakai PROOFS sebagai tujuan; bila tidak, PROOFS meresolve
 * saat drain. Kegagalan enqueue tidak membatalkan finalisasi.
 *
 * TODO(task 15): ganti dengan `proofs.enqueueProof(tx, ledgerTxId)`.
 */
export async function enqueueProofHook(
  tx: Tx,
  ledgerTxId: Uuid,
  recipient?: string | null,
): Promise<void> {
  try {
    await tx.insert(emailOutbox).values({
      recipient: recipient ?? '',
      subject: 'Bukti Transaksi',
      body: `Bukti Transaksi untuk transaksi ${ledgerTxId} sedang disiapkan.`,
      payload: {
        kind: 'proof',
        ledgerTxId,
      },
    })
  } catch {
    // Best-effort: PROOFS menangani retry/alert saat drain (AD-5).
  }
}
