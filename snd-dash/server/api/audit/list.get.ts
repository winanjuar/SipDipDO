// server/api/audit/list.get.ts
//
// FR-12 §12.4 — Tampilan audit trail (COO-only). Route TIPIS:
// parse → buildPrincipal → assertSurfaceAccess ('audit_trail') → pintu
// audit.listForCoo(filter). Permukaan `audit_trail` bersifat COO-only DAN
// terkunci bagi Owner tanpa saham (matriks keterbukaan §4.8) — enforcement penuh
// ada di `assertSurfaceAccess`.
//
// KONTRAK
//   GET /api/audit/list?actor=<uuid?>&action=<string?>&from=<ISO?>&to=<ISO?>&limit=<n?>
//   200: { data: AuditLog[] }
//   403: { code: 'FORBIDDEN' } bila bukan COO bertugas

import { audit } from '../../domain/audit'
import type { AuditFilter } from '../../domain/audit'
import { assertSurfaceAccess } from '../../utils/access'
import { defineApiHandler } from '../../utils/http'
import { buildPrincipal } from '../../utils/session'
import { parseOptionalUuid } from '../../utils/pricing-input'

/** Mem-parse tanggal ISO opsional dari query menjadi `Date` (atau undefined). */
function parseOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === '') return undefined
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = new Date(String(raw))
  if (Number.isNaN(parsed.getTime())) return undefined
  void field
  return parsed
}

/** Mem-parse limit opsional (1..1000) dari query. */
function parseOptionalLimit(value: unknown): number | undefined {
  if (value === undefined || value === '') return undefined
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isInteger(n) || n < 1) return undefined
  return Math.min(n, 1000)
}

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  assertSurfaceAccess(principal, 'audit_trail')

  const query = getQuery(event)
  const filter: AuditFilter = {
    actor: parseOptionalUuid(query.actor, 'actor') ?? undefined,
    action:
      query.action === undefined || query.action === ''
        ? undefined
        : String(Array.isArray(query.action) ? query.action[0] : query.action),
    from: parseOptionalDate(query.from, 'from'),
    to: parseOptionalDate(query.to, 'to'),
    limit: parseOptionalLimit(query.limit),
  }

  const logs = await audit.listForCoo(filter)
  return { data: logs }
})
