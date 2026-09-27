/**
 * AUDIT (AD-3) — satu-satunya pintu impor lintas modul untuk menulis entry
 * audit (in-tx) dan membaca trail (COO saja). Modul lain TIDAK mengimpor
 * service/repo internal maupun menyentuh tabel `audit_logs` langsung (AD-5).
 */
export { hitungEntryAksi, listForCoo, writeAuditEntry } from './audit.service'
export type { AuditDaftar, AuditEntryWire } from './audit.service'
export { AUDIT_LIMIT_DEFAULT, AUDIT_LIMIT_OPSI, isAuditLimit } from '#shared/domain/audit'
export type { AuditLimit } from '#shared/domain/audit'
