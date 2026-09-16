/**
 * AUDIT — audit trail (FR-12, AD-3).
 *
 * API publik modul (dipanggil modul lain HANYA lewat index.ts ini):
 *
 *   // TODO(Story 1.3) — bentuk akhir saat tabel dibuat:
 *   writeAuditEntry(tx, {
 *     actor: { kind: 'user' | 'system', ownerId?: string },
 *     action: AuditActionName,        // registry enum terpusat
 *     target: { type: string, id?: string },
 *     details: Record<string, unknown>, // jsonb
 *   })
 *
 * Aturan mengikat (AD-3): entry ditulis DALAM transaksi DB yang sama dengan
 * aksinya (tidak pernah async); tabel `audit_logs` tanpa jalur UPDATE/DELETE
 * (enforced via DB grants); pembacaan hanya untuk tampilan COO; modul lain
 * tidak membaca audit untuk keputusan bisnis.
 */
export {}
