// server/api/ledger/direct-entry.post.ts
//
// Route handler TIPIS jalur input langsung COO (FR-21 §21.1–§21.3).
//
// Pola (design.md B.7): parse → assertCanFinalize (COO bertugas, §15.2/§15.3) →
// LedgerModule.directEntry (SATU transaksi atomik: validasi Strength persis FR-1,
// harga pada TANGGAL INPUT FR-6.4, MFA 'input_langsung', referral WAJIB bila
// Pembelian Pertama, append ledger tanpa Antrian Beli) → render.
//
// - Input langsung WAJIB MFA (FR-3 §3.1): `code` OTP aksi 'input_langsung' terikat
//   `requestId` (targetRef yang sama saat OTP diminta).
// - Penolakan validasi → LedgerError('DIRECT_ENTRY_REJECTED'/'REFERRAL_REQUIRED'/
//   'INVALID_QUANTITY') + `details` hitungan → respons seragam { code, message,
//   details }.
// - `defineApiHandler` menjamin Cache-Control: no-store (AD-12) + pemetaan error.

import { ledger } from '../../domain/ledger'
import type { DirectEntryInput } from '../../domain/ledger'
import type { CapitalType, JakartaDate, Uuid } from '../../../shared/domain/types'
import { assertCanFinalize } from '../../utils/access'
import { buildPrincipal } from '../../utils/session'
import { ApiError, defineApiHandler } from '../../utils/http'

const CAPITAL_TYPES: readonly CapitalType[] = [
  'Modal Tetap',
  'Modal Bergerak',
  'Modal Operasional',
]

interface DirectEntryBody {
  ownerId?: unknown
  capitalType?: unknown
  quantity?: unknown
  code?: unknown
  requestId?: unknown
  paymentDate?: unknown
  paymentMethod?: unknown
  referralOwnerId?: unknown
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
  assertCanFinalize(principal)

  const body = (await readBody<DirectEntryBody>(event)) ?? {}

  if (!CAPITAL_TYPES.includes(body.capitalType as CapitalType)) {
    throw new ApiError('INVALID_CAPITAL_TYPE', 'Capital Type tidak valid.', 422, {
      allowed: CAPITAL_TYPES,
    })
  }
  if (typeof body.quantity !== 'number' || !Number.isFinite(body.quantity)) {
    throw new ApiError('INVALID_QUANTITY', 'Quantity harus berupa angka.', 422)
  }

  const input: DirectEntryInput = {
    ownerId: requireString(body.ownerId, 'ownerId') as Uuid,
    capitalType: body.capitalType as CapitalType,
    quantity: body.quantity,
    cooId: principal.ownerId,
    code: requireString(body.code, 'code'),
    requestId: requireString(body.requestId, 'requestId') as Uuid,
    paymentDate: requireString(body.paymentDate, 'paymentDate') as JakartaDate,
    paymentMethod: requireString(body.paymentMethod, 'paymentMethod'),
    referralOwnerId:
      typeof body.referralOwnerId === 'string'
        ? (body.referralOwnerId as Uuid)
        : null,
    plotting: body.plotting as DirectEntryInput['plotting'],
    overshoot: body.overshoot as DirectEntryInput['overshoot'],
  }

  const tx = await ledger.directEntry(input)
  return { data: tx }
})
