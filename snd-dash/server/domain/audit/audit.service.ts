// server/domain/audit/audit.service.ts
//
// Logika domain audit trail (FR-12). Menegakkan dua aturan inti:
//   - write() SELALU in-tx (AD-2/AD-3): menerima handle `tx` wajib, tidak pernah
//     membuka transaksi sendiri, sehingga penulisan audit atomik bersama aksi.
//   - write() memvalidasi `action` terhadap registry (`events.ts`); aksi di luar
//     registry ditolak (FR-12 §12.1/§12.2).
//
// listForCoo() adalah pembacaan tampilan COO (FR-12 §12.4). Fungsi ini adalah
// permukaan baca COO; enforcement akses peran COO dilakukan di lapisan route.

import { db } from '../../utils/db'
import type { Tx } from '../../utils/db'
import * as repo from './audit.repo'
import type { AuditFilter, AuditLog } from './audit.repo'
import { isAuditAction } from './events'
import type { AuditEntry } from './events'

/**
 * Menulis satu entri audit DI DALAM transaksi aksi (AD-3, SELALU in-tx).
 *
 * @param tx    Handle transaksi aktif — wajib. Penulisan audit menyatu atomik
 *              dengan aksi pemanggil; bila aksi rollback, audit ikut rollback.
 * @param entry Entri audit; `action` harus anggota registry (`AUDIT_ACTIONS`).
 * @throws bila `action` tidak terdaftar di registry.
 */
export async function write(tx: Tx, entry: AuditEntry): Promise<void> {
  if (!tx) {
    throw new Error(
      'AuditService.write harus dipanggil in-tx (AD-3): parameter `tx` wajib.',
    )
  }
  if (!isAuditAction(entry.action)) {
    throw new Error(
      `Aksi audit tidak dikenal: "${entry.action}". Tambahkan ke registry AUDIT_ACTIONS (events.ts) bila memang aksi baru.`,
    )
  }
  await repo.insert(tx, entry)
}

/**
 * Membaca audit trail untuk tampilan COO (FR-12 §12.4), terbaru lebih dulu.
 *
 * Pembacaan di luar transaksi aksi memakai instance `db` bound-schema.
 * Enforcement akses COO ditegakkan di lapisan route.
 */
export function listForCoo(filter: AuditFilter): Promise<AuditLog[]> {
  return repo.query(db, filter)
}
