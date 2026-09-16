// server/domain/audit/index.ts
//
// Pintu lintas-modul SATU-SATUNYA untuk domain audit (append-only, AD-3).
//
// Modul lain HANYA boleh mengimpor dari sini (bukan dari service/repo internal),
// mengikuti design.md PART A A.4 `AuditModule`:
//   write(tx, entry)     — SELALU in-tx; { actor, action(enum registry), target, details jsonb }
//   listForCoo(filter)   — pembacaan hanya tampilan COO (FR-12 §12.4)

import type { Tx } from '../../utils/db'
import * as service from './audit.service'
import type { AuditFilter, AuditLog } from './audit.repo'
import type { AuditAction, AuditEntry } from './events'

/** Kontrak lintas-modul domain audit (design.md A.4). */
export interface AuditModule {
  write(tx: Tx, entry: AuditEntry): Promise<void>
  listForCoo(filter: AuditFilter): Promise<AuditLog[]>
}

/** Implementasi pintu audit — objek tunggal yang memenuhi `AuditModule`. */
export const audit: AuditModule = {
  write: service.write,
  listForCoo: service.listForCoo,
}

// Re-ekspor tipe kontrak agar pemanggil lintas modul cukup mengimpor dari pintu.
export type { AuditAction, AuditEntry } from './events'
export type { AuditFilter, AuditLog } from './audit.repo'
export { AUDIT_ACTIONS, isAuditAction } from './events'
