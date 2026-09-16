// server/api/ledger/confirm.post.ts
//
// Route handler TIPIS finalisasi konfirmasi Pesanan Pembelian (FR-20).
//
// Pola (design.md B.7): parse → assertCanFinalize (COO bertugas, §15.2/§15.3) →
// LedgerModule.confirmOrder (SATU transaksi atomik: otoritas COO in-tx, re-validasi
// Strength/ruang RKAP/referral, verifikasi+konsumsi OTP, append ledger, CAS
// pesanan → terkonfirmasi, plotting+overshoot, event Pembelian Pertama, enqueue
// Bukti + audit) → render.
//
// - Konfirmasi WAJIB MFA (FR-3 §3.1): `code` OTP aksi 'konfirmasi' terikat orderId.
// - Penolakan re-validasi → LedgerError('REVALIDATION_FAILED') + `details`
//   hitungan lengkap (ConfirmRejection) → respons seragam { code, message,
//   details } (Alert Penolakan Terhitung, tidak pernah generik).
// - `defineApiHandler` menjamin Cache-Control: no-store (AD-12) + pemetaan error.

import { ledger } from '../../domain/ledger'
import type { ConfirmOrderInput } from '../../domain/ledger'
import type { JakartaDate, Uuid } from '../../../shared/domain/types'
import { assertCanFinalize } from '../../utils/access'
import { buildPrincipal } from '../../utils/session'
import { ApiError, defineApiHandler } from '../../utils/http'

interface ConfirmBody {
  orderId?: unknown
  code?: unknown
  paymentDate?: unknown
  paymentMethod?: unknown
  plotting?: unknown
  overshoot?: unknown
}

function requireString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new ApiError('INVALID_INPUT', `${field} wajib diisi.`, 400, { field })
  }
  return v
}

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  // Finalisasi hanya oleh COO bertugas (§15.2/§15.3). Otoritas juga dicek in-tx
  // pada jalur domain (AD-8) — guard route adalah lapis pertama.
  assertCanFinalize(principal)

  const body = (await readBody<ConfirmBody>(event)) ?? {}

  const input: ConfirmOrderInput = {
    orderId: requireString(body.orderId, 'orderId') as Uuid,
    cooId: principal.ownerId,
    code: requireString(body.code, 'code'),
    paymentDate: requireString(body.paymentDate, 'paymentDate') as JakartaDate,
    paymentMethod: requireString(body.paymentMethod, 'paymentMethod'),
    plotting: body.plotting as ConfirmOrderInput['plotting'],
    overshoot: body.overshoot as ConfirmOrderInput['overshoot'],
  }

  const tx = await ledger.confirmOrder(input)
  // LedgerTransaction membawa MoneyString (finalPrice/actualAmount) apa adanya (AD-10).
  return { data: tx }
})
