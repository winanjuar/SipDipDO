// server/api/mfa/request-otp.post.ts
//
// Route handler TIPIS permintaan OTP MFA (FR-3 §3.1/§3.4, FR-20 §20.2, AD-8).
//
// Pola (design.md B.7): parse → assertCanFinalize (hanya COO bertugas yang boleh
// meminta OTP aksi transaksional) → IdentityModule.requestOtp (buka transaksinya
// sendiri: invalidasi kode hidup + cooldown 60s + catat permintaan pada audit) →
// render.
//
// - Himpunan aksi MFA TERTUTUP (AD-8): 'konfirmasi' | 'input_langsung' |
//   'kompensasi'. Aksi lain → 400.
// - `targetRef` mengikat OTP ke sumber aksi: orderId (konfirmasi), requestId
//   (input langsung), atau ledgerTxId asal (kompensasi).
// - Cooldown 60s → IdentityError('OTP_COOLDOWN') → respons seragam { code,
//   message, details }.
// - `defineApiHandler` menjamin Cache-Control: no-store (AD-12) + pemetaan error.

import { identity } from '../../domain/identity'
import type { MfaActionType, Uuid } from '../../../shared/domain/types'
import { assertCanFinalize } from '../../utils/access'
import { buildPrincipal } from '../../utils/session'
import { ApiError, defineApiHandler } from '../../utils/http'

const MFA_ACTIONS: readonly MfaActionType[] = [
  'konfirmasi',
  'input_langsung',
  'kompensasi',
]

interface RequestOtpBody {
  actionType?: unknown
  targetRef?: unknown
}

export default defineApiHandler(async (event) => {
  const principal = await buildPrincipal(event)
  // OTP aksi transaksional hanya untuk COO bertugas (§15.2/§15.3, AD-8).
  assertCanFinalize(principal)

  const body = (await readBody<RequestOtpBody>(event)) ?? {}

  if (!MFA_ACTIONS.includes(body.actionType as MfaActionType)) {
    throw new ApiError('INVALID_MFA_ACTION', 'Jenis aksi MFA tidak valid.', 400, {
      allowed: MFA_ACTIONS,
    })
  }
  if (typeof body.targetRef !== 'string' || body.targetRef.length === 0) {
    throw new ApiError('INVALID_TARGET_REF', 'targetRef wajib diisi.', 400)
  }

  await identity.requestOtp(
    body.actionType as MfaActionType,
    body.targetRef as Uuid,
    principal.ownerId,
  )

  // Tidak mengembalikan kode OTP (dikirim via email). Hanya konfirmasi permintaan.
  return { data: { ok: true, actionType: body.actionType, targetRef: body.targetRef } }
})
