/**
 * Role-based access guards (AD-8) — utility functions for enforcing
 * role-based access control at the server boundary. These utilities
 * complement the Principal-based route validation pattern used across
 * API routes.
 *
 * Usage pattern:
 * 1. Get session email via `getSessionEmail(event)`
 * 2. Build principal via `buildPrincipal(repo, email)`
 * 3. Check unlinked status
 * 4. Use `enforceCOO(event, principal)` to guard COO-only routes
 *
 * @module server/utils/role-guard
 */
import type { H3Event } from 'h3'
import type { Principal } from '#shared/domain/identity'
import type { ApiErrorEnvelope } from './api-error'
import { HTTP_STATUS, sendApiError } from './api-error'

/**
 * Result type for role enforcement — either allowed (null) or
 * blocked (ApiErrorEnvelope to return).
 */
export type RoleGuardResult = ApiErrorEnvelope | null

/**
 * Enforce COO-only access (AD-8) — returns an ApiErrorEnvelope if the
 * principal is not a COO, null if access is allowed.
 *
 * Caller must return the envelope when non-null:
 * ```typescript
 * const blocked = enforceCOO(event, principal, 'Hanya COO yang dapat melakukan aksi ini.')
 * if (blocked) return blocked
 * // ... proceed with COO-only logic
 * ```
 *
 * @param event - H3Event for setting response status
 * @param principal - Principal from buildPrincipal (must be linked)
 * @param message - Custom forbidden message (default: generic COO message)
 * @returns ApiErrorEnvelope if forbidden, null if allowed
 *
 * @example
 * // In a route handler after building principal:
 * const blocked = enforceCOO(event, principal)
 * if (blocked) return blocked
 * // COO-only logic follows...
 */
export function enforceCOO(
  event: H3Event,
  principal: Principal,
  message = 'Akses ditolak — hanya COO yang dapat melakukan aksi ini.',
): RoleGuardResult {
  // Type guard: unlinked principal should be handled before calling this
  if (principal.unlinked) {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Akses ditolak — akun tidak terhubung.',
      details: {},
    })
  }

  if (principal.role !== 'coo') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message,
      details: {},
    })
  }

  return null
}

/**
 * Check if a principal has COO role — pure predicate without side effects.
 * Use this when you need to conditionally show/hide UI elements or make
 * decisions without sending an error response.
 *
 * @param principal - Principal from buildPrincipal
 * @returns true if the principal is a linked COO
 *
 * @example
 * const canEdit = isCOO(principal)
 * if (canEdit) { ... }
 */
export function isCOO(principal: Principal): boolean {
  return !principal.unlinked && principal.role === 'coo'
}
