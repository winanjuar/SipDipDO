// server/api/orders/submit.post.ts
//
// Route handler TIPIS submit Pesanan Pembelian (FR-1 §1.1–§1.15, §6.3).
//
// Pola (design.md B.7 "route tipis"): parse input → assertSurfaceAccess →
// OrdersModule.submitOrder (pintu domain) → render nilai desimal sebagai string
// berskala tetap (MoneyString/RatioString) apa adanya, tanpa Number()/parseFloat().
//
// - Submit TIDAK memerlukan MFA (FR-3 §3.3).
// - Owner hanya boleh submit untuk DIRINYA SENDIRI (§15.4): ownerId diambil dari
//   principal sesi, BUKAN dari body (mencegah spoofing).
// - Penolakan gerbang → OrdersError berkode + `details` hitungan penuh; dipetakan
//   ke respons seragam { code, message, details } (Alert Penolakan Terhitung).
// - `defineApiHandler` menjamin Cache-Control: no-store (AD-12) + pemetaan error.

import { orders } from '../../domain/orders'
import type { SubmitOrderInput } from '../../domain/orders'
import type { CapitalType, JakartaDate, Uuid } from '../../../shared/domain/types'
import { assertSurfaceAccess } from '../../utils/access'
import { buildPrincipal } from '../../utils/session'
import { ApiError, defineApiHandler } from '../../utils/http'

const CAPITAL_TYPES: readonly CapitalType[] = [
  'Modal Tetap',
  'Modal Bergerak',
  'Modal Operasional',
]

interface SubmitBody {
  capitalType?: unknown
  quantity?: unknown
  referralOwnerId?: unknown
  submitDate?: unknown
}

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  // Submit adalah aksi atas Pesanan Pembelian milik sendiri (§15.4/§22.7).
  assertSurfaceAccess(principal, 'orders_own')

  const body = (await readBody<SubmitBody>(event)) ?? {}

  if (!CAPITAL_TYPES.includes(body.capitalType as CapitalType)) {
    throw new ApiError('INVALID_CAPITAL_TYPE', 'Capital Type tidak valid.', 422, {
      allowed: CAPITAL_TYPES,
    })
  }
  if (typeof body.quantity !== 'number' || !Number.isFinite(body.quantity)) {
    throw new ApiError('INVALID_QUANTITY', 'Quantity harus berupa angka.', 422)
  }

  const input: SubmitOrderInput = {
    ownerId: principal.ownerId,
    capitalType: body.capitalType as CapitalType,
    quantity: body.quantity,
    referralOwnerId:
      typeof body.referralOwnerId === 'string'
        ? (body.referralOwnerId as Uuid)
        : null,
    submitDate:
      typeof body.submitDate === 'string'
        ? (body.submitDate as JakartaDate)
        : undefined,
  }

  const order = await orders.submitOrder(input)
  // Nilai uang (lockedPrice) sudah MoneyString berskala tetap — dikembalikan apa
  // adanya sebagai string (AD-10), tanpa konversi numerik.
  return { data: order }
})
